#!/usr/bin/env python3
"""Detect FGC 2025 matches from the broadcast countdown. Python stdlib only.

External programs: current yt-dlp, ffmpeg, ffprobe, tesseract.
The OCR ROI is calibrated to the supplied FGC 2025 individual field streams.
"""
import argparse
from collections import Counter
import concurrent.futures
import json
import re
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

PLAYLIST = 'https://www.youtube.com/playlist?list=PL-RL-gR4GAfdUMblMbZmF_AsT5X9M4ppt'
ROI = (0.447, 0.800, 0.108, 0.075)
IDENTITY_ROI = (0.32, 0.958, 0.122, 0.037)
WIDTH, HEIGHT = 360, 180


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def run(command):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-2500:] or result.stdout[-2500:])
    return result.stdout


def parse_clock(text):
    text = re.sub(r'\s', '', text)
    if not re.fullmatch(r'[0-2]:[0-5][0-9]', text):
        return None
    minutes, seconds = map(int, text.split(':'))
    value = minutes * 60 + seconds
    return value if 0 <= value <= 150 else None


def ocr(frame):
    pgm = f'P5\n{WIDTH} {HEIGHT}\n255\n'.encode() + frame
    result = subprocess.run(
        ['tesseract', 'stdin', 'stdout', '--psm', '7', '-l', 'eng',
         '-c', 'tessedit_char_whitelist=0123456789:'],
        input=pgm, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace'))
    text = result.stdout.decode().strip()
    return parse_clock(text), text


def scan(video, step, roi, workers, cache, offset=0, start=0, length=None):
    signature = {'video_size': video.stat().st_size, 'step': step,
                 'roi': roi, 'offset': offset, 'start': start, 'length': length,
                 'version': 1}
    if cache.exists():
        old = json.loads(cache.read_text())
        if old.get('signature') == signature:
            return old['samples']
    x, y, w, h = roi
    # fps is applied before cropping; frame timestamps are spaced by step.
    vf = (f'fps=1/{step}:round=up,crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},'
          f'scale={WIDTH}:{HEIGHT}:flags=lanczos,format=gray')
    command = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', str(video)]
    if length is not None:
        command += ['-t', str(length)]
    command += ['-an', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1']
    samples = []
    frame_size = WIDTH * HEIGHT
    error_path = cache.with_suffix('.ffmpeg.log')
    error_path.parent.mkdir(parents=True, exist_ok=True)
    with error_path.open('wb') as error_log, concurrent.futures.ThreadPoolExecutor(workers) as pool:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=error_log)
        pending = []
        index = 0
        try:
            while True:
                frame = bytearray()
                while len(frame) < frame_size:
                    chunk = process.stdout.read(frame_size - len(frame))
                    if not chunk:
                        break
                    frame.extend(chunk)
                if not frame:
                    break
                if len(frame) != frame_size:
                    raise RuntimeError('Incomplete frame from ffmpeg')
                pending.append((offset + start + index * step, pool.submit(ocr, bytes(frame))))
                index += 1
                if len(pending) >= workers * 3:
                    t, future = pending.pop(0)
                    remaining, text = future.result()
                    samples.append({'t': t, 'remaining': remaining, 'text': text})
                    if len(samples) % 300 == 0:
                        print(f'  OCR: {t / 3600:.2f} h', flush=True)
            for t, future in pending:
                remaining, text = future.result()
                samples.append({'t': t, 'remaining': remaining, 'text': text})
            if process.wait():
                raise RuntimeError(error_path.read_text()[-2500:])
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
                process.wait()
    save(cache, {'signature': signature, 'samples': samples})
    return samples


def detect(samples, duration=150, step=10, min_hits=4):
    """A running countdown has t + remaining approximately constant.

    Frozen pre-match clocks and scores cannot pass the decreasing-clock check.
    Failed/sparse runs are returned separately, never promoted to matches.
    """
    groups = []
    for s in samples:
        remaining = s.get('remaining')
        if remaining is None or not 0 < remaining < duration:
            continue
        end = s['t'] + remaining
        group = next((g for g in reversed(groups)
                      if s['t'] - g[-1]['t'] <= step * 4
                      and abs(end - statistics.median(v['t'] + v['remaining'] for v in g)) <= 2), None)
        if group is None:
            groups.append([s])
        else:
            group.append(s)
    matches, rejected = [], []
    for g in groups:
        span = g[-1]['t'] - g[0]['t']
        drop = g[0]['remaining'] - g[-1]['remaining']
        if len(g) < min_hits or span < 30 or drop < 25:
            if len(g) >= 2:
                rejected.append({'first_timestamp': g[0]['t'], 'last_timestamp': g[-1]['t'],
                                 'clock_observations': len(g), 'reason': 'insufficient countdown evidence'})
            continue
        ends = [s['t'] + s['remaining'] for s in g]
        end = statistics.median(ends)
        start = end - duration
        if start < 0:
            rejected.append({'first_timestamp': g[0]['t'], 'reason': 'match starts before recording'})
            continue
        matches.append({'start_timestamp': round(start, 3), 'end_timestamp': round(end, 3),
                        'clock_observations': len(g), 'clock_spread_seconds': round(max(ends)-min(ends), 3)})
    matches.sort(key=lambda m: m['start_timestamp'])
    # Overlapping countdown groups indicate an interruption or inconsistent OCR.
    clean = []
    for m in matches:
        if clean and m['start_timestamp'] < clean[-1]['end_timestamp']:
            previous = clean.pop()
            rejected.append({'first_timestamp': previous['start_timestamp'],
                             'last_timestamp': m['end_timestamp'], 'reason': 'overlapping countdown groups'})
        else:
            clean.append(m)
    return clean, rejected


def parse_identity(text):
    match = re.search(r'\bMatch\s*(\d+)\s*[/|]?\s*Field\s*(\d+)\b', text, re.I)
    if not match:
        return None
    number, field = map(int, match.groups())
    return (number, field) if number > 0 and 1 <= field <= 100 else None


def identity_consensus(samples, expected_field=None):
    identities = Counter(value for sample in samples
                         if (value := parse_identity(sample['text'])) is not None)
    # Repeated evidence inside the running match; never infer identity from order.
    if not identities:
        return None, 'unreadable match/field overlay'
    if len(identities) != 1:
        return None, 'conflicting match/field observations'
    (number, field), hits = identities.most_common(1)[0]
    if hits < 3:
        return None, 'fewer than three matching identity observations'
    if expected_field is not None and field != expected_field:
        return None, 'overlay field differs from stream field'
    return {'match_number': number, 'field': field}, None


def identify(video, match, roi, cache, offset=0, expected_field=None):
    # Sample five interior frames, away from overlay transitions at game boundaries.
    times = [match['start_timestamp'] + (match['end_timestamp'] - match['start_timestamp']) * fraction
             for fraction in (.15, .3, .5, .7, .85)]
    signature = {'video_size': video.stat().st_size, 'video_mtime_ns': video.stat().st_mtime_ns,
                 'roi': roi, 'times': times, 'offset': offset, 'version': 1}
    samples = None
    if cache.exists():
        old = json.loads(cache.read_text())
        if old.get('signature') == signature:
            samples = old['samples']
    if samples is None:
        samples = []
        x, y, w, h = roi
        vf = (f'crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},'
              'scale=1000:180:flags=lanczos,format=gray')
        for timestamp in times:
            if timestamp < offset:
                continue
            frame = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(timestamp - offset),
                                    '-i', str(video), '-frames:v', '1', '-vf', vf,
                                    '-f', 'image2pipe', '-vcodec', 'pgm', 'pipe:1'],
                                   capture_output=True, timeout=40)
            if frame.returncode or not frame.stdout:
                raise RuntimeError('Could not decode match identity frame')
            result = subprocess.run(['tesseract', 'stdin', 'stdout', '--psm', '7', '-l', 'eng'],
                                    input=frame.stdout, capture_output=True, timeout=15)
            if result.returncode:
                raise RuntimeError('Could not read match identity frame')
            samples.append({'t': round(timestamp, 3), 'text': result.stdout.decode().strip()})
        save(cache, {'signature': signature, 'samples': samples})
    identity, reason = identity_consensus(samples, expected_field)
    return identity, {'observations': samples, 'review_reason': reason}


