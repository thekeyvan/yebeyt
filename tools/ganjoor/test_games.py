"""Run: python3 -m unittest tools/ganjoor/test_games.py"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import games

WORDS5 = "یک دو سه چهار پنج"


def v(order, position, text, couplet, summary=None):
    verse = {"VOrder": order, "Position": position, "Text": text, "CoupletIndex": couplet}
    if summary:
        verse["CoupletSummary"] = summary
    return verse


def couplet(m1=WORDS5, m2=WORDS5, meaning="معنی"):
    result = {"m1": m1, "m2": m2}
    if meaning is not None:
        result["meaning"] = meaning
    return result


class Eligible(unittest.TestCase):
    def test_a_normal_couplet_is_kept(self):
        self.assertTrue(games.is_eligible(couplet()))

    def test_needs_a_meaning(self):
        self.assertFalse(games.is_eligible(couplet(meaning=None)))
        self.assertFalse(games.is_eligible(couplet(meaning="  ")))

    def test_needs_both_hemistichs(self):
        self.assertFalse(games.is_eligible(couplet(m2="")))
        self.assertFalse(games.is_eligible(couplet(m1="   ")))

    def test_word_count_bounds_are_five_to_fourteen_for_each_hemistich(self):
        self.assertFalse(games.is_eligible(couplet(m1="یک دو سه چهار")))
        self.assertTrue(games.is_eligible(couplet(m1=" ".join(["ک"] * 14))))
        self.assertFalse(games.is_eligible(couplet(m2=" ".join(["ک"] * 15))))
        self.assertFalse(games.is_eligible(couplet(m2="یک دو سه چهار")))

    def test_a_half_space_does_not_split_a_word(self):
        self.assertFalse(games.is_eligible(couplet(m1="می\u200cرود او را به")))

    def test_a_very_long_meaning_is_left_out(self):
        self.assertTrue(games.is_eligible(couplet(meaning="م" * games.MAX_MEANING)))
        self.assertFalse(games.is_eligible(couplet(meaning="م" * (games.MAX_MEANING + 1))))


class CleanMeaning(unittest.TestCase):
    def test_line_breaks_inside_the_note_become_spaces(self):
        self.assertEqual(games.clean_meaning("دل\nِ ما  را\r\nبده"), "دل ِ ما را بده")

    def test_a_stray_leading_colon_is_dropped(self):
        self.assertEqual(games.clean_meaning(": من آمدم "), "من آمدم")

    def test_the_ai_label_stays(self):
        self.assertEqual(games.clean_meaning("هوش مصنوعی: آسمان"), "هوش مصنوعی: آسمان")


class PoemPicks(unittest.TestCase):
    def test_keeps_the_first_few_eligible_couplets_with_their_index(self):
        couplets = [couplet(meaning=None), couplet(), couplet(), couplet(m2=""), couplet(), couplet()]
        self.assertEqual([i for i, _ in games.poem_picks(couplets, per_poem=3)], [1, 2, 4])

    def test_index_is_the_position_in_the_whole_poem(self):
        self.assertEqual(games.poem_picks([couplet(m1="")] * 2 + [couplet()], 3)[0][0], 2)


def entry(poet, path, index, popularity):
    return {"poem": path, "index": index, "poet": poet, "popularity": popularity}


class Rank(unittest.TestCase):
    def test_most_recited_first_then_path_then_index(self):
        got = games.rank([entry("a", "/a/z", 0, 5), entry("a", "/a/b", 1, 5), entry("a", "/a/b", 0, 5), entry("a", "/a/q", 0, 9)],
                         per_poet=10, total=10)
        self.assertEqual([(e["poem"], e["index"]) for e in got], [("/a/q", 0), ("/a/b", 0), ("/a/b", 1), ("/a/z", 0)])

    def test_a_poet_is_capped(self):
        entries = [entry("a", f"/a/{i}", 0, 100 - i) for i in range(5)] + [entry("b", "/b/1", 0, 1)]
        got = games.rank(entries, per_poet=2, total=10)
        self.assertEqual([e["poem"] for e in got], ["/a/0", "/a/1", "/b/1"])

    def test_the_deck_is_cut_to_the_total(self):
        entries = [entry("a", f"/a/{i}", 0, 10 - i) for i in range(5)]
        self.assertEqual(len(games.rank(entries, per_poet=10, total=3)), 3)


class Build(unittest.TestCase):
    def write(self, root, url, poem_id, verses):
        file = root / (url.lstrip("/") + ".json")
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps({"Id": poem_id, "FullUrl": url, "Verses": verses}), encoding="utf-8")

    def make(self, root):
        cat = {"Id": 1, "Title": "کتاب", "FullUrl": "/p/book", "Poems": [], "ChildCats": []}
        refs = [(10, "/p/book/a"), (11, "/p/book/b"), (12, "/p/book/c")]
        cat["Poems"] = [{"Id": i, "FullUrl": u} for i, u in refs]
        (root / "p/book").mkdir(parents=True)
        (root / "p/book/_cat.json").write_text(json.dumps(cat))
        good = [v(1, "Right", WORDS5, 0, "معنی"), v(2, "Left", WORDS5, 0)]
        self.write(root, "/p/book/a", 10, good)
        self.write(root, "/p/book/b", 11, good + [v(3, "Right", WORDS5, 1, "دوم"), v(4, "Left", WORDS5, 1)])
        self.write(root, "/p/book/c", 12, good)  # never recited

    def test_entries_have_the_fields_the_app_reads(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.make(root)
            curation = {"books": [{"path": "/p/book", "title": "کتابِ من", "poet": "p"}]}
            got = games.build_deck(root, {10: 2, 11: 7}, curation)
        self.assertEqual([(e["poem"], e["index"], e["popularity"]) for e in got],
                         [("/p/book/b", 0, 7), ("/p/book/b", 1, 7), ("/p/book/a", 0, 2)])
        self.assertEqual(got[1], {"poem": "/p/book/b", "index": 1, "m1": WORDS5, "m2": WORDS5, "meaning": "دوم",
                                  "poet": "p", "book": "/p/book", "bookTitle": "کتابِ من", "popularity": 7})

    def test_unrecited_poems_are_left_out(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.make(root)
            curation = {"books": [{"path": "/p/book", "title": "ک", "poet": "p"}]}
            got = games.build_deck(root, {}, curation)
        self.assertEqual(got, [])


if __name__ == "__main__":
    unittest.main()
