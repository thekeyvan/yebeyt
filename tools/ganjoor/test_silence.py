"""Run: python3 -m unittest tools/ganjoor/test_silence.py"""
import array
import math
import random
import sys
import tempfile
import unittest
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import silence

RATE = 16000


def tone(seconds, amplitude=8000, freq=220):
    return [int(amplitude * math.sin(2 * math.pi * freq * i / RATE)) for i in range(round(seconds * RATE))]


def quiet(seconds, amplitude=20, seed=1):
    rng = random.Random(seed)
    return [rng.randint(-amplitude, amplitude) for _ in range(round(seconds * RATE))]


def db_of(*parts):
    return silence.window_db([s for part in parts for s in part], RATE)


class WindowEnergy(unittest.TestCase):
    def test_one_value_per_20_ms_window(self):
        self.assertEqual(len(db_of(tone(1.0))), 50)

    def test_a_full_scale_sine_is_about_minus_3_db_and_digital_silence_is_very_low(self):
        self.assertAlmostEqual(silence.window_db(tone(0.1, 32767, 200), RATE)[2], -3.0, delta=0.5)
        self.assertLess(silence.window_db([0] * 320, RATE)[0], -90)

    def test_a_wav_is_read_between_two_times(self):
        audio = array.array("h", tone(1.0) + quiet(1.0) + tone(1.0))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "a.wav"
            with wave.open(str(path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(RATE)
                wav.writeframes(audio.tobytes())
            first, db = silence.read_db(path, 0.5, 2.5)
            self.assertEqual(first, 0.5)
            self.assertEqual(len(db), 100)
            self.assertGreater(db[0], -20)
            self.assertLess(db[50], -50)
            self.assertEqual(silence.read_db(path, 2.99, 5.0)[1], [], "less than a window is left")
            self.assertEqual(silence.read_db(path, -1.0, 0.5)[0], 0, "never before the start")


class FindSilence(unittest.TestCase):
    def test_tone_silence_tone(self):
        found = silence.find_silence(db_of(tone(1.0), quiet(0.4), tone(1.0)))
        self.assertIsNotNone(found)
        first, last, floor, voice = found
        self.assertAlmostEqual(first * silence.WINDOW, 1.0, delta=0.04)
        self.assertAlmostEqual(last * silence.WINDOW, 1.4, delta=0.04)
        self.assertLess(floor, voice - 40)

    def test_a_silence_at_the_minimum_length_is_found(self):
        self.assertIsNotNone(silence.find_silence(db_of(tone(1.0), quiet(0.12), tone(1.0))))

    def test_a_pause_shorter_than_the_minimum_is_not_a_silence(self):
        self.assertIsNone(silence.find_silence(db_of(tone(1.0), quiet(0.08), tone(1.0))))

    def test_steady_speech_has_no_silence(self):
        self.assertIsNone(silence.find_silence(db_of(tone(2.0))))

    def test_a_noisy_gap_only_a_little_below_the_voice_is_not_clean(self):
        self.assertIsNone(silence.find_silence(db_of(tone(1.0), tone(0.4, 4000), tone(1.0))))

    def test_silence_at_the_edge_of_the_stretch_is_not_a_gap_between_two_hemistichs(self):
        self.assertIsNone(silence.find_silence(db_of(quiet(0.5), tone(1.5))), "nothing before it")
        self.assertIsNone(silence.find_silence(db_of(tone(1.5), quiet(0.5))), "nothing after it")

    def test_the_quietest_of_two_pauses_wins(self):
        found = silence.find_silence(db_of(tone(0.6), quiet(0.2, 400), tone(0.6), quiet(0.2, 10), tone(0.6)))
        self.assertIsNotNone(found)
        self.assertAlmostEqual(found[0] * silence.WINDOW, 1.4, delta=0.04)

    def test_too_few_windows(self):
        self.assertIsNone(silence.find_silence([-10.0] * 3))

    def test_a_long_silence_is_found_whole(self):
        found = silence.find_silence(db_of(tone(1.0), quiet(1.5), tone(1.0)))
        self.assertAlmostEqual(found[0] * silence.WINDOW, 1.0, delta=0.04)
        self.assertAlmostEqual(found[1] * silence.WINDOW, 2.5, delta=0.04)

    def test_a_pause_that_ends_before_the_given_window_is_skipped(self):
        db = db_of(tone(0.6), quiet(0.2, 10), tone(0.6), quiet(0.2, 400), tone(0.6))
        self.assertAlmostEqual(silence.find_silence(db)[0] * silence.WINDOW, 0.6, delta=0.04)
        self.assertAlmostEqual(silence.find_silence(db, onset_from=45)[0] * silence.WINDOW, 1.4, delta=0.04)

    def test_a_shallower_depth_accepts_a_noisier_gap(self):
        db = db_of(tone(1.0), tone(0.4, 2500), tone(1.0))
        self.assertIsNone(silence.find_silence(db))
        self.assertIsNotNone(silence.find_silence(db, depth=8))


if __name__ == "__main__":
    unittest.main()
