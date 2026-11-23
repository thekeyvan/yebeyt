"""Run: python3 -m unittest tools/ganjoor/test_library.py"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import audio
import build
import library
import sparse


def raw_poem(poem_id, url, verses, rhyme="ان"):
    return {"Id": poem_id, "FullUrl": url, "RhymeLetters": rhyme, "Verses": verses}


def v(order, position, text, couplet):
    return {"VOrder": order, "Position": position, "Text": text, "CoupletIndex": couplet}


class UnitWords(unittest.TestCase):
    def test_table(self):
        expected = {
            "غزلیات": "غزل", "قصاید": "قصیده", "مثنویات": "مثنوی", "مثنوی‌ها": "مثنوی",
            "قطعات": "قطعه", "رباعیات": "رباعی", "ترجیعات": "ترجیع‌بند",
            "ترکیبات": "ترکیب‌بند", "دوبیتی‌ها": "دوبیتی",
        }
        for title, unit in expected.items():
            self.assertEqual(library.unit_word(title), unit, title)

    def test_title_starting_with_a_known_word(self):
        self.assertEqual(library.unit_word("رباعیات خیام"), "رباعی")

    def test_everything_else_is_sher(self):
        self.assertEqual(library.unit_word("اشعار منتسب"), "شعر")
        self.assertEqual(library.unit_word("بخش ۱"), "شعر")
        self.assertEqual(library.unit_word(""), "شعر")


class IndexRow(unittest.TestCase):
    verses = [v(1, "Right", "الف", 0), v(2, "Left", "ب", 0), v(3, "Right", "پ", 1), v(4, "Left", "ت", 1)]

    def test_row(self):
        row = library.index_row(raw_poem(2130, "/hafez/ghazal/sh1", self.verses, "لها"), 24, {2130: 3})
        self.assertEqual(row, [2130, 24, "sh1", "الف", 2, "لها", 3])

    def test_no_recitations_and_no_rhyme(self):
        raw = raw_poem(5, "/x/y/z", self.verses)
        del raw["RhymeLetters"]
        self.assertEqual(library.index_row(raw, 1, {})[5:], ["", 0])

    def test_long_first_line_is_cut_at_a_word(self):
        text = " ".join(["کلمه"] * 30)
        got = library.index_row(raw_poem(1, "/a/b", [v(1, "Single", text, 0)]), 1, {})[3]
        self.assertTrue(got.endswith("…"))
        self.assertLessEqual(len(got), library.FIRST_LINE_LIMIT + 1)
        self.assertNotIn("  ", got)

    def test_poem_without_verses(self):
        self.assertEqual(library.index_row(raw_poem(1, "/a/b", []), 1, {})[3:5], ["", 0])


class Recitations(unittest.TestCase):
    def test_counts_per_poem_across_pages(self):
        pages = [[{"poemId": 1}, {"poemId": 2}], [{"poemId": 1}, {"poemId": 1}]]
        self.assertEqual(audio.count_recitations(pages), {1: 3, 2: 1})

    def test_no_pages(self):
        self.assertEqual(audio.count_recitations([[]]), {})

    def test_total_pages_from_the_paging_header(self):
        headers = {"paging-headers": '{"totalCount":5753,"pageSize":100,"currentPage":1,"totalPages":58}'}
        self.assertEqual(audio.total_pages(headers), 58)

    def test_cached_counts_need_no_network(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, "24.json").write_text('{"2130": 4}')
            self.assertEqual(audio.category_counts(Path(folder), 24), {2130: 4})


class Snapshot(unittest.TestCase):
    """recitations.json: the only input for popularity; only the refresh path asks the API."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.folder = Path(self.dir.name)
        self.snapshot = self.folder / "recitations.json"
        self.calls = []

        def fake_counts(cache, cat):
            self.calls.append(cat)
            return {30 + cat: cat, 10 + cat: 1}

        self.real = audio.category_counts
        audio.category_counts = fake_counts

    def tearDown(self):
        audio.category_counts = self.real
        self.dir.cleanup()

    def test_dump_is_sorted_by_numeric_poem_id_and_round_trips(self):
        text = audio.dump_snapshot({100: 2, 9: 5, 20: 1})
        self.assertEqual(text, '{"9":5,"20":1,"100":2}\n')
        self.assertEqual(audio.load_snapshot(text), {9: 5, 20: 1, 100: 2})

    def test_a_normal_build_reads_the_snapshot_and_never_calls_the_api(self):
        self.snapshot.write_text('{"7":3}\n')
        got = build.recitation_counts(self.folder, {"books": []}, False, self.snapshot, self.folder)
        self.assertEqual(got, {7: 3})
        self.assertEqual(self.calls, [])

    def test_a_missing_snapshot_stops_the_build(self):
        with self.assertRaises(SystemExit):
            build.recitation_counts(self.folder, {"books": []}, False, self.snapshot, self.folder)
        self.assertEqual(self.calls, [])

    def test_refresh_queries_every_category_and_rewrites_the_snapshot_sorted(self):
        cat = self.folder / "b"
        cat.mkdir()
        (cat / "_cat.json").write_text(json.dumps({
            "Id": 1, "Title": "کتاب", "ChildCats": [], "Poems": [{"Id": 5, "Title": "x", "FullUrl": "/b/p"}]}))
        self.snapshot.write_text('{"1":1}\n')
        cache = self.folder / "audio"
        cache.mkdir()
        (cache / "1.json").write_text('{"5": 99}')  # a download from an earlier run
        got = build.recitation_counts(self.folder, {"books": [{"path": "/b"}]}, True, self.snapshot, cache)
        self.assertFalse((cache / "1.json").exists(), "the refresh reused the old download cache")
        self.assertEqual(self.calls, [1])
        self.assertEqual(got, {31: 1, 11: 1})
        self.assertEqual(self.snapshot.read_text(), '{"11":1,"31":1}\n')