def download(entry, args):
    target = args.cache / 'videos'
    target.mkdir(parents=True, exist_ok=True)
    existing = [p for p in target.glob(entry['id'] + '.*') if p.suffix in ('.mp4', '.webm', '.mkv')]
    if existing:
        # A completed yt-dlp rename excludes .part files; ffprobe checks readability.
        run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nw=1:nk=1', str(existing[0])])
        return existing[0]
    command = [args.yt_dlp, '--no-playlist', '--no-progress',
               '-f', 'bestvideo[height=480]/bestvideo[height<=720][height>=480]/best[height<=720][height>=480]',
               '-o', str(target / '%(id)s.%(ext)s')]
    if args.cookies_browser:
        command += ['--cookies-from-browser', args.cookies_browser]
    command += [entry['url']]
    log = args.cache / (entry['id'] + '.download.log')
    with log.open('w') as out:
        result = subprocess.run(command, stdout=out, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f'Video download failed; see {log}\n' + log.read_text()[-1500:])
    found = [p for p in target.glob(entry['id'] + '.*') if p.suffix in ('.mp4', '.webm', '.mkv')]
    if not found:
        raise RuntimeError('yt-dlp did not create a video file')
    return found[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('playlist.json'))
    parser.add_argument('--playlist', help='Fetch the current playlist instead of the supplied manifest')
    parser.add_argument('--output', type=Path, default=Path('results'))
    parser.add_argument('--cache', type=Path, default=Path('cache'))
    sibling = Path(sys.executable).parent / 'yt-dlp'
    parser.add_argument('--yt-dlp', default=str(sibling) if sibling.exists() else 'yt-dlp')
    parser.add_argument('--cookies-browser', help='Optional, explicit browser name for yt-dlp authentication')
    parser.add_argument('--video-id', help='Process only this video ID')
    parser.add_argument('--local-video', type=Path, help='Use a downloaded recording with --video-id')
    parser.add_argument('--offset', type=float, default=0, help='Original timestamp of first frame in local excerpt')
    parser.add_argument('--step', type=float, default=10)
    parser.add_argument('--duration', type=float, default=150)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--roi', type=float, nargs=4, default=list(ROI), metavar=('X','Y','W','H'))
    parser.add_argument('--identity-roi', type=float, nargs=4, default=list(IDENTITY_ROI), metavar=('X','Y','W','H'))
    parser.add_argument('--event-key', help='Optional event key to disambiguate matches when importing')
    parser.add_argument('--tournament-key', help='Optional tournament key to disambiguate matches when importing')
    args = parser.parse_args()
    if not 1 <= args.step <= 15 or args.workers < 1 or args.duration <= 30:
        parser.error('step must be 1..15, workers >= 1, duration > 30')
    for x, y, w, h in (args.roi, args.identity_roi):
        if not (x >= 0 and y >= 0 and w > 0 and h > 0 and x+w <= 1 and y+h <= 1):
            parser.error('ROI must lie inside normalized frame bounds 0..1')
    if args.local_video and not args.video_id:
        parser.error('--local-video requires --video-id')
    for program in ('ffmpeg', 'ffprobe', 'tesseract') + (() if args.local_video else (args.yt_dlp,)):
        if not shutil.which(program):
            parser.error(f'Missing executable: {program}')
    args.cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    if args.playlist:
        data = json.loads(run([args.yt_dlp, '--flat-playlist', '-J', args.playlist]))
        entries = []
        for v in data.get('entries', []):
            title = v.get('title', '')
            m = re.search(r'Day\s*(\d+).*Field\s*(\d+)', title, re.I)
            entries.append({'id': v['id'], 'url': f"https://www.youtube.com/watch?v={v['id']}",
                            'day': int(m[1]) if m else None, 'field': int(m[2]) if m else None})
        save(args.cache / 'playlist.json', entries)
    else:
        entries = json.loads(args.manifest.read_text())
    if args.video_id:
        entries = [v for v in entries if v['id'] == args.video_id]
    if not entries:
        parser.error('No matching videos in manifest')
    all_matches, report = [], {'streams': [], 'errors': [], 'method': 'countdown_ocr',
                               'timestamp_unit': 'seconds', 'boundary_uncertainty_seconds': 2,
                               'completeness_verified': False}
    for entry in entries:
        print(f"Day {entry['day']}, field {entry['field']}: {entry['id']}", flush=True)
        try:
            video = args.local_video or download(entry, args)
            samples = scan(video, args.step, args.roi, args.workers,
                           args.cache / (entry['id'] + '.ocr.json'), offset=args.offset)
            found, rejected = detect(samples, args.duration, args.step)
            detailed = []
            for index, match in enumerate(found, 1):
                # Stable filename by timestamp preserves replays as separate recordings.
                record = {'url': entry['url'], 'start_timestamp': match['start_timestamp'],
                          'end_timestamp': match['end_timestamp']}
                try:
                    identity, evidence = identify(video, match, args.identity_roi,
                        args.cache / f"{entry['id']}_{match['start_timestamp']:.3f}.identity.json",
                        offset=args.offset, expected_field=entry.get('field'))
                except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as exc:
                    # Keep valid timestamps even if identity decoding fails for this match.
                    identity, evidence = None, {'observations': [],
                        'review_reason': f'identity scan failed: {type(exc).__name__}'}
                if identity:
                    record.update(identity)
                    if args.event_key:
                        record['event_key'] = args.event_key
                    if args.tournament_key:
                        record['tournament_key'] = args.tournament_key
                filename = f"{entry['id']}_{match['start_timestamp']:.3f}.json"
                save(args.output / 'matches' / filename, record)
                all_matches.append(record)
                detailed.append({**record, **match, 'identity': evidence,
                                 'file': filename, 'sequence_in_stream': index})
                if not identity:
                    rejected.append({'first_timestamp': match['start_timestamp'],
                                     'reason': evidence['review_reason']})
            stream_report = {**entry, 'matches_detected': len(found), 'matches': detailed,
                             'samples': len(samples), 'readable_clocks': sum(s['remaining'] is not None for s in samples),
                             'review_candidates': rejected,
                             'status': ('needs_review_no_matches' if not found else
                                        'needs_review_identity' if any(m['identity']['review_reason'] for m in detailed)
                                        else 'processed')}
            report['streams'].append(stream_report)
            print(f'  {len(found)} matches; {len(rejected)} review candidates', flush=True)
        except (RuntimeError, OSError, ValueError) as exc:
            report['errors'].append({'video_id': entry['id'], 'error': str(exc)})
            print(f"  ERROR: {exc}", file=sys.stderr, flush=True)
        save(args.output / 'matches.json', all_matches)
        save(args.output / 'report.json', report)
    print(f'{len(all_matches)} matches -> {args.output.resolve() / "matches.json"}')
    # Processing every stream is not evidence that every match was detected.
    # Confirm coverage against an independent match schedule before claiming completeness.
    return 2 if report['errors'] or any(v['status'].startswith('needs_review') for v in report['streams']) else 0


if __name__ == '__main__':
    sys.exit(main())
