"""Post-process every board: self-hosted fonts + bold Parastoo as the poem font.
Run after gen_explore -> gen_calm -> gen_home -> gen_player (and gen_fonts / gen_fontscroll).
Idempotent."""
import json, os, re, sys
P = sys.argv[1]

MARK = "/*selfhost3*/"
FACES = (MARK +
    "@font-face{font-family:'Lalezar';src:url(/_blob/91276f4d8a8d6bca78223fd68eadf8aa)}"
    "@font-face{font-family:'Vazirmatn';src:url(/_blob/6a49fbd82ab892566ec799ad491bb03f);font-weight:100 900}"
    "@font-face{font-family:'Mirza';src:url(/_blob/7909ed4a33ffd0ad24343f4fc4e9ec1e);font-weight:100 300;size-adjust:92%}"
    "@font-face{font-family:'Mirza';src:url(/_blob/93f844cb9ac5efbed9a28e44eba1b6ef);font-weight:400 500;size-adjust:92%}"
    "@font-face{font-family:'Mirza';src:url(/_blob/38616ee262f2ab2be6fa1de0c5b78eb7);font-weight:600;size-adjust:92%}"
    "@font-face{font-family:'Mirza';src:url(/_blob/c1d812388e5b506decf856c1e4eef8b8);font-weight:700 900;size-adjust:92%}"
    "@font-face{font-family:'ParastooB';src:url(/_blob/d01029bfededb1746e99ad15b6bce937);size-adjust:84%}")

KEEP_FAMILIES = {"PoemFonts.dc.html", "PoemScrollGulzar.dc.html"}  # comparison boards keep their fonts
POEM_FAMS = ("font-family: 'Parastoo'", "font-family: 'Noto Naskh Arabic'", "font-family: 'Mirza'")
POEM = "font-family: 'ParastooB'"  # the chosen poem font: Parastoo Bold

M = "font-family: 'ParastooB', serif; font-size: "
SIZE_FIX = {
    "Calm.dc.html": [(M + "23px; line-height: 2;", M + "20px; line-height: 2.1;")],
    "Poem.dc.html": [(M + "27px; line-height: 2;", M + "21px; line-height: 2.1;")],
    "PoemMeaning.dc.html": [(M + "24px; line-height: 2;", M + "21px; line-height: 2.1;")],
    "PoemText.dc.html": [(M + "30px; line-height: 2;", M + "22px; line-height: 2.1;")],
    "PoemScrollC.dc.html": [(M + "14.5px; line-height: 1.8;", M + "12.5px; line-height: 1.9;")],
}

d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
changed = []
for k, v in d["boards"].items():
    path = os.path.join(P, k)
    if not os.path.exists(path):
        continue
    s = open(path, encoding="utf-8").read()
    o = s
    s = re.sub(r"\n/\*selfhost\d*\*/[^\n]*", "", s)  # drop older generations of the block
    if MARK not in s:
        s = s.replace("<style>\nbody{margin:0}", "<style>\nbody{margin:0}\n" + FACES, 1)
        assert MARK in s, k
    if v["page"] == "sticker" and k not in KEEP_FAMILIES:
        if k != "PoemText.dc.html":  # PoemText is written by gen_v11 with its own font cards
            for f in POEM_FAMS:
                s = s.replace(f, POEM)
    # Mirza runs wider than Parastoo: shrink the big single-couplet sizes so misras stay on one line
    for old, new in SIZE_FIX.get(k, []):
        s = s.replace(old, new)
    if s != o:
        open(path, "w", encoding="utf-8").write(s)
        changed.append(k)

# Mirza is now the default everywhere, so the separate Mirza comparison board goes.
removed = []
if "PoemScrollMirza.dc.html" in d["boards"]:
    del d["boards"]["PoemScrollMirza.dc.html"]
    d["order"] = [x for x in d["order"] if x != "PoemScrollMirza.dc.html"]
    d["boards"]["PoemScrollGulzar.dc.html"]["x"] = 3990
    removed.append("PoemScrollMirza.dc.html")
    json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("changed", len(changed), changed)
print("removed", removed)
