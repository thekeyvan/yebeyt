"""v12: whole-poem view shares the couplet view's exact header + toggle; comparison row removed once bold Parastoo was chosen.
Runs LAST (after apply_fonts) because it works from the final Poem.dc.html."""
import json, os, re, sys
P = sys.argv[1]
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

poem = rd("Poem.dc.html")
start = poem.index('<div dir="rtl"')
tog_m = re.search(r'  <div role="group" aria-label="حالت خوندن".*?</div>\n', poem)
top = poem[start:tog_m.end()]          # page frame + header + toggle, exactly as in بیت به بیت
head = poem[:start]
tail = poem[poem.index("</x-dc>"):]

ON = "font-weight: 700; color: #FFFFFF; background: #2F35F5;"
OFF = "font-weight: 500; color: #14112B; background: transparent;"
def flip(t):
    t = t.replace('href="Poem.dc.html" aria-current="true"', 'href="Poem.dc.html" aria-current="false"', 1)
    t = t.replace('href="PoemScroll.dc.html" aria-current="false"', 'href="PoemScroll.dc.html" aria-current="true"', 1)
    a, b = t.split('href="PoemScroll.dc.html"', 1)
    a = a[::-1].replace(ON[::-1], OFF[::-1], 1)[::-1]   # last style before the split = بیت به بیت button
    b = b.replace(OFF, ON, 1)
    return a + 'href="PoemScroll.dc.html"' + b
top_scroll = top[:top.index('  <div role="group"')] + flip(top[top.index('  <div role="group"'):])

ALL9 = [
    ("اگر آن ترک شیرازی به دست آرد دل ما را", "به خال هندویش بخشم سمرقند و بخارا را"),
    ("بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را"),
    ("فغان کاین لولیان شوخ شیرین کار شهرآشوب", "چنان بردند صبر از دل که ترکان خوان یغما را"),
    ("ز عشق ناتمام ما جمال یار مستغنی است", "به آب و رنگ و خال و خط چه حاجت روی زیبا را"),
    ("من از آن حسن روزافزون که یوسف داشت دانستم", "که عشق از پرده عصمت برون آرد زلیخا را"),
    ("حدیث از مطرب و می گو و راز دهر کمتر جو", "که کس نگشود و نگشاید به حکمت این معما را"),
    ("نصیحت گوش کن جانا که از جان دوست‌تر دارند", "جوانان سعادتمند پند پیر دانا را"),
    ("بدم گفتی و خرسندم عفاک الله نکو گفتی", "جواب تلخ می‌زیبد لب لعل شکرخا را"),
    ("غزل گفتی و در سفتی بیا و خوش بخوان حافظ", "که بر نظم تو افشاند فلک عقد ثریا را"),
]
mark = '<div aria-hidden="true" style="align-self: center; display: flex; gap: 3px;"><span style="width: 6px; height: 9px; border-radius: 2px; background: #2F35F5;"></span><span style="width: 6px; height: 9px; border-radius: 2px; background: #FF4D24;"></span></div>'
couplets = f"\n    {mark}\n".join(
    f'''    <a href="Poem.dc.html" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; font-family: 'ParastooB', serif; font-size: 20px; line-height: 1.9;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>'''
    for a, b in ALL9)
fade = "-webkit-mask-image: linear-gradient(180deg, transparent 0, #000 22px, #000 84%, transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 22px, #000 84%, transparent 100%);"
SAVE = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>'
SEND = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path></svg>'
pill = lambda label, svg: f'<a href="#" aria-label="{label}" style="width: 44px; height: 44px; border-radius: 50%; background: #F1EFEA; color: #14112B; display: flex; align-items: center; justify-content: center;">{svg}</a>'
bar = f'''  <div style="position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: #FFFFFF; border-radius: 999px; padding: 6px; box-shadow: 0 4px 16px rgba(20,17,43,0.16);">
    <a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; border-radius: 999px; background: #2F35F5; color: #FFFFFF; padding: 0 18px 0 16px; font-size: 14px; font-weight: 700; white-space: nowrap;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="#FFFFFF"></path></svg>بخون برام</a>
    {pill("نگه دار", SAVE)}
    {pill("بفرست", SEND)}
  </div>
'''
scroll = head + top_scroll + f'''  <div style="position: absolute; top: 152px; bottom: 0; right: 26px; left: 26px; display: flex; flex-direction: column; gap: 14px; padding: 20px 0 120px; overflow: hidden; {fade}">
{couplets}
  </div>
{bar}</div>
''' + tail
scroll = scroll.replace("<title>خوندن غزل</title>", "<title>کل شعر</title>")
wr("PoemScroll.dc.html", scroll)

