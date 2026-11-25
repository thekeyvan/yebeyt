"""Run: python3 -m unittest tools/ganjoor/test_clips.py (the listen clips: timing, ranges, snapshot; no network, no ffmpeg)"""
import array
import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import build
import clips
import silence
from test_silence import RATE, quiet, tone

TIMING = """<DesktopGanjoorPoemAudioList><PoemAudio><SyncArray>
<SyncInfo><VerseOrder>0</VerseOrder><AudioMiliseconds>0</AudioMiliseconds></SyncInfo>
<SyncInfo><VerseOrder>1</VerseOrder><AudioMiliseconds>3000</AudioMiliseconds></SyncInfo>
<SyncInfo><VerseOrder>2</VerseOrder><AudioMiliseconds>5500</AudioMiliseconds></SyncInfo>
<SyncInfo><VerseOrder>3</VerseOrder><AudioMiliseconds>8500</AudioMiliseconds></SyncInfo>
<SyncInfo><VerseOrder>-2</VerseOrder><AudioMiliseconds>9900</AudioMiliseconds></SyncInfo>
</SyncArray></PoemAudio></DesktopGanjoorPoemAudioList>"""


def audio_samples():
    """Two couplets: the first hemistich of the first ends at 2.0 s (the second starts at 2.5 s, its mark says 3.0 s); the
    second couplet's voice starts at 5.2 s (its mark says 5.5 s), its first hemistich ends at 7.5 s (second at 8.0 s)."""
    return tone(2.0) + quiet(0.5) + tone(2.4) + quiet(0.3) + tone(2.3) + quiet(0.5) + tone(1.5)


def write_wav(path, samples=None):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(array.array("h", samples or audio_samples()).tobytes())
    return Path(path).read_bytes()


def raw_poem(poem_id=77, couplets=3):
    verses = []
    for i in range(couplets):
        verses += [
            {"VOrder": 2 * i + 1, "Position": "Right", "Text": f"الف{i}", "CoupletIndex": i},
            {"VOrder": 2 * i + 2, "Position": "Left", "Text": f"ب{i}", "CoupletIndex": i},
        ]
    return {"Id": poem_id, "Verses": verses}


def recitations(*items):
    return json.dumps([
        {"id": i, "audioOrder": order, "inSyncWithText": sync, "xmlUrl": f"https://x/{i}.xml" if xml else "", "mp3Url": f"https://x/{i}.mp3"}
        for i, order, sync, xml in items
    ]).encode()


class Timing(unittest.TestCase):
    def test_marks_by_verse_without_the_closing_marker(self):
        self.assertEqual(clips.parse_timing(TIMING.encode()), {0: 0, 1: 3000, 2: 5500, 3: 8500})

    def test_a_file_without_audio_has_no_marks(self):
        self.assertEqual(clips.parse_timing(b"<nope/>"), {})

    def test_the_first_hemistich_runs_to_the_next_verse(self):
        couplets = [{"m1": "a", "m2": "b"}, {"m1": "c", "m2": "d"}, {"m1": "e", "m2": "f"}]
        marks = clips.parse_timing(TIMING.encode())
        self.assertEqual(clips.first_hemistich(marks, couplets, 0), (0, 3.0))
        self.assertEqual(clips.first_hemistich(marks, couplets, 1), (5.5, 8.5))
        self.assertIsNone(clips.first_hemistich(marks, couplets, 2), "no mark for verse 5")
        self.assertIsNone(clips.first_hemistich(marks, couplets, 3), "not in the poem")

    def test_a_single_line_shifts_the_verses_and_has_no_hemistich(self):
        couplets = [{"m1": "نثر", "m2": ""}, {"m1": "c", "m2": "d"}]
        marks = clips.parse_timing(TIMING.encode())
        self.assertIsNone(clips.first_hemistich(marks, couplets, 0))
        self.assertEqual(clips.first_hemistich(marks, couplets, 1), (3.0, 5.5))

    def test_the_first_recitation_in_sync_with_a_timing_file_as_the_app_picks_it(self):
        listing = json.loads(recitations((1, 3, True, True), (2, 1, False, False), (3, 2, True, False), (4, 4, True, True)))
        self.assertEqual(clips.pick_recitation(listing)["id"], 1)
        self.assertIsNone(clips.pick_recitation(listing[1:3]))

    def test_the_margin_rule_of_the_app(self):
        self.assertAlmostEqual(clips.old_end(15.486, 21.036), 20.236)
        self.assertAlmostEqual(clips.old_end(10, 11.5), 11.2)
        self.assertEqual(clips.old_end(10, 10.9), 10.9)


