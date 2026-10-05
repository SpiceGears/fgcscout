import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import managed
import worker


class ManagedTests(unittest.TestCase):
    def setUp(self):
        worker.STOP.clear()
        self.temp = tempfile.TemporaryDirectory()
        self.manager = managed.Supervisor('http://localhost', 'test-key', self.temp.name)
        self.config = {'year': 2026, 'enabled': True, 'revision': 1,
                       'streams': [{'field': 1, 'url': 'https://www.youtube.com/watch?v=Hy2VGJjoMoo', 'matchDuration': 150}]}
        self.started = threading.Event()
        def watch(cfg, store, stop):
            self.started.set()
            stop.wait(5)
        self.patch = patch.object(managed, 'stream_worker', watch)
        self.patch.start()

    def tearDown(self):
        self.manager.close()
        for store in self.manager.stores.values():
            store.db.close()
        self.patch.stop()
        self.temp.cleanup()
        worker.STOP.clear()

    def test_saved_configuration_start_pause_and_restart(self):
        self.manager.apply([self.config])
        self.assertTrue(self.started.wait(1))
        original = self.manager.running[(2026, 1)][1]
        self.manager.apply([self.config])
        self.assertIs(self.manager.running[(2026, 1)][1], original)
        disabled = dict(self.config, enabled=False, revision=2)
        self.manager.apply([disabled])
        original.join(1)
        self.assertFalse(original.is_alive())
        self.assertEqual(self.manager.status(disabled)[0]['status'], 'paused')
        self.manager.apply([self.config])
        self.assertIsNot(self.manager.running[(2026, 1)][1], original)

    def test_paused_queue_survives_restart_and_api_failure(self):
        self.manager.apply([self.config])
        store = self.manager.stores[2026]
        record = {'detection_id': 'pending-record', 'status': 'complete'}
        store.checkpoint('stream', {}, record)
        self.manager.close()
        store.db.close()
        worker.STOP.clear()
        self.manager = managed.Supervisor('http://localhost', 'test-key', self.temp.name)
        disabled = dict(self.config, enabled=False, revision=2)
        messages = []
        def heartbeat(url, payload=None, key=None):
            messages.append(payload)
            return b'{"accepted":true}', url
        with patch.object(managed, 'reconcile', side_effect=OSError('offline')), patch.object(managed, 'http', heartbeat):
            self.manager.cycle([disabled])
        self.assertEqual(len(self.manager.stores[2026].pending()), 1)
        self.assertEqual(messages[0]['pendingCount'], 1)
        self.assertEqual(messages[0]['streams'][0]['status'], 'paused')
        self.assertIn('OSError', messages[0]['error'])
        snapshot = json.loads((Path(self.temp.name)/'season-2026.json').read_text())
        self.assertEqual(snapshot['detections'][0]['detection_id'], 'pending-record')

    def test_field_configuration_conversion(self):
        config = managed.stream_config(dict(self.config['streams'][0], eventKey='FGC_2026', originUtc='2026-10-07T00:00:00Z'))
        self.assertEqual(config['event_key'], 'FGC_2026')
        self.assertEqual(config['origin_utc'], '2026-10-07T00:00:00Z')
        self.assertEqual(config['match_duration'], 150)


if __name__ == '__main__':
    unittest.main()
