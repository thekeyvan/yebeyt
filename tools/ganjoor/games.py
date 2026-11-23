"""The game deck: well-known couplets for the games (games.json). Pure selection rules, tested in test_games.py.

A couplet is in the pool when it has a Ganjoor meaning (the after-answer sheet shows it), both hemistichs are
there and each has 5-14 words. Poems are taken most recited first; a poem gives at most a few couplets and a
poet at most `PER_POET`, so the deck is not all Hafez."""
import json
from collections import defaultdict

import library
from couplets import group_couplets

MIN_WORDS, MAX_WORDS = 5, 14
# The sheet shows the meaning in a few lines; the longest commentaries are left out.
MAX_MEANING = 300
PER_POEM = 3
PER_POET = 200
TOTAL = 1500


def clean_meaning(text):
    """One line of text: breaks inside Ganjoor's notes become spaces, a stray leading colon goes."""
    return " ".join(text.split()).lstrip(": ")


def word_count(text):
    return len(text.split())


def is_eligible(couplet):
    meaning = (couplet.get("meaning") or "").strip()
    if not meaning or len(meaning) > MAX_MEANING:
        return False
    return all(MIN_WORDS <= word_count(couplet[half]) <= MAX_WORDS for half in ("m1", "m2"))


def poem_picks(couplets, per_poem=PER_POEM):
    """[(index in the poem, couplet)] for the first eligible couplets of a poem."""
    return [(i, c) for i, c in enumerate(couplets) if is_eligible(c)][:per_poem]


def rank(entries, per_poet=PER_POET, total=TOTAL):
    """Most recited first (ties by poem path, then couplet index), at most `per_poet` per poet, `total` in all."""
    kept, count = [], defaultdict(int)
    for e in sorted(entries, key=lambda e: (-e["popularity"], e["poem"], e["index"])):
        if count[e["poet"]] < per_poet:
            count[e["poet"]] += 1
            kept.append(e)
    return kept[:total]


def recited_poems(poets, recitations, curation):
    """poet slug -> [(recitations, poem path, book entry)] of the curated books' recited poems, most recited first."""
    seen, by_poet = set(), defaultdict(list)
    for book in curation["books"]:
        for _, refs in library.walk(poets, book["path"])[1]:
            for ref in refs:
                count = recitations.get(ref["Id"], 0)
                if count and ref["FullUrl"] not in seen:
                    seen.add(ref["FullUrl"])
                    by_poet[book["poet"]].append((count, ref["FullUrl"], book))
    return {poet: sorted(poems, key=lambda p: (-p[0], p[1])) for poet, poems in by_poet.items()}


def build_deck(poets, recitations, curation, per_poet=PER_POET, total=TOTAL):
    """The deck, a list of {poem, index, m1, m2, meaning, ai?, poet, bookTitle}, most recited first."""
    entries = []
    for poet, poems in recited_poems(poets, recitations, curation).items():
        taken = 0
        for count, path, book in poems:
            if taken >= per_poet:
                break
            raw = json.loads((poets / f"{path.lstrip('/')}.json").read_text(encoding="utf-8"))
            for index, c in poem_picks(group_couplets(raw["Verses"])):
                entry = {
                    "poem": path, "index": index, "m1": c["m1"].strip(), "m2": c["m2"].strip(),
                    "meaning": clean_meaning(c["meaning"]), "poet": poet, "bookTitle": book["title"], "popularity": count,
                }
                if c.get("ai"):
                    entry["ai"] = True
                entries.append(entry)
                taken += 1
    # The popularity only orders the deck; the app doesn't read it.
    return [{k: v for k, v in e.items() if k != "popularity"} for e in rank(entries, per_poet, total)]
