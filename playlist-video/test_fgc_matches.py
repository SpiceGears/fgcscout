import unittest
from fgc_matches import detect, identity_consensus, parse_identity


class ArchiveIdentityTests(unittest.TestCase):
    def samples(self, *texts):
        return [{'text': text} for text in texts]

    def test_real_broadcast_ocr(self):
        # Five reads from the real Day 1 / Field 1, 265–415 s excerpt.
        reads = self.samples('| Match 1| Field 1', '| Match 1 | Field 1',
                             '| Match 1 | Field 1', '| Match 1/| Field 1', '| Match 1]! Field 1')
        identity, reason = identity_consensus(reads, expected_field=1)
        self.assertEqual(identity, {'match_number': 1, 'field': 1})
        self.assertIsNone(reason)

    def test_conflicting_match_numbers_need_review(self):
        identity, reason = identity_consensus(self.samples(*(['Match 4 Field 2'] * 4), 'Match 5 Field 2'), 2)
        self.assertIsNone(identity)
        self.assertIn('conflicting', reason)

    def test_wrong_field_never_auto_assigns(self):
        identity, reason = identity_consensus(self.samples(*(['Match 4 Field 2'] * 5)), 1)
        self.assertIsNone(identity)
        self.assertIn('differs', reason)

    def test_sparse_and_unreadable_never_infer_from_order(self):
        for reads in (['Match 4 Field 2'] * 2, ['unreadable'] * 5):
            self.assertIsNone(identity_consensus(self.samples(*reads))[0])
        self.assertIsNone(parse_identity('Match 0 Field 1'))
        self.assertIsNone(parse_identity('Match 1 Field 101'))

    def test_running_clock_boundaries_and_frozen_clock(self):
        samples = [{'t': t, 'remaining': 415 - t} for t in range(270, 411, 10)]
        found, _ = detect(samples)
        self.assertEqual((found[0]['start_timestamp'], found[0]['end_timestamp']), (265, 415))
        frozen = [{'t': t, 'remaining': 100} for t in range(0, 200, 10)]
        self.assertEqual(detect(frozen)[0], [])


if __name__ == '__main__':
    unittest.main()
