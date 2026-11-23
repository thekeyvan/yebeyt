"""library.json and the per-book poem indexes: the curated poets and books merged with Ganjoor's
categories, poem counts, recitation counts and first lines. Pure functions, tested in test_library.py."""
import json
from concurrent.futures import ThreadPoolExecutor

from couplets import group_couplets, short_bio

# First word of a section's title -> what one poem of it is called.
UNIT_WORDS = {
    "غزلیات": "غزل",
    "قصاید": "قصیده",
    "مثنویات": "مثنوی",
    "مثنوی\u200cها": "مثنوی",
    "قطعات": "قطعه",
    "رباعیات": "رباعی",
    "ترجیعات": "ترجیع\u200cبند",
    "ترکیبات": "ترکیب\u200cبند",
    "دوبیتی\u200cها": "دوبیتی",
}
DEFAULT_UNIT = "شعر"
FIRST_LINE_LIMIT = 60


def unit_word(title):
    words = title.split()
    return UNIT_WORDS.get(words[0], DEFAULT_UNIT) if words else DEFAULT_UNIT


def trim_first(text, limit=FIRST_LINE_LIMIT):
    """A first line short enough for a list row: spaces collapsed, cut at a word with «…»."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def index_row(raw, cat_id, recitations):
    """[id, category id, slug, first hemistich, couplet count, rhyme letters, recitations]."""
    grouped = group_couplets(raw["Verses"])
    first = trim_first(grouped[0]["m1"]) if grouped else ""
    slug = raw["FullUrl"].rsplit("/", 1)[1]
    return [raw["Id"], cat_id, slug, first, len(grouped), raw.get("RhymeLetters") or "",
            recitations.get(raw["Id"], 0)]


def read_cat(poets, path):
    return json.loads((poets / path.lstrip("/") / "_cat.json").read_text(encoding="utf-8"))


def walk(poets, path):
    """(section node, [(category id, poem refs)]) for the category at `path` and all below it.
    A node has id, title, path, count (everything below), unit, and sections when it has children."""
    cat = read_cat(poets, path)
    node = {"id": cat["Id"], "title": cat["Title"], "path": path, "count": len(cat["Poems"]),
            "unit": unit_word(cat["Title"])}
    cats = [(cat["Id"], cat["Poems"])] if cat["Poems"] else []
    children = []
    for child in cat["ChildCats"]:
        sub, sub_cats = walk(poets, child["FullUrl"])
        children.append(sub)
        cats += sub_cats
        node["count"] += sub["count"]
    if children:
        node["sections"] = children
    return node, cats


def main_unit(node):
    """The unit of the biggest child section (a divan's ghazals), else of the node itself."""
    children = node.get("sections")
    return max(children, key=lambda c: c["count"])["unit"] if children else node["unit"]


def poem_categories(poets, curation):
    """The ids of every category of the curated books that holds poems."""
    return {cat_id for entry in curation["books"] for cat_id, _ in walk(poets, entry["path"])[1]}


def build_book(poets, recitations, entry, poet):
    """(library.json book entry, index file content) for one curated book."""
    node, cats = walk(poets, entry["path"])

    def row(pair):
        cat_id, ref = pair
        raw = json.loads((poets / f"{ref['FullUrl'].lstrip('/')}.json").read_text(encoding="utf-8"))
        return index_row(raw, cat_id, recitations)

    pairs = [(cat_id, ref) for cat_id, refs in cats for ref in refs]
    with ThreadPoolExecutor(8) as pool:
        rows = list(pool.map(row, pairs))
    book = {
        "id": node["id"], "path": entry["path"], "title": entry["title"], "poet": entry["poet"],
        "type": entry["type"], "color": entry["color"], "blurb": entry["blurb"],
        "count": node["count"], "recited": any(r[6] for r in rows), "unit": main_unit(node),
    }
    if poet.get("century"):
        book["century"] = poet["century"]
    if "sections" in node:
        book["sections"] = node["sections"]
        # Poems sitting directly in the book beside its sections (Hafez's ساقی‌نامه) show as rows of their own.
        book["poems"] = [{"id": p["Id"], "title": p["Title"], "path": p["FullUrl"]}
                         for p in read_cat(poets, entry["path"])["Poems"]]
    return book, {"id": node["id"], "poems": rows}


def merge_poet(curated, ganjoor_id, description):
    """A library.json poet: the curated fields plus Ganjoor's id; the bio falls back to Ganjoor's."""
    poet = dict(curated)
    poet["id"] = ganjoor_id
    poet["bio"] = curated.get("bio") or short_bio(description)
    return poet


def build_files(poets, recitations, curation, manifest):
    """File name -> JSON value: library.json and index-<catId>.json for every curated book."""
    ids = {e["FullUrl"].lstrip("/"): e["Id"] for e in manifest["Poets"]}
    merged = {}
    for curated in curation["poets"]:
        slug = curated["slug"]
        about = json.loads((poets / slug / "poet.json").read_text(encoding="utf-8"))
        merged[slug] = merge_poet(curated, ids[slug], about.get("Description") or "")
    books, files = [], {}
    for entry in curation["books"]:
        book, index = build_book(poets, recitations, entry, merged[entry["poet"]])
        books.append(book)
        files[f"index-{book['id']}.json"] = index
    files["library.json"] = {
        "poets": list(merged.values()), "books": books,
        "moods": curation["moods"], "explorePoets": curation["explorePoets"],
    }
    return files