# ---------- the mode toggle sits in the same place on every reading screen ----------
toggle_line = tog_m.group(0)
for k in ["PoemMeaning.dc.html", "PoemText.dc.html"]:
    t = rd(k)
    if 'aria-label="حالت خوندن"' not in t:
        i = t.index('aria-label="اندازه‌ی حروف"')
        j = t.index("\n  </div>\n", i) + len("\n  </div>\n")
        t = t[:j] + toggle_line + t[j:]
    if k == "PoemText.dc.html":
        hdr_poem = top[top.index("\n") + 1: top.index('  <div role="group"')]
        h0 = t.index('  <div style="display: flex; align-items: center; gap: 10px;">')
        h1 = t.index('  <div role="group" aria-label="حالت خوندن"')
        t = t[:h0] + hdr_poem + t[h1:]
        t = t.replace("position: absolute; top: 118px; right: 30px; left: 30px;", "position: absolute; top: 158px; right: 30px; left: 30px;")
    wr(k, t)

# ---------- 1-8 long-press on a couplet: same actions as the couplet itself ----------
def sv(path, color="currentColor", fill="none", size=22):
    return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
HEART = '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path>'
RESH = '<path d="M17 3l3 3-3 3M4 12V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 12v3a3 3 0 0 1-3 3H4"></path>'
SENDP = '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>'
SAVEP = '<path d="M6 3.5h12v17l-6-4-6 4z"></path>'
BOOK = '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path>'
FOCUS = '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"></path><path d="M8 10.5h8M9.5 13.5h5"></path>'
CTRL = '<rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="currentColor"></circle>'
COPY = '<rect x="8" y="8" width="12" height="12" rx="2.5"></rect><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"></path>'
def round_act(label, svg, color="#14112B"):
    return f'<a href="#" aria-label="{label}" style="width: 52px; height: 52px; border-radius: 50%; background: #F1EFEA; color: {color}; display: flex; align-items: center; justify-content: center;">{svg}</a>'
def row(label, svg, href="#", last=False):
    sep = "" if last else " border-bottom: 1px solid #F1EFEA;"
    return f'<a href="{href}" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; padding: 12px 4px;{sep} font-size: 15px; font-weight: 500;"><span style="color: #2F35F5; display: flex;">{svg}</span>{label}</a>'
a2, b2 = ALL9[1]
hold_layer = f'''  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.38); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);"></div>
  <div role="dialog" aria-label="کارهای این بیت" style="position: absolute; top: 262px; right: 16px; left: 16px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 18px 20px; box-shadow: 0 18px 36px rgba(20,17,43,0.32); transform: scale(1.03) rotate(-1.5deg); font-family: 'ParastooB', serif; font-size: 20px; line-height: 1.9; color: #14112B;"><span style="align-self: flex-start;">{a2}</span><span style="align-self: flex-end;">{b2}</span><span style="align-self: flex-end; font-family: 'Vazirmatn', sans-serif; font-size: 12px; color: #4A4660; padding-top: 4px;">حافظ · غزل ۳ · بیت ۲</span></div>
    <div style="display: flex; justify-content: space-between; background: #FFFFFF; border-radius: 26px; padding: 10px 16px; box-shadow: 0 8px 20px rgba(20,17,43,0.18);">{round_act("پسند", sv(HEART, "#FF3D8B"), "#FF3D8B")}{round_act("بازنشر", sv(RESH))}{round_act("بفرست", sv(SENDP))}{round_act("نگه دار", sv(SAVEP))}</div>
    <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 4px 16px; box-shadow: 0 8px 20px rgba(20,17,43,0.18);">
      {row("معنی این بیت", sv(BOOK, size=20), "PoemMeaning.dc.html")}
      {row("بیت به بیت، از همین بیت", sv(FOCUS, size=20), "Poem.dc.html")}
      {row("بازی با این بیت", sv(CTRL, size=20), "JigsawE.dc.html")}
      {row("کپی متن", sv(COPY, size=20), last=True)}
    </div>
  </div>
'''
hold_page = head + top_scroll + f'''  <div style="position: absolute; top: 152px; bottom: 0; right: 26px; left: 26px; display: flex; flex-direction: column; gap: 14px; padding: 20px 0 120px; overflow: hidden; {fade}">
{couplets}
  </div>
{bar}{hold_layer}</div>
''' + tail
hold_page = hold_page.replace("<title>خوندن غزل</title>", "<title>نگه داشتن روی بیت</title>")
wr("PoemScrollHold.dc.html", hold_page)

# ---------- comparison row is settled (bold Parastoo won): remove it ----------
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
for k in ["FlowCmp.dc.html", "CmpPoemMirza.dc.html", "CmpScrollMirza.dc.html", "CmpPoemParastoo.dc.html",
          "CmpScrollParastoo.dc.html", "CmpPoemLateef.dc.html", "CmpScrollLateef.dc.html",
          "PoemScrollA.dc.html", "PoemScrollB.dc.html", "PoemScrollC.dc.html"]:  # old whole-poem options gen_player still writes
    d["boards"].pop(k, None)
    d["order"] = [x for x in d["order"] if x != k]
    if os.path.exists(os.path.join(P, k)):
        os.remove(os.path.join(P, k))
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v12")
