import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import worker


class LiveTests(unittest.TestCase):
    def setUp(self):
        self.cfg={'url':'https://www.youtube.com/watch?v=Hy2VGJjoMoo','field':1,
                  'match_duration':150,'name_pattern':r'Qualification Match (\d+)'}

    def active(self, detector):
        for t,r in [(100,150),(102,148),(104,146),(106,144)]:
            result=detector.feed({'t':t,'remaining':r,'number':1,'field':1})
        return result

    def test_clock_and_end(self):
        state={};detector=worker.Detector(self.cfg,state)
        for t in range(0,100,2):
            self.assertIsNone(detector.feed({'t':t,'remaining':150,'number':1,'field':1}))
        record=self.active(detector)
        self.assertEqual(record['start_timestamp'],100)
        self.assertIsNone(record['end_timestamp'])
        record=detector.feed({'t':250,'remaining':0,'number':1,'field':1})
        self.assertEqual(record['status'],'complete')
        self.assertEqual(record['end_timestamp'],250)

    def test_wrong_field_and_single_bad_identity(self):
        detector=worker.Detector(self.cfg,{})
        self.active(detector)
        self.assertIsNone(detector.feed({'t':108,'remaining':142,'number':9,'field':2}))
        self.assertIsNone(detector.feed({'t':108,'remaining':142,'number':9,'field':1}))
        self.assertIsNone(detector.feed({'t':110,'remaining':140,'number':1,'field':1}))
        self.assertEqual(detector.state['active']['status'],'live')

    def test_paused_clock_is_interrupted(self):
        detector=worker.Detector(self.cfg,{})
        self.active(detector)
        result=detector.feed({'t':112,'remaining':144,'number':1,'field':1})
        self.assertEqual(result['status'],'interrupted')
        self.assertIsNone(result['end_timestamp'])

    def test_hls_timeline_and_gap(self):
        text='#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:10\n#EXT-X-PROGRAM-DATE-TIME:2026-10-07T10:00:10Z\n#EXTINF:4,\na.ts\n#EXTINF:3.5,\nb.ts\n'
        segs=worker.playlist(text,'https://example.test/field/index.m3u8')['segments']
        origin=worker.utc('2026-10-07T10:00:00Z')
        self.assertEqual(worker.segment_start(segs[0],{}, {},origin),10)
        self.assertEqual(worker.segment_start(segs[1],{}, {},origin),14)
        self.assertEqual(segs[1]['url'],'https://example.test/field/b.ts')
        segs[0]['pdt']=None
        with self.assertRaises(ValueError):worker.segment_start(segs[0],{}, {},None)
        self.assertEqual(worker.segment_start(segs[0],{'anchor_sequence':10,'anchor_timestamp':120},{},None),120)
        with self.assertRaises(ValueError):worker.segment_start(segs[1],{}, {'next_sequence':10,'next_timestamp':120},None)

    def test_matching_real_greece_and_ambiguity(self):
        source=json.loads((Path(__file__).parents[1]/'data.json').read_text())['matches']
        rows=[{'id':'mongo-'+str(m['id']),'data':m} for m in source]
        detection=self.active(worker.Detector(self.cfg,{}))
        self.assertEqual(worker.matches_for(detection,rows)[0]['data']['id'],1)
        self.assertEqual(len(worker.matches_for(detection,rows)),1)
        self.assertEqual(len(worker.matches_for(dict(detection,field=2),rows)),1)
        self.assertEqual(len(worker.matches_for(detection,rows+[rows[0]])),2)

    def test_number_without_overlay_field(self):
        detector = worker.Detector(self.cfg, {})
        for t, r in [(100, 150), (102, 148), (104, 146), (106, 144)]:
            record = detector.feed({'t': t, 'remaining': r, 'number': 1, 'field': None})
        self.assertEqual(record['match_number'], 1)
        rows = [{'id': 'mongo', 'data': {'name': 'Qualification Match 1'}}]
        self.assertEqual(len(worker.matches_for(record, rows)), 1)
        self.assertEqual(len(worker.matches_for(record, rows + rows)), 2)

    def test_late_api_persistence_and_completion(self):
        with tempfile.TemporaryDirectory() as temp:
            store=worker.Store(Path(temp)/'state.sqlite3')
            state={};detector=worker.Detector(self.cfg,state)
            detection=self.active(detector)
            store.checkpoint('stream',state,detection)
            store.db.close()
            store=worker.Store(Path(temp)/'state.sqlite3')
            self.addCleanup(store.db.close)
            rows=[];calls=[]
            def fake_http(url,payload=None,key=None):
                if url.endswith('video-capabilities'):return json.dumps({'liveVideoVersion':2}).encode(),url
                if payload is None:return json.dumps(rows).encode(),url
                calls.append(payload)
                return json.dumps({'status':payload['status']}).encode(),url
            with patch.object(worker,'http',fake_http):
                self.assertEqual(worker.reconcile(store,'http://localhost',2024,'test'),0)
                self.assertEqual(len(store.pending()),1)
                rows.append({'id':'mongo-1','data':{'name':'Qualification Match 1','field':1}})
                self.assertEqual(worker.reconcile(store,'http://localhost',2024,'test'),1)
                self.assertEqual(calls[0]['status'],'live')
                self.assertIsNone(calls[0]['endTimestamp'])
                complete=detector.feed({'t':250,'remaining':0,'number':1,'field':1})
                store.checkpoint('stream',state,complete)
                self.assertEqual(worker.reconcile(store,'http://localhost',2024,'test'),1)
                self.assertEqual(calls[-1]['endTimestamp'],250)
                self.assertEqual(calls[-1]['status'],'complete')
                self.assertTrue(calls[-1]['onlyIfEmpty'])
                self.assertEqual(store.pending(),[])

    def test_conflict_remains_pending(self):
        with tempfile.TemporaryDirectory() as temp:
            store=worker.Store(Path(temp)/'s.sqlite3')
            self.addCleanup(store.db.close)
            detection=self.active(worker.Detector(self.cfg,{}))
            store.checkpoint('s',{},detection)
            def fake_http(url,payload=None,key=None):
                if url.endswith('video-capabilities'):return b'{"liveVideoVersion":2}',url
                if payload is None:return b'[{"id":"m","data":{"name":"Qualification Match 1","field":1}}]',url
                raise HTTPError(url,409,'Conflict',{},None)
            with patch.object(worker,'http',fake_http):
                self.assertEqual(worker.reconcile(store,'http://localhost',2024,'test'),0)
                self.assertEqual(len(store.pending()),1)


if __name__=='__main__':unittest.main()