class Tree(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.poets = Path(self.dir.name)
        self.cat("/b", 1, "کتاب", [("/b/g", 2, "غزلیات"), ("/b/r", 3, "رباعیات")], [(10, "/b/p0")])
        self.cat("/b/g", 2, "غزلیات", [], [(11, "/b/g/sh1"), (12, "/b/g/sh2")])
        self.cat("/b/r", 3, "رباعیات", [], [(13, "/b/r/sh1")])

    def tearDown(self):
        self.dir.cleanup()

    def cat(self, path, cat_id, title, children, poems):
        folder = self.poets / path.lstrip("/")
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "_cat.json").write_text(json.dumps({
            "Id": cat_id, "Title": title,
            "ChildCats": [{"Id": i, "Title": t, "FullUrl": u} for u, i, t in children],
            "Poems": [{"Id": i, "Title": "x", "FullUrl": u} for i, u in poems],
        }))

    def test_counts_are_recursive_and_units_come_from_titles(self):
        node, cats = library.walk(self.poets, "/b")
        self.assertEqual(node["count"], 4)
        self.assertEqual([(s["title"], s["count"], s["unit"]) for s in node["sections"]],
                         [("غزلیات", 2, "غزل"), ("رباعیات", 1, "رباعی")])
        self.assertEqual([cat for cat, _ in cats], [1, 2, 3])
        self.assertEqual(library.main_unit(node), "غزل")

    def test_a_book_without_children_has_no_sections(self):
        node, cats = library.walk(self.poets, "/b/g")
        self.assertNotIn("sections", node)
        self.assertEqual(library.main_unit(node), "غزل")

    def test_build_book(self):
        for pid, url in [(10, "/b/p0"), (11, "/b/g/sh1"), (12, "/b/g/sh2"), (13, "/b/r/sh1")]:
            file = self.poets / f"{url.lstrip('/')}.json"
            file.write_text(json.dumps(raw_poem(pid, url, [v(1, "Right", f"م{pid}", 0)])))
        recitations = {12: 5}
        entry = {"path": "/b", "title": "دیوان", "poet": "p", "type": "divan", "color": "lapis", "blurb": "ب"}
        book, index = library.build_book(self.poets, recitations, entry, {"century": "قرن هشتم"})
        self.assertEqual((book["id"], book["count"], book["recited"], book["unit"], book["century"]),
                         (1, 4, True, "غزل", "قرن هشتم"))
        self.assertEqual(book["poems"], [{"id": 10, "title": "x", "path": "/b/p0"}])
        no_century, _ = library.build_book(self.poets, recitations, entry, {})
        self.assertNotIn("century", no_century)
        self.assertEqual(index["id"], 1)
        self.assertEqual([r[0] for r in index["poems"]], [10, 11, 12, 13])
        self.assertEqual([r[6] for r in index["poems"]], [0, 0, 5, 0])
        self.assertEqual(index["poems"][2][:3], [12, 2, "sh2"])


class MergePoet(unittest.TestCase):
    def test_curated_bio_wins_and_ganjoor_id_is_added(self):
        got = library.merge_poet({"slug": "a", "bio": "من"}, 7, "یک. دو. سه.")
        self.assertEqual((got["id"], got["bio"]), (7, "من"))

    def test_missing_bio_falls_back_to_ganjoors_first_sentences(self):
        self.assertEqual(library.merge_poet({"slug": "a"}, 7, "یک. دو. سه.")["bio"], "یک. دو.")


class SparsePatterns(unittest.TestCase):
    def test_book_folders_and_poet_files(self):
        self.assertEqual(sparse.patterns(["/hafez", "/nezami/5ganj/x"]), [
            "/poets/hafez/", "/poets/hafez/_cat.json", "/poets/hafez/poet.json",
            "/poets/nezami/5ganj/x/", "/poets/nezami/_cat.json", "/poets/nezami/poet.json",
        ])


if __name__ == "__main__":
    unittest.main()
