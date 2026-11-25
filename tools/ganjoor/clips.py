"""Where a گوش کن clip of a Hafez couplet starts and ends, from the real audio (clips.json, tested in test_clips.py).

Ganjoor's sync marks are approximate: the second hemistich starts a median half a second before its mark, so a clip
that stops at a fixed margin before the mark either plays the next word or cuts the last syllable. At data-build time
this finds the silence between the two hemistichs in the mp3 of the recitation the app will use (the poem's first one
in sync with the text, as ListenLoader picks) and stores only times, never audio: {recitation id, start, end} for each
Hafez couplet of the game deck. `build.py --refresh-clips` is the only thing that downloads recitations and rewrites
clips.json; a normal build and `--check` read the snapshot and never touch the network.

Audio is decoded with macOS `afconvert` (no extra dependencies) and analysed in 20 ms energy windows (silence.py)."""
import csv
import io
import json
import math
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import silence
from couplets import group_couplets

RECITATIONS_API = "https://api.ganjoor.net/api/ganjoor/poem/{poem}/recitations"
# The clip is at least this long, so the silence is searched from this far after the first hemistich's mark.
MIN_LENGTH = 1.0
# The silence is searched from this long before the second hemistich's mark to a little after it (marks are sometimes early).
BEFORE, AFTER = 1.6, 0.3
# A first hemistich whose mark is late (it starts before it) is taken from its real start, at most this far before the
# mark; the clip then starts this long before the voice does.
TRIM_BEFORE, PREROLL = 0.8, 0.08
# What the app does without a precomputed clip (ListenClipRange): stop this long before the mark, never shorter than this.
OLD_MARGIN, OLD_MINIMUM = 0.8, 1.2


def key(entry):
    """The couplet's key, as the app's GameCouplet.id."""
    return f"{entry['poem']}#{entry['index']}"


def pick_recitation(recitations):
    """The first recitation (Ganjoor's order) that is in sync with the text and has a timing file, as ListenLoader."""
    for r in sorted(recitations, key=lambda r: r["audioOrder"]):
        if r.get("inSyncWithText") and r.get("xmlUrl"):
            return r
    return None


def parse_timing(data):
    """{verse: milliseconds} from the first PoemAudio of a timing file. A negative verse is a closing marker."""
    audio = ET.fromstring(data).find("PoemAudio")
    if audio is None:
        return {}
    marks = {}
    for info in audio.iter("SyncInfo"):
        verse, ms = int(info.findtext("VerseOrder")), int(info.findtext("AudioMiliseconds"))
        if verse >= 0:
            marks.setdefault(verse, ms)
    return marks


def first_hemistich(marks, couplets, index):
    """(start, next verse's mark) in seconds of couplet `index`'s first hemistich; None when it has no second one or no marks."""
    if not 0 <= index < len(couplets) or not couplets[index]["m2"]:
        return None
    verse = sum(1 if c["m2"] == "" else 2 for c in couplets[:index])
    if verse not in marks or verse + 1 not in marks or marks[verse + 1] <= marks[verse]:
        return None
    return marks[verse] / 1000, marks[verse + 1] / 1000


def old_end(start, mark):
    return min(mark, max(mark - OLD_MARGIN, start + OLD_MINIMUM))


def find_range(read, start_mark, next_mark):
    """The clip of a first hemistich marked from `start_mark` to `next_mark`, as a dict with `start`, `end` and what was
    measured; None when there is no clean silence between the hemistichs. `read(t0, t1)` gives (time of the first
    window, dB per 20 ms window)."""
    from_time = start_mark + MIN_LENGTH
    first_time, db = read(from_time, next_mark + AFTER)
    found = silence.find_silence(db, onset_from=max(0, math.ceil((next_mark - BEFORE - first_time) / silence.WINDOW)))
    if not found:
        return None
    first, last, floor, voice = found
    quiet_from = first_time + first * silence.WINDOW
    onset = first_time + last * silence.WINDOW
    start = start_mark
    trim_from = max(0.0, start_mark - TRIM_BEFORE)
    trim_time, trim_db = read(trim_from, start_mark + AFTER)
    before = silence.find_silence(trim_db)
    if before:
        voice_starts = trim_time + before[1] * silence.WINDOW
        start = min(start_mark, max(trim_from, voice_starts - PREROLL))
    return {
        "start": round(start, 3), "end": round(quiet_from + silence.PAD, 3), "floor": floor, "voice": voice,
        "quiet_from": quiet_from, "onset": onset,
    }


