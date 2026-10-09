#!/usr/bin/env python3
"""Concurrent HLS/OCR detector and delayed FGCScout match-video reconciler."""
import argparse
import hashlib
import io
import json
import logging
import math
import os
from pathlib import Path
import re
import sqlite3
import ssl
import statistics
import subprocess
import tempfile
import threading
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urljoin, urlencode, urlparse
from urllib.request import Request, urlopen

import certifi
from PIL import Image, ImageOps

LOG = logging.getLogger('fgc-live')
STOP = threading.Event()
CONTEXT = ssl.create_default_context(cafile=certifi.where())


def http(url, payload=None, key=None):
    headers = {'User-Agent': 'FGCScout-Live/2', 'Cache-Control': 'no-cache'}
    if key:
        headers['X-Admin-Key'] = key
    body = None if payload is None else json.dumps(payload).encode()
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = Request(url, body, headers, method='GET' if body is None else 'PUT')
    # Never forward admin credentials to a redirected host or downgrade HTTPS.
    if key:
        import urllib.request
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=CONTEXT))
        response = opener.open(req, timeout=20)
    else:
        response = urlopen(req, timeout=20, context=CONTEXT)
    with response:
        body = response.read(32 * 1024 * 1024 + 1)
        if len(body) > 32 * 1024 * 1024:
            raise ValueError('HTTP response exceeds the size limit')
        return body, response.url


