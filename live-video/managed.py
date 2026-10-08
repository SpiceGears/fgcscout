#!/usr/bin/env python3
"""Run persistent live-video workers from server-side admin configurations."""
import argparse
import json
import logging
import os
from pathlib import Path
import signal
import threading

from worker import STOP, Store, http, reconcile, stream_identity, stream_worker, validate

LOG = logging.getLogger('fgc-managed')


def stream_config(stream):
    cfg = {'field': stream['field'], 'url': stream['url'],
           'match_duration': stream.get('matchDuration', 150),
           'clock_roi': stream.get('clockRoi', [.447, .800, .108, .075]),
           'identity_roi': stream.get('identityRoi', [.32, .958, .122, .037])}
    for public, private in [('eventKey', 'event_key'), ('tournamentKey', 'tournament_key'), ('originUtc', 'origin_utc')]:
        if stream.get(public):
            cfg[private] = stream[public]
    return cfg


class Supervisor:
    def __init__(self, api_url, key, state_dir):
        self.api_url, self.key = api_url.rstrip('/'), key
        self.path = Path(state_dir)
        self.path.mkdir(parents=True, exist_ok=True)
        self.stores = {}
        self.running = {}
        self.retiring = []

    def apply(self, configurations):
        desired = {}
        for config in configurations:
            year = config['year']
            if config.get('enabled'):
                parsed = {'year': year, 'api_url': self.api_url,
                          'streams': [stream_config(s) for s in config['streams']]}
                validate(parsed)
                for stream in parsed['streams']:
                    signature = json.dumps(stream, sort_keys=True)
                    desired[(year, stream['field'])] = (signature, stream)
        for identity, (signature, thread, stop) in list(self.running.items()):
            if identity not in desired or signature != desired[identity][0]:
                stop.set()
                self.retiring.append((identity, thread))
                del self.running[identity]
        self.retiring = [(identity, thread) for identity, thread in self.retiring if thread.is_alive()]
        for identity, (signature, stream) in desired.items():
            if identity in self.running or any(old == identity for old, _ in self.retiring):
                continue
            if identity[0] not in self.stores:
                self.stores[identity[0]] = Store(self.path/f'season-{identity[0]}.sqlite3')
            store = self.stores[identity[0]]
            stop = threading.Event()
            thread = threading.Thread(target=stream_worker, args=(stream, store, stop), daemon=True)
            self.running[identity] = (signature, thread, stop)
            thread.start()

    def status(self, config):
        store = self.stores.get(config['year'])
        statuses = []
        for stream in config['streams']:
            identity = (config['year'], stream['field'])
            stream_id = stream_identity(stream)
            state = store.stream(stream_id) if store else {}
            status = 'paused' if not config['enabled'] else state.get('status', 'starting')
            if any(old == identity and thread.is_alive() for old, thread in self.retiring):
                status = 'restarting'
            statuses.append({'field': stream['field'], 'status': status,
                             'error': state.get('error'), 'lastVideoTimestamp': state.get('last_video_timestamp')})
        return statuses

    def cycle(self, configurations):
        self.apply(configurations)
        for config in configurations:
            year = config['year']
            # Reconcile saved detections even after the operator pauses watching.
            if year not in self.stores and (self.path/f'season-{year}.sqlite3').exists():
                self.stores[year] = Store(self.path/f'season-{year}.sqlite3')
            store = self.stores.get(year)
            error = None
            if store:
                try:
                    reconcile(store, self.api_url, year, self.key)
                except Exception as exc:
                    error = f'API synchronization retry: {type(exc).__name__}'
                store.export(self.path/f'season-{year}.json')
            payload = {'revision': config['revision'], 'pendingCount': len(store.pending()) if store else 0,
                       'error': error, 'streams': self.status(config)}
            try:
                http(f'{self.api_url}/api/admin/seasons/{year}/live-video/status', payload, self.key)
            except Exception as exc:
                LOG.warning('Season %s heartbeat retry: %s', year, type(exc).__name__)

    def close(self):
        STOP.set()
        for _, thread, stop in self.running.values():
            stop.set()
        for _, thread, _ in self.running.values():
            thread.join(timeout=3)
        for year, store in self.stores.items():
            store.export(self.path/f'season-{year}.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default=os.environ.get('FGCSCOUT_API_URL', 'http://backend'))
    parser.add_argument('--state-dir', default='state')
    args = parser.parse_args()
    key = os.environ.get('FGCSCOUT_ADMIN_API_KEY')
    if not key:
        parser.error('Set FGCSCOUT_ADMIN_API_KEY')
    # Use the same credential destination validation as the standalone worker.
    validate({'year': 2026, 'api_url': args.api_url,
              'streams': [{'field': 1, 'url': 'https://www.youtube.com/watch?v=Hy2VGJjoMoo'}]})
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    manager = Supervisor(args.api_url, key, args.state_dir)
    cache = manager.path/'managed-configurations.json'
    configurations = json.loads(cache.read_text()) if cache.exists() else []
    try:
        while not STOP.is_set():
            try:
                body, _ = http(f'{manager.api_url}/api/admin/live-video/configurations', key=key)
                fresh = json.loads(body)
                if not isinstance(fresh, list):
                    raise ValueError('Invalid configuration response')
                temporary = cache.with_suffix('.tmp')
                temporary.write_text(json.dumps(fresh))
                temporary.replace(cache)
                configurations = fresh
            except Exception as exc:
                LOG.warning('Configuration fetch retry: %s; using last saved settings', type(exc).__name__)
            try:
                manager.cycle(configurations)
            except Exception as exc:
                LOG.warning('Worker cycle retry: %s', type(exc).__name__)
            STOP.wait(20)
    finally:
        manager.close()


if __name__ == '__main__':
    main()