def decode(mp3, wav):
    """16 kHz mono 16-bit WAV of an mp3, with macOS afconvert."""
    try:
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(mp3), str(wav)], check=True, capture_output=True)
    except FileNotFoundError:
        sys.exit("--refresh-clips needs macOS afconvert")


def load_poem(poets_dir, path):
    raw = json.loads((poets_dir / f"{path.lstrip('/')}.json").read_text(encoding="utf-8"))
    return raw["Id"], group_couplets(raw["Verses"])


def cached(file, fetch):
    """The bytes of `file`, fetched once (a stopped run never leaves a half-written file)."""
    if not file.exists():
        file.parent.mkdir(parents=True, exist_ok=True)
        part = file.with_name(file.name + ".part")
        part.write_bytes(fetch())
        part.replace(file)
    return file


def prepare(download, folder, poem_id):
    """(recitation, timing marks, mp3 file) of a poem's recitation as the app picks it; the list is always asked live."""
    recitation = pick_recitation(json.loads(download(RECITATIONS_API.format(poem=poem_id))))
    if not recitation:
        return None
    xml = cached(folder / f"{recitation['id']}.xml", lambda: download(recitation["xmlUrl"]))
    mp3 = cached(folder / f"{recitation['id']}.mp3", lambda: download(recitation["mp3Url"]))
    return recitation["id"], parse_timing(xml.read_bytes()), mp3


def measure(entry, recitation, marks, couplets, wav):
    """(clip or None, report row) of one deck entry."""
    row = {"key": key(entry), "recitation": recitation, "status": "no timing"}
    marked = first_hemistich(marks, couplets, entry["index"])
    if not marked:
        return None, row
    start_mark, next_mark = marked
    row.update(start_mark=start_mark, next_mark=next_mark, old_end=round(old_end(start_mark, next_mark), 3), status="no silence")
    found = find_range(lambda a, b: silence.read_db(wav, a, b), start_mark, next_mark)
    if not found:
        return None, row
    row.update(status="clean", **{k: round(v, 3) for k, v in found.items()})
    return {"recitation": recitation, "start": found["start"], "end": found["end"]}, row


def refresh(deck, poets_dir, cache, download, decoder=decode):
    """(snapshot, report rows) for the Hafez couplets of the deck. Snapshot: {key: {recitation, start, end} or None
    when the couplet keeps the margin rule}. Poems are prepared (downloaded) in parallel, then analysed one by one."""
    entries = [e for e in deck if e["poet"] == "hafez"]
    poems = {}
    for entry in entries:
        poems.setdefault(entry["poem"], []).append(entry)
    folder = cache / "clips"
    loaded = {path: load_poem(poets_dir, path) for path in poems}
    with ThreadPoolExecutor(8) as pool:
        prepared = dict(zip(poems, pool.map(lambda path: prepare(download, folder, loaded[path][0]), poems)))
    snapshot, rows = {}, []
    with tempfile.TemporaryDirectory() as temp:
        for path, group in poems.items():
            ready = prepared[path]
            wav = Path(temp) / "poem.wav"
            if ready:
                decoder(ready[2], wav)
            for entry in group:
                if not ready:
                    snapshot[key(entry)], row = None, {"key": key(entry), "status": "no recitation"}
                else:
                    snapshot[key(entry)], row = measure(entry, ready[0], ready[1], loaded[path][1], wav)
                rows.append(row)
    return snapshot, rows


def dump_snapshot(snapshot):
    """clips.json text: one couplet per line, in deck order's key order (poem path, index), so a refresh diffs cleanly."""
    def order(k):
        path, index = k.rsplit("#", 1)
        return path, int(index)
    lines = [f"{json.dumps(k)}:{json.dumps(snapshot[k], separators=(',', ':'))}" for k in sorted(snapshot, key=order)]
    return "{\n" + ",\n".join(lines) + "\n}\n"


def load_snapshot(text):
    return json.loads(text)


def with_clips(deck, snapshot):
    """The deck with each Hafez couplet's `clip` ({recitation, start, end}) added. Fails on a Hafez couplet the snapshot
    has no answer for (not even «none»), since that means the deck changed without `--refresh-clips`."""
    missing = [key(e) for e in deck if e["poet"] == "hafez" and key(e) not in snapshot]
    if missing:
        raise ValueError(f"clips.json has no entry for {len(missing)} deck couplets (e.g. {missing[0]})")
    return [{**e, "clip": snapshot[key(e)]} if snapshot.get(key(e)) else e for e in deck]


REPORT_COLUMNS = ["key", "recitation", "status", "start_mark", "next_mark", "old_end", "start", "end", "quiet_from", "onset", "floor", "voice"]


def dump_report(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, REPORT_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()
