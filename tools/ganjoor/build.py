#!/usr/bin/env python3
"""Builds the poetry data bundled in the iOS app from github.com/ganjoor/ganjoor-data.

    python3 tools/ganjoor/build.py                  write apps/ios/Yebeyt/Resources/Data
    python3 tools/ganjoor/build.py --check          fail if the committed files differ
    python3 tools/ganjoor/build.py --sha <commit>   use another ganjoor-data commit

Downloads are cached in tools/ganjoor/.cache (gitignored), so reruns need no network.
Output: poets.json (every poet, with their books) and book-<id>.json for the bundled books.
Years are lunar Hijri, as in Ganjoor.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# The one place the data commit is pinned. The app reads it back from poets.json.
SHA = "7d7beabc1edfbddbd51835e979b309d653d25e39"
RAW = "https://raw.githubusercontent.com/ganjoor/ganjoor-data/{sha}/{path}"

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
DATA_DIR = HERE.parent.parent / "apps/ios/Yebeyt/Resources/Data"

# Books bundled with their full text: poet slug -> book title.
# Golestan mixes prose and verse and Molavi is too big, so the app fetches them on demand.
BUNDLED = {"hafez": "غزلیات", "khayyam": "رباعیات", "babataher": "دوبیتی‌ها"}

# Verses on the second line of a couplet. Right, CenteredVerse1, Single and Paragraph
# (GanjoorService's VersePosition) all go in the first. Comment verses are editor notes, not
# poem lines (and have no CoupletIndex), so they are dropped.
SECOND_HALF = {"Left", "CenteredVerse2"}
NOT_POETRY = {"Comment"}


def clean(text):
    return text.replace("\r", "")


def group_couplets(verses):
    """Verses -> [{m1, m2, meaning?}], grouped by CoupletIndex, in verse order."""
    couplets, index, filled = [], None, set()
    for v in sorted(verses, key=lambda v: v["VOrder"]):
        if v["Position"] in NOT_POETRY:
            continue
        slot = "m2" if v["Position"] in SECOND_HALF else "m1"
        if not couplets or v.get("CoupletIndex") != index or slot in filled:
            couplets.append({"m1": "", "m2": ""})
            index, filled = v.get("CoupletIndex"), set()
        couplet = couplets[-1]
        couplet[slot] = clean(v["Text"])
        filled.add(slot)
        if v.get("CoupletSummary") and "meaning" not in couplet:
            couplet["meaning"] = clean(v["CoupletSummary"])
    return couplets


def convert_poem(raw):
    poem = {"id": raw["Id"], "title": raw["Title"], "path": raw["FullUrl"]}
    if raw.get("PoemSummary"):
        poem["summary"] = clean(raw["PoemSummary"])
    if (raw.get("Metre") or {}).get("Rhythm"):
        poem["rhythm"] = raw["Metre"]["Rhythm"]
    poem["couplets"] = group_couplets(raw["Verses"])
    return poem


def pick_book(child_cats, title):
    for cat in child_cats:
        if cat["Title"] == title:
            return cat
    sys.exit(f"no book titled {title!r} among {[c['Title'] for c in child_cats]}")


def book_refs(child_cats, bundled_ids):
    refs = []
    for cat in child_cats:
        ref = {"id": cat["Id"], "title": cat["Title"], "path": cat["FullUrl"]}
        if cat["Id"] in bundled_ids:
            ref["bundled"] = True
        refs.append(ref)
    return refs


def short_bio(description):
    sentences = re.split(r"(?<=[.!؟?])\s+", description.strip())
    return " ".join(sentences[:2])


def download(url, attempts=4):
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == attempts - 1:
                sys.exit(f"download failed: {url}: {error}")
            time.sleep(2 ** attempt)


def make_fetcher(sha):
    def fetch(path):
        file = CACHE / sha / path
        if not file.exists():
            file.parent.mkdir(parents=True, exist_ok=True)
            part = file.with_name(file.name + ".part")
            part.write_bytes(download(RAW.format(sha=sha, path=path)))
            part.replace(file)  # a stopped run never leaves a half-written cache file
        return json.loads(file.read_text(encoding="utf-8"))
    return fetch


def build_poet(fetch, entry):
    """One poets.json entry, and the category of its bundled book if it has one."""
    slug = entry["FullUrl"].lstrip("/")
    poet = fetch(f"poets/{slug}/poet.json")
    root = fetch(f"poets/{slug}/_cat.json")
    bundled = pick_book(root["ChildCats"], BUNDLED[slug]) if slug in BUNDLED else None
    result = {
        "id": entry["Id"],
        "slug": slug,
        "nickname": entry["Nickname"],
        "name": poet["Name"],
        "bio": short_bio(poet.get("Description") or ""),
    }
    if poet.get("ValidBirthDate") and poet.get("BirthYearInLHijri"):
        result["birthYear"] = poet["BirthYearInLHijri"]
    if poet.get("ValidDeathDate") and poet.get("DeathYearInLHijri"):
        result["deathYear"] = poet["DeathYearInLHijri"]
    result["books"] = book_refs(root["ChildCats"], {bundled["Id"]} if bundled else set())
    return result, bundled


def build_book(fetch, cat_ref, poet_id):
    path = cat_ref["FullUrl"]
    cat = fetch(f"poets{path}/_cat.json")
    if cat["ChildCats"]:
        sys.exit(f"{path} has sub-categories; only flat books can be bundled")
    with ThreadPoolExecutor(16) as pool:
        raws = list(pool.map(lambda p: fetch(f"poets{p['FullUrl']}.json"), cat["Poems"]))
    return {
        "id": cat["Id"],
        "title": cat["Title"],
        "path": path,
        "poetId": poet_id,
        "toc": cat["TableOfContentsStyle"],
        "poems": [convert_poem(raw) for raw in raws],
    }


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"


def build_files(sha):
    """File name -> content for everything the app bundles."""
    fetch = make_fetcher(sha)
    manifest = fetch("manifest.json")
    with ThreadPoolExecutor(16) as pool:
        built = list(pool.map(lambda entry: build_poet(fetch, entry), manifest["Poets"]))
    files = {"poets.json": dump({
        "source": {"repo": "ganjoor/ganjoor-data", "sha": sha},
        "poets": [poet for poet, _ in built],
    })}
    for poet, bundled in built:
        if bundled:
            book = build_book(fetch, bundled, poet["id"])
            files[f"book-{book['id']}.json"] = dump(book)
    return files


def differing(files):
    """Names of files that are missing, extra or different in the data folder."""
    on_disk = {p.name: p.read_text(encoding="utf-8") for p in DATA_DIR.glob("*.json")}
    return sorted(name for name in files.keys() | on_disk.keys() if files.get(name) != on_disk.get(name))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="fail if the committed files differ")
    parser.add_argument("--sha", default=SHA, help="ganjoor-data commit (default: the pinned one)")
    args = parser.parse_args()

    files = build_files(args.sha)
    if args.check:
        stale = differing(files)
        if stale:
            sys.exit(f"out of date: {', '.join(stale)}. Run python3 tools/ganjoor/build.py")
        print("poetry data is up to date")
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name in differing(files):
        if name not in files:
            (DATA_DIR / name).unlink()
    total = 0
    for name, text in sorted(files.items()):
        (DATA_DIR / name).write_text(text, encoding="utf-8")
        size = len(text.encode("utf-8"))
        total += size
        print(f"{name:20} {size / 1e6:6.2f} MB")
    print(f"{'total':20} {total / 1e6:6.2f} MB")


if __name__ == "__main__":
    main()