def utc(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('UTC anchors must include a timezone')
    return parsed.timestamp()


def playlist(text, url):
    if not text.lstrip().startswith('#EXTM3U'):
        raise ValueError('Source is not an HLS playlist')
    lines = [v.strip() for v in text.splitlines() if v.strip()]
    if any(v.startswith('#EXT-X-STREAM-INF:') for v in lines):
        variants = []
        for i, line in enumerate(lines):
            if line.startswith('#EXT-X-STREAM-INF:') and i + 1 < len(lines):
                height = re.search(r'RESOLUTION=\d+x(\d+)', line)
                variants.append((int(height[1]) if height else 9999, urljoin(url, lines[i+1])))
        suitable = [v for v in variants if v[0] >= 480]
        return {'variant': min(suitable or variants)[1]}
    seq, duration, pdt, init = 0, None, None, None
    pdt_explicit = False
    discontinuity = False
    segments = []
    for line in lines:
        if line.startswith('#EXT-X-MEDIA-SEQUENCE:'):
            seq = int(line.split(':', 1)[1])
        elif line.startswith('#EXTINF:'):
            duration = float(line.split(':', 1)[1].split(',')[0])
        elif line.startswith('#EXT-X-PROGRAM-DATE-TIME:'):
            pdt = utc(line.split(':', 1)[1])
            pdt_explicit = True
        elif line.startswith('#EXT-X-MAP:'):
            match = re.search(r'URI="([^"]+)"', line)
            if not match:
                raise ValueError('Invalid initialization segment')
            init = urljoin(url, match[1])
        elif line.startswith('#EXT-X-KEY:') and 'METHOD=NONE' not in line:
            raise ValueError('Encrypted HLS is not supported')
        elif line.startswith('#EXT-X-BYTERANGE:') or 'BYTERANGE=' in line:
            raise ValueError('Byte-range HLS is not supported')
        elif line == '#EXT-X-DISCONTINUITY':
            discontinuity = True
            # A timestamp extrapolated from the old encoding cannot anchor a reset.
            # Keep a fresh tag if it precedes DISCONTINUITY for this same segment.
            if not pdt_explicit:
                pdt = None
        elif not line.startswith('#'):
            if duration is None or not math.isfinite(duration) or duration <= 0:
                raise ValueError('Invalid segment duration')
            segments.append({'seq': seq, 'url': urljoin(url, line), 'duration': duration,
                             'pdt': pdt, 'pdt_explicit': pdt_explicit,
                             'init': init, 'discontinuity': discontinuity})
            seq += 1
            if pdt is not None:
                pdt += duration
            duration = None
            discontinuity = False
            pdt_explicit = False
    return {'segments': segments, 'ended': '#EXT-X-ENDLIST' in lines}


class Store:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.RLock()
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS streams (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS detections (id TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL, sent_revision INTEGER NOT NULL DEFAULT 0)')
        self.db.execute('CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, reason TEXT NOT NULL)')
        self.db.commit()

    def stream(self, key):
        with self.lock:
            row = self.db.execute('SELECT payload FROM streams WHERE id=?', (key,)).fetchone()
            return json.loads(row[0]) if row else {}

    def checkpoint(self, key, state, detection=None):
        with self.lock, self.db:
            self.db.execute('INSERT INTO streams VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', (key, json.dumps(state)))
            if detection:
                payload = json.dumps(detection, sort_keys=True)
                old = self.db.execute('SELECT payload FROM detections WHERE id=?', (detection['detection_id'],)).fetchone()
                if not old or old[0] != payload:
                    self.db.execute('INSERT INTO detections(id,payload,revision) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=revision+1', (detection['detection_id'], payload))

    def pending(self):
        with self.lock:
            return [(json.loads(p), r) for p, r in self.db.execute('SELECT payload,revision FROM detections WHERE revision>sent_revision')]

    def sent(self, key, revision):
        with self.lock, self.db:
            self.db.execute('UPDATE detections SET sent_revision=max(sent_revision,?) WHERE id=?', (revision,key))
            self.db.execute('DELETE FROM issues WHERE id=?', (key,))

    def issue(self, key, reason):
        with self.lock, self.db:
            self.db.execute('INSERT INTO issues VALUES(?,?) ON CONFLICT(id) DO UPDATE SET reason=excluded.reason', (key,reason))

    def export(self, path):
        with self.lock:
            streams = {k: json.loads(p) for k,p in self.db.execute('SELECT id,payload FROM streams')}
            detections = [dict(json.loads(p), revision=r, sent_revision=s) for p,r,s in self.db.execute('SELECT payload,revision,sent_revision FROM detections')]
            issues = dict(self.db.execute('SELECT id,reason FROM issues'))
        for detection in detections:
            detection['pending_reason'] = issues.get(detection['detection_id'])
        path = Path(path)
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps({'streams': streams, 'detections': detections}, indent=2))
        tmp.replace(path)


def read_text(image, roi, whitelist=None):
    x,y,w,h = roi
    box = tuple(round(v) for v in (x*image.width,y*image.height,(x+w)*image.width,(y+h)*image.height))
    crop = ImageOps.grayscale(image.crop(box))
    crop = ImageOps.expand(crop.resize((crop.width*4,crop.height*4)), border=12, fill=255)
    buf = io.BytesIO()
    crop.save(buf, format='PNG')
    command = ['tesseract','stdin','stdout','--psm','7','-l','eng']
    if whitelist:
        command += ['-c', 'tessedit_char_whitelist='+whitelist]
    proc = subprocess.run(command, input=buf.getvalue(), capture_output=True, timeout=10,
                          env=dict(os.environ, OMP_THREAD_LIMIT='1'))
    if proc.returncode:
        raise RuntimeError('Tesseract failed')
    return proc.stdout.decode().strip()


def observations(segment_bytes, cfg, base):
    width, height = 854, 480
    step = cfg.get('sample_seconds', 2)
    with tempfile.TemporaryDirectory(prefix='fgc-live-') as temp:
        source = Path(temp)/'segment.mp4'
        source.write_bytes(segment_bytes)
        command = ['ffmpeg','-v','error','-i',str(source),'-an','-vf',
                   f'setpts=PTS-STARTPTS,fps=1/{step}:round=up,scale={width}:{height}',
                   '-f','rawvideo','-pix_fmt','rgb24','pipe:1']
        result = subprocess.run(command, capture_output=True, timeout=40)
        if result.returncode:
            raise RuntimeError('FFmpeg could not decode segment')
        size = width*height*3
        if len(result.stdout) % size:
            raise RuntimeError('Incomplete decoded image')
        for index in range(len(result.stdout)//size):
            image = Image.frombytes('RGB', (width,height), result.stdout[index*size:(index+1)*size])
            clock = read_text(image, cfg['clock_roi'], '0123456789:')
            match = re.fullmatch(r'(\d):([0-5]\d)', re.sub(r'\s','',clock))
            remaining = int(match[1])*60+int(match[2]) if match else None
            footer = read_text(image, cfg['identity_roi'])
            identity = re.search(cfg.get('overlay_pattern', r'Match\s*(\d+)\b(?:\s*[/|]?\s*Field\s*(\d+)\b)?'), footer, re.I)
            yield {'t': base+index*step, 'remaining': remaining,
                   'number': int(identity[1]) if identity else None,
                   'field': int(identity[2]) if identity and identity.lastindex and identity.lastindex >= 2 and identity[2] else None}


class Detector:
    def __init__(self, cfg, state):
        self.cfg, self.state = cfg, state
        self.state.setdefault('samples', [])

    def feed(self, obs):
        samples = self.state['samples']
        duration = self.cfg['match_duration']
        active = self.state.get('active')
        remaining = obs['remaining']
        if obs['number'] is None or (obs['field'] is not None and obs['field'] != self.cfg['field']) or remaining is None or not 0 <= remaining <= duration:
            return None
        if active and active['status'] == 'live':
            if obs['number'] != active['match_number']:
                if samples and samples[-1]['number'] != obs['number']:
                    samples.clear()
                samples.append(obs)
                del samples[:-8]
                if len(samples) < 3 or samples[-1]['t']-samples[0]['t'] < 4:
                    return None
                active['status'] = 'interrupted'
                samples.clear()
                return dict(active)
            if obs['t'] > active['expected_end']+8:
                active['status'] = 'interrupted'
                samples.clear()
                return dict(active)
            # Confirm zero near the end; a frozen zero long after the match is not evidence.
            if remaining == 0 and abs(obs['t']-active['expected_end']) <= 4:
                active['end_timestamp'] = round(active['expected_end'],3)
                active['status'] = 'complete'
                samples.clear()
                return dict(active)
        if not 0 < remaining < duration:
            return None
        end = obs['t']+remaining
        if samples and (obs['number'] != samples[-1]['number'] or obs['t']-samples[-1]['t'] > 12
                        or abs(end-statistics.median(v['t']+v['remaining'] for v in samples)) > 2):
            samples.clear()
        if active and active['status'] == 'live' and abs(end-active['expected_end']) > 3:
            active['status'] = 'interrupted'
            samples.clear()
            return dict(active)
        samples.append(obs)
        del samples[:-8]
        if len(samples) < 3 or samples[-1]['t']-samples[0]['t'] < 4 or samples[0]['remaining']-samples[-1]['remaining'] < 3:
            return None
        end = statistics.median(v['t']+v['remaining'] for v in samples)
        if active and abs(active['expected_end']-end) < 4:
            return None
        start = end-duration
        if start < 0:
            return None
        identity = f"{self.cfg['url']}|{self.cfg['field']}|{obs['number']}|{round(start)}"
        active = {'detection_id': hashlib.sha256(identity.encode()).hexdigest()[:32],
                  'url': self.cfg['url'], 'field': self.cfg['field'],
                  'match_number': obs['number'], 'event_key': self.cfg.get('event_key'),
                  'tournament_key': self.cfg.get('tournament_key'),
                  'name_pattern': self.cfg['name_pattern'], 'start_timestamp': round(start,3),
                  'end_timestamp': None, 'expected_end': end, 'status': 'live'}
        self.state['active'] = active
        return dict(active)


def matches_for(detection, rows):
    found = []
    for row in rows:
        data = row.get('data', {})
        name = re.fullmatch(detection['name_pattern'], str(data.get('name','')))
        if not name or int(name[1]) != detection['match_number']:
            continue
        if detection.get('event_key') and data.get('eventKey') != detection['event_key']:
            continue
        if detection.get('tournament_key') and str(data.get('tournamentKey')) != str(detection['tournament_key']):
            continue
        if not row.get('id'):
            continue
        found.append(row)
    return found


def reconcile(store, api_url, year, key):
    capability, _ = http(f'{api_url}/api/admin/video-capabilities', key=key)
    if json.loads(capability).get('liveVideoVersion') != 2:
        raise ValueError('Install the FGCScout live-video API patch before attaching videos')
    body, _ = http(f'{api_url}/api/GameData/{year}')
    rows = json.loads(body)
    if not isinstance(rows, list):
        raise ValueError('FGCScout season response must be an array')
    updates = 0
    for detection, revision in store.pending():
        candidates = matches_for(detection, rows)
        if len(candidates) != 1:
            # Keep detections pending when API data arrives late or identity is ambiguous.
            store.issue(detection['detection_id'], 'waiting_for_api_match' if not candidates else 'ambiguous_match')
            continue
        data = candidates[0]['data']
        start = math.floor(detection['start_timestamp'])
        query = {'t': start, 'start': start}
        if detection['end_timestamp'] is not None:
            query['end'] = math.ceil(detection['end_timestamp'])
        video_id = youtube_id(detection['url'])
        if not video_id:
            raise ValueError('Public recording URL must be a YouTube watch link')
        url = 'https://www.youtube.com/watch?v='+video_id+'&'+urlencode(query)
        payload = {'videoUrl':url,'startTimestamp':detection['start_timestamp'],
                   'endTimestamp':detection['end_timestamp'], 'status':detection['status'],
                   'detectionId':detection['detection_id'], 'onlyIfEmpty':True}
        # Repeated attempts are safe across transient failures and delayed API imports.
        if (data.get('videoDetectionId') == detection['detection_id'] and
            data.get('videoStatus') == detection['status'] and data.get('videoUrl') == url):
            store.sent(detection['detection_id'], revision)
            continue
        try:
            response, _ = http(f"{api_url}/api/admin/matches/{candidates[0]['id']}/video", payload, key)
            if json.loads(response).get('status') != detection['status']:
                raise ValueError('FGCScout did not confirm the requested video status')
        except HTTPError as exc:
            if exc.code in (404,409):
                store.issue(detection['detection_id'], 'waiting_for_api_match' if exc.code==404 else 'another_video_already_assigned')
                LOG.warning('Pending detection %s: API returned %s', detection['detection_id'],exc.code)
                continue
            raise
        store.sent(detection['detection_id'], revision)
        updates += 1
    return updates


def youtube_id(url):
    parsed = urlparse(url)
    if parsed.hostname in ('youtu.be','www.youtu.be'):
        value = parsed.path.strip('/')
    elif parsed.hostname in ('youtube.com','www.youtube.com','m.youtube.com'):
        from urllib.parse import parse_qs
        value = parse_qs(parsed.query).get('v',[''])[0]
        if not value and parsed.path.startswith('/live/'):
            value = parsed.path.split('/')[2]
    else:
        return None
    return value if re.fullmatch(r'[A-Za-z0-9_-]{11}',value) else None


def resolve(cfg):
    if cfg.get('hls_url'):
        return cfg['hls_url'], None
    command = [os.environ.get('YT_DLP','yt-dlp'),'--no-playlist','--dump-single-json',
               '-f','best[protocol^=m3u8][height=480]/bestvideo[protocol^=m3u8][height=480]/best[protocol^=m3u8][height>=480][height<=720]/bestvideo[protocol^=m3u8][height>=480][height<=720]',cfg['url']]
    result = subprocess.run(command, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError('yt-dlp could not resolve a live HLS stream')
    info = json.loads(result.stdout)
    if not info.get('is_live'):
        raise ValueError('This YouTube video is not live; use version 1 for archives')
    return info['url'], info.get('release_timestamp')


def media_playlist(url):
    for _ in range(4):
        body, final = http(url)
        data = playlist(body.decode(), final)
        if 'variant' not in data:
            return data
        url = data['variant']
    raise ValueError('Too many nested HLS playlists')


def segment_start(seg, cfg, state, origin):
    anchored = cfg.get('anchor_sequence') == seg['seq']
    absolute = seg['pdt'] is not None and origin is not None
    if seg['discontinuity'] and not anchored and not (absolute and seg.get('pdt_explicit')):
        raise ValueError('HLS discontinuity has no fresh UTC timestamp; configure a timeline anchor')
    if anchored:
        value = cfg['anchor_timestamp']
    elif absolute:
        value = seg['pdt']-origin
    elif seg['seq'] == state.get('next_sequence'):
        value = state['next_timestamp']
    elif seg['seq'] == 0:
        value = 0
    else:
        raise ValueError(f"Missing absolute video timeline at HLS sequence {seg['seq']}. Configure origin_utc or anchor_sequence/anchor_timestamp")
    if not math.isfinite(value) or value < 0:
        raise ValueError('Invalid video timeline anchor')
    return value


def stream_identity(cfg):
    return hashlib.sha256(f"{cfg['url']}|{cfg['field']}".encode()).hexdigest()[:20]


def stream_worker(cfg, store, stop=None):
    stop = STOP if stop is None else stop
    stream_id = stream_identity(cfg)
    state = store.stream(stream_id)
    detector = Detector(cfg, state)
    while not stop.is_set():
        try:
            source, release = resolve(cfg)
            origin = utc(cfg['origin_utc']) if cfg.get('origin_utc') else release
            resolved_at = time.monotonic()
            state['timeline_source'] = 'explicit_utc' if cfg.get('origin_utc') else 'youtube_release_timestamp' if release else 'segment_anchor'
            while not stop.is_set():
                data = media_playlist(source)
                segments = data['segments']
                if 'last_sequence' not in state and segments:
                    # Catch up from the available DVR window when timestamps are anchored.
                    # This recovers an initial match after delayed startup/temporary failure.
                    anchor = cfg.get('anchor_sequence')
                    if anchor is not None and any(s['seq']==anchor for s in segments):
                        segments = [s for s in segments if s['seq']>=anchor]
                    elif origin is None and segments[0]['seq'] != 0:
                        segments = segments[-12:]
                for seg in segments:
                    if stop.is_set():
                        return
                    if seg['seq'] <= state.get('last_sequence',-1):
                        continue
                    # YouTube can expose a short pre-roll before release_timestamp.
                    # Its negative time is not a seekable video timestamp; skip it,
                    # rather than pinning every retry to the first available segment.
                    if (origin is not None and seg['pdt'] is not None and seg['pdt'] < origin
                            and cfg.get('anchor_sequence') != seg['seq']):
                        state['last_sequence'] = seg['seq']
                        store.checkpoint(stream_id,state)
                        continue
                    base = segment_start(seg,cfg,state,origin)
                    raw, _ = http(seg['url'])
                    if seg['init']:
                        init, _ = http(seg['init'])
                        raw = init+raw
                    for obs in observations(raw,cfg,base):
                        if stop.is_set():
                            return
                        if obs['t'] <= state.get('last_video_timestamp', -1):
                            continue
                        detected = detector.feed(obs)
                        state['last_video_timestamp'] = obs['t']
                        state['status'] = 'watching'
                        state['updated_at_utc'] = datetime.now(timezone.utc).isoformat()
                        state.pop('error',None)
                        store.checkpoint(stream_id,state,detected)
                    state['last_sequence'] = seg['seq']
                    state['next_sequence'] = seg['seq']+1
                    state['next_timestamp'] = base+seg['duration']
                    store.checkpoint(stream_id,state)
                if data['ended']:
                    if state.get('active',{}).get('status')=='live':
                        state['active']['status']='interrupted'
                        store.checkpoint(stream_id,state,dict(state['active']))
                    state['status']='stream_ended'
                    store.checkpoint(stream_id,state)
                    return
                if time.monotonic()-resolved_at > 1800:
                    break
                stop.wait(2)
        except Exception as exc:
            state['status']='retrying'
            # Do not log signed stream URLs, credentials or raw HTTP response bodies.
            state['error'] = f'{type(exc).__name__}: '+(str(exc) if isinstance(exc,ValueError) else 'stream access/decoding failed')
            store.checkpoint(stream_id,state)
            LOG.warning('Field %s: %s',cfg['field'],state['error'])
            stop.wait(15)


def validate(config):
    if not isinstance(config.get('streams'),list) or not config['streams']:
        raise ValueError('Configure at least one field stream')
    if not isinstance(config.get('year'),int) or not 2017 <= config['year'] <= 2100:
        raise ValueError('Configure a valid season year')
    fields = set()
    for cfg in config['streams']:
        if not isinstance(cfg.get('field'),int) or cfg['field'] < 1 or cfg['field'] in fields:
            raise ValueError('Each stream needs a unique positive field number')
        fields.add(cfg['field'])
        if not youtube_id(cfg.get('url','')):
            raise ValueError('Each field needs a valid public YouTube watch/live URL')
        cfg.setdefault('name_pattern',r'(?:Qualification|Ranking) Match (\d+)')
        cfg.setdefault('clock_roi',[.447,.800,.108,.075])
        cfg.setdefault('identity_roi',[.32,.958,.122,.037])
        cfg.setdefault('match_duration',150)
        cfg.setdefault('sample_seconds',2)
        if not 1 <= cfg['sample_seconds'] <= 4 or not 30 <= cfg['match_duration'] <= 600:
            raise ValueError('Invalid sampling interval or match duration')
        if re.compile(cfg['name_pattern']).groups != 1 or re.compile(cfg.get('overlay_pattern',r'Match\s*(\d+)\s*[/|]?\s*Field\s*(\d+)')).groups != 2:
            raise ValueError('Name regex needs one capture; overlay regex needs two captures')
        for roi in (cfg['clock_roi'],cfg['identity_roi']):
            x,y,w,h = roi
            if not all(math.isfinite(v) for v in roi) or not (x>=0 and y>=0 and w>0 and h>0 and x+w<=1 and y+h<=1):
                raise ValueError('ROI must fit inside normalized image bounds')
        if ('anchor_sequence' in cfg) != ('anchor_timestamp' in cfg):
            raise ValueError('Set both sequence and timestamp for a segment anchor')
        if 'anchor_sequence' in cfg and (not isinstance(cfg['anchor_sequence'],int) or cfg['anchor_sequence']<0
                                       or not math.isfinite(cfg['anchor_timestamp']) or cfg['anchor_timestamp']<0):
            raise ValueError('Invalid segment anchor')
        if cfg.get('origin_utc'):
            utc(cfg['origin_utc'])
    base = config.get('api_url','').rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Configure the FGCScout API URL without embedded credentials')
    if parsed.scheme == 'http' and parsed.hostname not in ('127.0.0.1','localhost','backend'):
        raise ValueError('Use HTTPS for a remote FGCScout API')
    if config.get('api_poll_seconds',15) < 5:
        raise ValueError('API polling must be at least five seconds')
    return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',default='config.json')
    parser.add_argument('--check',action='store_true',help='Validate config without contacting streams/API')
    parser.add_argument('--probe',action='store_true',help='Inspect stream timeline anchors without writing to FGCScout')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    base = validate(config)
    if args.check:
        print('Configuration valid')
        return
    if args.probe:
        for cfg in config['streams']:
            source, release = resolve(cfg)
            segments = media_playlist(source)['segments']
            print(json.dumps({'field':cfg['field'],'release_timestamp':release,
                              'segments':[{'sequence':s['seq'],'duration':s['duration'],'program_date_time':s['pdt']} for s in segments[-3:]]}))
        return
    key = os.environ.get('FGCSCOUT_ADMIN_API_KEY')
    if not key:
        parser.error('Set FGCSCOUT_ADMIN_API_KEY in the environment')
    store = Store(config.get('state_file','state/live.sqlite3'))
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
    threads = [threading.Thread(target=stream_worker,args=(cfg,store),daemon=True) for cfg in config['streams']]
    for thread in threads:
        thread.start()
    try:
        while not STOP.is_set():
            try:
                updates = reconcile(store,base,config['year'],key)
                if updates:
                    LOG.info('Attached/updated %s match videos',updates)
            except Exception as exc:
                LOG.warning('API sync retry: %s',type(exc).__name__)
            store.export(Path(config.get('state_file','state/live.sqlite3')).with_suffix('.json'))
            STOP.wait(config.get('api_poll_seconds',15))
    except KeyboardInterrupt:
        STOP.set()
    finally:
        for thread in threads:
            thread.join(timeout=3)
        store.export(Path(config.get('state_file','state/live.sqlite3')).with_suffix('.json'))


if __name__ == '__main__':
    main()
