"""Run: python3 -m unittest tools/ganjoor/test_build.py"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build


def verse(order, position, text, couplet, summary=None):
    v = {"VOrder": order, "Position": position, "Text": text, "CoupletIndex": couplet}
    if summary:
        v["CoupletSummary"] = summary
    return v


def note(order, text):
    """A Comment verse: an editor's note, which Ganjoor gives no CoupletIndex."""
    return {"VOrder": order, "Position": "Comment", "Text": text}


class GroupCouplets(unittest.TestCase):
    def test_ghazal_pairs_right_and_left(self):
        got = build.group_couplets([
            verse(1, "Right", "الف", 0), verse(2, "Left", "ب", 0),
            verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1),
        ])
        self.assertEqual(got, [{"m1": "الف", "m2": "ب"}, {"m1": "پ", "m2": "ت"}])

    def test_meaning_is_kept_when_present_and_carriage_returns_are_stripped(self):
        got = build.group_couplets([
            verse(1, "Right", "الف\r", 0, "معنی\r\nدوم"), verse(2, "Left", "ب", 0),
            verse(3, "Right", "پ", 1), verse(4, "Left", "ت", 1),
        ])
        self.assertEqual(got[0], {"m1": "الف", "m2": "ب", "meaning": "معنی\nدوم"})
        self.assertNotIn("meaning", got[1])

    def test_paragraph_and_single_go_in_the_first_slot(self):
        got = build.group_couplets([
            verse(1, "Paragraph", "نثر", 0), verse(2, "Single", "آزاد", 1),
            verse(3, "Right", "الف", 2), verse(4, "Left", "ب", 2),
        ])
        self.assertEqual(got, [
            {"m1": "نثر", "m2": ""}, {"m1": "آزاد", "m2": ""}, {"m1": "الف", "m2": "ب"},
        ])

    def test_comment_verses_without_an_index_are_dropped(self):
        got = build.group_couplets([
            note(1, "(از چاتلان قوش)"), verse(2, "Single", "الف", 0), verse(3, "Single", "ب", 1),
        ])
        self.assertEqual(got, [{"m1": "الف", "m2": ""}, {"m1": "ب", "m2": ""}])

    def test_centered_verses_pair_up(self):
        got = build.group_couplets([
            verse(1, "CenteredVerse1", "الف", 0), verse(2, "CenteredVerse2", "ب", 0),
        ])
        self.assertEqual(got, [{"m1": "الف", "m2": "ب"}])

    def test_two_first_slot_verses_with_one_index_are_not_merged(self):
        got = build.group_couplets([verse(1, "Single", "الف", 0), verse(2, "Single", "ب", 0)])
        self.assertEqual(got, [{"m1": "الف", "m2": ""}, {"m1": "ب", "m2": ""}])

    def test_verse_order_is_by_vorder(self):
        got = build.group_couplets([verse(2, "Left", "ب", 0), verse(1, "Right", "الف", 0)])
        self.assertEqual(got, [{"m1": "الف", "m2": "ب"}])


class Selection(unittest.TestCase):
    cats = [
        {"Id": 1, "Title": "غزلیات", "FullUrl": "/x/ghazal"},
        {"Id": 2, "Title": "رباعیات", "FullUrl": "/x/robaee"},
    ]

    def test_pick_book_by_title(self):
        self.assertEqual(build.pick_book(self.cats, "رباعیات")["FullUrl"], "/x/robaee")

    def test_pick_book_fails_when_missing(self):
        with self.assertRaises(SystemExit):
            build.pick_book(self.cats, "قصاید")

    def test_books_are_the_root_children(self):
        books = build.book_refs(self.cats, bundled_ids={2})
        self.assertEqual(books[0], {"id": 1, "title": "غزلیات", "path": "/x/ghazal"})
        self.assertEqual(books[1], {"id": 2, "title": "رباعیات", "path": "/x/robaee", "bundled": True})

    def test_bio_is_the_first_two_sentences(self):
        self.assertEqual(build.short_bio("یک است. دو است. سه است."), "یک است. دو است.")
        self.assertEqual(build.short_bio("فقط یک"), "فقط یک")


if __name__ == "__main__":
    unittest.main()
