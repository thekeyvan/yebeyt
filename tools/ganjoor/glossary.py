"""The word glossary (glossary.json): the hard words of couplets with their meanings. It feeds معنی‌یاب and, later,
the dotted words of the reader. `tools/ganjoor/glossary.json` is the written source; the build checks every word is
really in its couplet of a bundled book and copies it to the app. Pure rules, tested in test_glossary.py.

An entry is {path, couplet, words: [{text, m, gloss}]}: `couplet` is 0-based as in the reader, `m` is the hemistich
(1 or 2) and `text` is one or more whole words of it, matched after the same normalisation the app uses."""
import unicodedata

FOLDED = {0x64A: "ی", 0x649: "ی", 0x643: "ک", 0x622: "ا", 0x623: "ا", 0x625: "ا", 0x629: "ه"}


def normalize(text):
    """The app's TextNormalizer: no diacritics or tatweel, Arabic letters folded, half-space and punctuation to space."""
    out = []
    for ch in text:
        code = ord(ch)
        if 0x64B <= code <= 0x65F or code in (0x670, 0x640):
            continue
        if code in FOLDED:
            out.append(FOLDED[code])
        elif code in (0x200C, 0x200D):
            out.append(" ")
        elif 0x6F0 <= code <= 0x6F9:
            out.append(chr(code - 0x6F0 + 48))
        elif 0x660 <= code <= 0x669:
            out.append(chr(code - 0x660 + 48))
        elif unicodedata.category(ch).startswith("P"):
            out.append(" ")
        else:
            out.append(ch)
    return " ".join("".join(out).lower().split())


def validate(entries, poems):
    """The problems of the entries, as text; `poems` maps a poem path to its couplets ({m1, m2})."""
    problems, seen = [], set()
    for e in entries:
        where = f"{e.get('path')} #{e.get('couplet')}"
        if (e.get("path"), e.get("couplet")) in seen:
            problems.append(f"{where}: listed twice")
        seen.add((e.get("path"), e.get("couplet")))
        couplets = poems.get(e.get("path"))
        index = e.get("couplet")
        if couplets is None or not isinstance(index, int) or not 0 <= index < len(couplets):
            problems.append(f"{where}: no such couplet in the bundled books")
            continue
        if not e.get("words"):
            problems.append(f"{where}: no words")
        for w in e.get("words", []):
            text = normalize(w.get("text", ""))
            if w.get("m") not in (1, 2):
                problems.append(f"{where}: {w.get('text')}: m must be 1 or 2")
            elif not text or f" {text} " not in f" {normalize(couplets[index]['m' + str(w['m'])])} ":
                problems.append(f"{where}: {w.get('text')} is not in hemistich {w['m']}")
            if not (w.get("gloss") or "").strip():
                problems.append(f"{where}: {w.get('text')} has no gloss")
    return problems