class FindRange(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = Path(folder.name)
        self.wav = self.folder / "a.wav"
        write_wav(self.wav)

    def read(self, a, b):
        return silence.read_db(self.wav, a, b)

    def test_the_clip_ends_at_the_start_of_the_silence_plus_a_little(self):
        found = clips.find_range(self.read, 0.0, 3.0)
        self.assertAlmostEqual(found["end"], 2.0 + silence.PAD, delta=0.03)
        self.assertLess(found["end"], found["onset"], "the next hemistich starts after the end")
        self.assertAlmostEqual(found["onset"], 2.5, delta=0.03)
        self.assertEqual(found["start"], 0.0)

    def test_a_late_mark_pulls_the_start_back_to_the_voice(self):
        found = clips.find_range(self.read, 5.5, 8.5)
        self.assertAlmostEqual(found["start"], 5.2 - clips.PREROLL, delta=0.03)
        self.assertAlmostEqual(found["end"], 7.5 + silence.PAD, delta=0.03)

    def test_a_start_mark_where_the_voice_starts_keeps_a_little_lead_in(self):
        found = clips.find_range(self.read, 5.2, 8.5)
        self.assertAlmostEqual(found["start"], 5.2 - clips.PREROLL, delta=0.03)

    def test_an_early_start_mark_is_never_moved_later(self):
        self.assertEqual(clips.find_range(self.read, 4.95, 8.5)["start"], 4.95)

    def test_no_silence_near_the_mark_means_none(self):
        steady = self.folder / "steady.wav"
        write_wav(steady, tone(10.0))
        self.assertIsNone(clips.find_range(lambda a, b: silence.read_db(steady, a, b), 0.0, 5.0))

    def test_a_pause_in_the_middle_of_the_first_hemistich_is_not_the_gap(self):
        # The only pause ends 4.3 s before the mark, further than the search reaches.
        path = self.folder / "early.wav"
        write_wav(path, tone(1.5) + quiet(0.3) + tone(4.0))
        self.assertIsNone(clips.find_range(lambda a, b: silence.read_db(path, a, b), 0.0, 6.1))


class Refresh(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        poems = self.root / "poets/hafez/ghazal"
        poems.mkdir(parents=True)
        for name, poem_id in (("sh1", 77), ("sh2", 78)):
            (poems / f"{name}.json").write_text(json.dumps(raw_poem(poem_id)), encoding="utf-8")
        self.wav_bytes = write_wav(self.root / "src.wav")
        self.urls = []
        self.deck = [
            {"poem": "/hafez/ghazal/sh1", "index": 0, "poet": "hafez"}, {"poem": "/hafez/ghazal/sh1", "index": 1, "poet": "hafez"},
            {"poem": "/hafez/ghazal/sh1", "index": 2, "poet": "hafez"}, {"poem": "/hafez/ghazal/sh2", "index": 0, "poet": "hafez"},
            {"poem": "/saadi/x", "index": 0, "poet": "saadi"},
        ]

    def download(self, url):
        self.urls.append(url)
        if url.endswith("/77/recitations"):
            return recitations((9, 2, True, True), (8, 1, False, False))
        if url.endswith("/78/recitations"):
            return recitations((10, 1, False, False))
        if url.endswith(".xml"):
            return TIMING.encode()
        return self.wav_bytes  # the "mp3"

    def run_refresh(self):
        return clips.refresh(self.deck, self.root / "poets", self.root / "cache", self.download, decoder=lambda src, dst: shutil.copy(src, dst))

    def test_hafez_couplets_get_a_range_or_none(self):
        snapshot, _ = self.run_refresh()
        self.assertEqual(set(snapshot), {"/hafez/ghazal/sh1#0", "/hafez/ghazal/sh1#1", "/hafez/ghazal/sh1#2", "/hafez/ghazal/sh2#0"})
        first = snapshot["/hafez/ghazal/sh1#0"]
        self.assertEqual(first["recitation"], 9, "the first in sync with a timing file")
        self.assertAlmostEqual(first["end"], 2.08, delta=0.03)
        self.assertAlmostEqual(snapshot["/hafez/ghazal/sh1#1"]["start"], 5.12, delta=0.03)
        self.assertIsNone(snapshot["/hafez/ghazal/sh1#2"], "no mark for its second verse")
        self.assertIsNone(snapshot["/hafez/ghazal/sh2#0"], "no recitation in sync")

    def test_the_report_says_why_a_couplet_has_none(self):
        _, rows = self.run_refresh()
        status = {r["key"]: r["status"] for r in rows}
        self.assertEqual(status["/hafez/ghazal/sh1#0"], "clean")
        self.assertEqual(status["/hafez/ghazal/sh1#2"], "no timing")
        self.assertEqual(status["/hafez/ghazal/sh2#0"], "no recitation")
        self.assertIn("key,recitation,status", clips.dump_report(rows))

    def test_each_recitation_is_downloaded_once_and_cached(self):
        self.run_refresh()
        self.assertEqual(sum(u.endswith(".mp3") for u in self.urls), 1)
        self.urls.clear()
        self.run_refresh()
        self.assertTrue(all(u.endswith("/recitations") for u in self.urls), "files come from the cache; only the list is asked")

    def test_snapshot_text_is_sorted_and_round_trips(self):
        text = clips.dump_snapshot({"/b/x#10": None, "/a/y#2": {"recitation": 1, "start": 0.5, "end": 3.25}, "/b/x#9": None})
        self.assertEqual(text.splitlines()[1:-1], ['"/a/y#2":{"recitation":1,"start":0.5,"end":3.25},', '"/b/x#9":null,', '"/b/x#10":null'])
        self.assertEqual(list(clips.load_snapshot(text)), ["/a/y#2", "/b/x#9", "/b/x#10"])


class WithClips(unittest.TestCase):
    deck = [{"poem": "/hafez/p", "index": 0, "poet": "hafez"}, {"poem": "/hafez/p", "index": 1, "poet": "hafez"}, {"poem": "/saadi/q", "index": 0, "poet": "saadi"}]

    def test_clips_are_added_to_hafez_couplets_that_have_one(self):
        clip = {"recitation": 5, "start": 1.0, "end": 4.0}
        deck = clips.with_clips(self.deck, {"/hafez/p#0": clip, "/hafez/p#1": None})
        self.assertEqual(deck[0]["clip"], clip)
        self.assertNotIn("clip", deck[1])
        self.assertNotIn("clip", deck[2])

    def test_a_hafez_couplet_the_snapshot_does_not_know_fails(self):
        with self.assertRaises(ValueError):
            clips.with_clips(self.deck, {"/hafez/p#0": None})

    def test_entries_for_couplets_that_left_the_deck_are_ignored(self):
        deck = clips.with_clips(self.deck, {"/hafez/p#0": None, "/hafez/p#1": None, "/hafez/gone#0": {"recitation": 1, "start": 0, "end": 1}})
        self.assertEqual(len(deck), 3)


def no_network(*_, **__):
    raise AssertionError("network or audio touched")


class BuildTouchesTheNetworkOnlyWithTheFlag(unittest.TestCase):
    deck = WithClips.deck

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.snapshot = self.root / "clips.json"

    def test_a_normal_build_reads_the_snapshot_only(self):
        self.snapshot.write_text(clips.dump_snapshot({"/hafez/p#0": {"recitation": 5, "start": 1.0, "end": 4.0}, "/hafez/p#1": None}))
        with mock.patch("urllib.request.urlopen", no_network), mock.patch.object(clips, "refresh", no_network):
            deck = build.deck_with_clips(self.deck, self.root, False, snapshot=self.snapshot, cache=self.root / "cache", download=no_network)
        self.assertEqual(deck[0]["clip"]["end"], 4.0)
        self.assertFalse((self.root / "cache").exists())

    def test_a_missing_snapshot_is_an_error_that_names_the_flag(self):
        with self.assertRaises(SystemExit) as error:
            build.deck_with_clips(self.deck, self.root, False, snapshot=self.snapshot, cache=self.root / "cache")
        self.assertIn("--refresh-clips", str(error.exception))

    def test_a_stale_snapshot_is_an_error_that_names_the_flag(self):
        self.snapshot.write_text(clips.dump_snapshot({"/hafez/p#0": None}))
        with self.assertRaises(SystemExit) as error:
            build.deck_with_clips(self.deck, self.root, False, snapshot=self.snapshot, cache=self.root / "cache")
        self.assertIn("--refresh-clips", str(error.exception))

    def test_a_refresh_rewrites_the_snapshot_and_leaves_a_report(self):
        found = {"/hafez/p#0": {"recitation": 5, "start": 1.0, "end": 4.0}, "/hafez/p#1": None}
        rows = [{"key": "/hafez/p#0", "status": "clean"}]
        with mock.patch.object(clips, "refresh", return_value=(found, rows)) as refresh:
            deck = build.deck_with_clips(self.deck, self.root, True, snapshot=self.snapshot, cache=self.root / "cache", download="fake")
        refresh.assert_called_once()
        self.assertEqual(clips.load_snapshot(self.snapshot.read_text()), found)
        self.assertIn("/hafez/p#0", (self.root / "cache" / "clips-report.csv").read_text())
        self.assertEqual(deck[0]["clip"]["recitation"], 5)

    def test_check_with_a_refresh_flag_is_refused(self):
        for flag in ("--refresh-clips", "--refresh-recitations"):
            with mock.patch.object(sys, "argv", ["build.py", "--check", flag]), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
                build.main()
            self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
