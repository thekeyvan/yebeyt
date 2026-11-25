#!/usr/bin/env python3
"""Builds the poetry data bundled in the iOS app from github.com/ganjoor/ganjoor-data.

    python3 tools/ganjoor/build.py                  write apps/ios/Yebeyt/Resources/Data
    python3 tools/ganjoor/build.py --check          fail if the committed files differ
    python3 tools/ganjoor/build.py --sha <commit>   use another ganjoor-data commit
    python3 tools/ganjoor/build.py --refresh-recitations
                                                    query api.ganjoor.net, rewrite recitations.json, then build
    python3 tools/ganjoor/build.py --refresh-clips  download the recitations of the deck's Hafez couplets, find where
                                                    each first hemistich really ends (clips.py), rewrite clips.json, then build

Downloads are cached in tools/ganjoor/.cache (gitignored), so reruns need no network.
Output: poets.json (every poet, with their books), book-<id>.json for the bundled books,
library.json (the curated library, see library.py), index-<catId>.json, one list of poems
(first line, couplet count, rhyme letters, recitations) per curated book, games.json (the game deck, see games.py) and glossary.json (the hard words of couplets, checked against the bundled books, see glossary.py). The poems of the
curated books come from a sparse git checkout in .cache/repo. Popularity (recitations per poem) comes
from the committed snapshot recitations.json, so a normal build and --check never touch api.ganjoor.net;
only --refresh-recitations does, and it is the only way the counts change. Likewise the listen clips of the deck's Hafez
couplets (games.json `clip`: recitation id, start, end in seconds, never audio) come from the committed snapshot clips.json,
which only --refresh-clips rewrites (it downloads the mp3s into .cache/clips and needs macOS afconvert). Years are lunar Hijri, as in Ganjoor.
"""
import argparse
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import audio
import clips
import games
import glossary
import library
import sparse
from couplets import group_couplets, short_bio, split_ai

# The one place the data commit is pinned. The app reads it back from poets.json.
SHA = "7d7beabc1edfbddbd51835e979b309d653d25e39"
RAW = "https://raw.githubusercontent.com/ganjoor/ganjoor-data/{sha}/{path}"

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".cache"
DATA_DIR = HERE.parent.parent / "apps/ios/Yebeyt/Resources/Data"
RECITATIONS = HERE / "recitations.json"
CLIPS = HERE / "clips.json"

# Books bundled with their full text: poet slug -> book title.
# Golestan mixes prose and verse and Molavi is too big, so the app fetches them on demand.
BUNDLED = {"hafez": "غزلیات", "khayyam": "رباعیات", "babataher": "دوبیتی‌ها"}

def convert_poem(raw):
    poem = {"id": raw["Id"], "title": raw["Title"], "path": raw["FullUrl"]}
    if raw.get("PoemSummary"):
        summary, ai = split_ai(raw["PoemSummary"])
        if summary:
            poem["summary"] = summary
            if ai:
                poem["summaryAi"] = True
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


def glossary_file(poems, source=HERE / "glossary.json"):
    """glossary.json for the app: the written glossary, once every word is found in its couplet of a bundled book."""
    entries = json.loads(source.read_text(encoding="utf-8"))["entries"]
    problems = glossary.validate(entries, poems)
    if problems:
        sys.exit("glossary.json has problems:\n" + "\n".join(problems[:20]))
    return {"entries": entries}


def recitation_counts(poets_dir, curation, refresh, snapshot=RECITATIONS, cache=CACHE / "audio"):
    """{poem id: recitations}. Read from the committed snapshot; only `refresh` asks Ganjoor's API
    (every category of the curated books) and rewrites the snapshot."""
    if refresh:
        shutil.rmtree(cache, ignore_errors=True)  # a refresh asks the API for everything, never reuses old downloads
        counts = audio.fetch_all(cache, library.poem_categories(poets_dir, curation))
        snapshot.write_text(audio.dump_snapshot(counts))
        return counts
    if not snapshot.exists():
        sys.exit(f"{snapshot.name} is missing. Run python3 tools/ganjoor/build.py --refresh-recitations")
    return audio.load_snapshot(snapshot.read_text())


def deck_with_clips(deck, poets_dir, refresh, snapshot=CLIPS, cache=CACHE, download=download):
    """The deck with its Hafez couplets' listen clips. Read from the committed snapshot; only `refresh` downloads the
    recitations, finds the silences and rewrites the snapshot (and a CSV report in the cache)."""
    if refresh:
        found, rows = clips.refresh(deck, poets_dir, cache, download)
        snapshot.write_text(clips.dump_snapshot(found))
        cache.mkdir(parents=True, exist_ok=True)
        (cache / "clips-report.csv").write_text(clips.dump_report(rows))
    elif not snapshot.exists():
        sys.exit(f"{snapshot.name} is missing. Run python3 tools/ganjoor/build.py --refresh-clips")
    try:
        return clips.with_clips(deck, clips.load_snapshot(snapshot.read_text()))
    except ValueError as error:
        sys.exit(f"{error}. Run python3 tools/ganjoor/build.py --refresh-clips")


def build_files(sha, refresh=False, refresh_clips=False):
    """File name -> content for everything the app bundles."""
    fetch = make_fetcher(sha)
    manifest = fetch("manifest.json")
    with ThreadPoolExecutor(16) as pool:
        built = list(pool.map(lambda entry: build_poet(fetch, entry), manifest["Poets"]))
    files = {"poets.json": dump({
        "source": {"repo": "ganjoor/ganjoor-data", "sha": sha},
        "poets": [poet for poet, _ in built],
    })}
    bundled_poems = {}
    for poet, bundled in built:
        if bundled:
            book = build_book(fetch, bundled, poet["id"])
            files[f"book-{book['id']}.json"] = dump(book)
            bundled_poems.update({poem["path"]: poem["couplets"] for poem in book["poems"]})
    files["glossary.json"] = dump(glossary_file(bundled_poems))
    curation = json.loads((HERE / "curation.json").read_text(encoding="utf-8"))
    poets_dir = sparse.checkout(CACHE / "repo", sha, [b["path"] for b in curation["books"]])
    recitations = recitation_counts(poets_dir, curation, refresh)
    for name, value in library.build_files(poets_dir, recitations, curation, manifest).items():
        files[name] = dump(value)
    deck = games.build_deck(poets_dir, recitations, curation)
    files["games.json"] = dump(deck_with_clips(deck, poets_dir, refresh_clips))
    return files


def differing(files):
    """Names of files that are missing, extra or different in the data folder."""
    on_disk = {p.name: p.read_text(encoding="utf-8") for p in DATA_DIR.glob("*.json")}
    return sorted(name for name in files.keys() | on_disk.keys() if files.get(name) != on_disk.get(name))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="fail if the committed files differ")
    parser.add_argument("--sha", default=SHA, help="ganjoor-data commit (default: the pinned one)")
    parser.add_argument("--refresh-recitations", action="store_true",
                        help="query api.ganjoor.net and rewrite recitations.json (the only call to it)")
    parser.add_argument("--refresh-clips", action="store_true",
                        help="download the deck's Hafez recitations and rewrite clips.json (the only download of audio)")
    args = parser.parse_args()
    if args.check and (args.refresh_recitations or args.refresh_clips):
        parser.error("--check never rewrites the snapshots")

    files = build_files(args.sha, args.refresh_recitations, args.refresh_clips)
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
