import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import parse_qs, urlparse
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

    def test_discontinuity_uses_fresh_utc_instead_of_stalling(self):
        origin=worker.utc('2026-10-09T00:00:00Z')
        for tags in ('#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:2026-10-09T00:02:00Z',
                     '#EXT-X-PROGRAM-DATE-TIME:2026-10-09T00:02:00Z\n#EXT-X-DISCONTINUITY'):
            text=f'#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:20\n{tags}\n#EXTINF:5,\na.ts\n'
            segment=worker.playlist(text,'https://example.test/live.m3u8')['segments'][0]
            self.assertTrue(segment['pdt_explicit'])
            self.assertEqual(worker.segment_start(segment,{}, {'next_sequence':20,'next_timestamp':100},origin),120)

    def test_discontinuity_never_reuses_extrapolated_time(self):
        text='#EXTM3U\n#EXT-X-PROGRAM-DATE-TIME:2026-10-09T00:00:00Z\n#EXTINF:5,\na.ts\n#EXT-X-DISCONTINUITY\n#EXTINF:5,\nb.ts\n#EXTINF:5,\nc.ts\n'
        segments=worker.playlist(text,'https://example.test/live.m3u8')['segments']
        self.assertIsNone(segments[1]['pdt'])
        self.assertIsNone(segments[2]['pdt'])
        with self.assertRaisesRegex(ValueError,'no fresh UTC'):
            worker.segment_start(segments[1],{}, {'next_sequence':1,'next_timestamp':5},worker.utc('2026-10-09T00:00:00Z'))
        self.assertEqual(worker.segment_start(segments[1],{'anchor_sequence':1,'anchor_timestamp':50},{},None),50)

    def test_saved_checkpoint_recovers_match_after_hls_discontinuity(self):
        origin=worker.utc('2026-10-09T00:00:00Z')
        text='#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:21\n#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:2026-10-09T00:01:40Z\n#EXTINF:155,\na.ts\n#EXT-X-ENDLIST\n'
        data=worker.playlist(text,'https://example.test/live.m3u8')
        for field in range(1,6):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temp:
                store=worker.Store(Path(temp)/'state.sqlite3')
                cfg=dict(self.cfg,field=field)
                key=worker.stream_identity(cfg)
                store.checkpoint(key,{'last_sequence':20,'last_video_timestamp':97,'next_sequence':21,'next_timestamp':100,
                                      'status':'retrying','error':'HLS discontinuity: recalibrate timeline before continuing'})
                samples=[{'t':t,'remaining':r,'number':1,'field':field} for t,r in [(100,150),(102,148),(104,146),(106,144),(250,0)]]
                with patch.object(worker,'resolve',return_value=('https://example.test/live.m3u8',origin)), \
                     patch.object(worker,'media_playlist',return_value=data), \
                     patch.object(worker,'http',return_value=(b'segment','https://example.test/a.ts')), \
                     patch.object(worker,'observations',return_value=iter(samples)):
                    worker.stream_worker(cfg,store,threading.Event())
                self.assertEqual(store.stream(key)['status'],'stream_ended')
                self.assertNotIn('error',store.stream(key))
                record=store.pending()[0][0]
                self.assertEqual(record['status'],'complete')
                self.assertEqual(record['start_timestamp'],100)
                self.assertEqual(record['end_timestamp'],250)
                store.db.close()

    def test_new_worker_checks_entire_available_anchored_window(self):
        origin=worker.utc('2026-10-09T00:00:00Z')
        segments=[{'seq':n,'pdt':origin+n*5,'pdt_explicit':True,'discontinuity':False,
                   'duration':5,'url':f'https://example.test/{n}.ts','init':None} for n in range(30)]
        for restarted in (False,True):
            with self.subTest(restarted=restarted), tempfile.TemporaryDirectory() as temp:
                store=worker.Store(Path(temp)/'state.sqlite3')
                if restarted:
                    store.checkpoint(worker.stream_identity(self.cfg),{'last_sequence':1,'last_video_timestamp':8,'next_sequence':2,'next_timestamp':10})
                processed=[]
                def observe(raw,cfg,base):
                    processed.append(base)
                    return iter([])
                with patch.object(worker,'resolve',return_value=('https://example.test/live.m3u8',origin)), \
                     patch.object(worker,'media_playlist',return_value={'segments':segments,'ended':True}), \
                     patch.object(worker,'http',return_value=(b'segment','https://example.test/a.ts')), \
                     patch.object(worker,'observations',side_effect=observe):
                    worker.stream_worker(self.cfg,store,threading.Event())
                self.assertEqual(processed,list(range(10 if restarted else 0,150,5)))
                store.db.close()

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
                query=parse_qs(urlparse(calls[0]['videoUrl']).query)
                self.assertEqual(query['t'],['100'])
                self.assertEqual(query['start'],['100'])
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
