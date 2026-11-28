"""فال حافظ: make a wish → hold the divan → it opens → your ghazal, what Hafez says, the whole ghazal, a card to share;
a fal with a friend (pick, both hold, one ghazal for both); and the list of past fals.
Run after gen_feedback (it only adds boards; gen_v11 places them)."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gameicons.py"), encoding="utf-8").read())
exec(open(os.path.join(HERE, "emptyart.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

jig = rd("JigsawE.dc.html")
def head(t):
    return re.sub(r"<title>[^<]*</title>", f"<title>{t}</title>", jig[:jig.index('<div dir="rtl"')], count=1)
tail = jig[jig.index("</x-dc>"):]
def page(key, t, body, frame):
    wr(key, head(t) + f'<div dir="rtl" style="{frame}">\n' + body + "</div>\n" + tail)

direct = rd("Direct.dc.html")
SARA = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
def uniq(svg, tag):
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def face(svg, bg, size, tag, border=4):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; overflow: hidden; {SH}">{uniq(svg, tag)}</span>'
def me_face(size, tag):
    return disc(size, AMBER, f'<span style="font-family: \'Lalezar\', sans-serif; font-size: {size // 2 - 4}px; color: {INK}; padding-top: 4px;">ن</span>')

HAFEZ = "/_blob/05993349bc76fc57449fc1f70208d3f4"
def hafez(size, border=4):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {LAPIS}; border: {border}px solid #FFFFFF; overflow: hidden; {SH}"><img src="{HAFEZ}" alt="" style="width: 100%; height: 100%; display: block;"></span>'

POEM = "font-family: 'ParastooB', serif;"
NIGHT = ("position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 22px 34px; background-color: #1C20B8; "
         "background-image: radial-gradient(rgba(255,255,255,0.16) 1.2px, transparent 1.2px); background-size: 18px 18px; color: #FFFFFF; "
         "font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;")
PAPER = ("position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 20px 30px; background-color: #F1EFEA; "
         "background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; "
         "font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;")

def round_btn(icon, href="#", label="", bg="#FFFFFF", fg=INK):
    return f'<a href="{href}" aria-label="{label}" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {fg}; box-shadow: 0 2px 8px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{icon}</a>'
X = sv('<path d="M6 6l12 12M18 6L6 18"></path>', 20, "currentColor", 2.6)
SHARE = sv(I["plane"], 20, "currentColor", 2.2)
def topbar(title, sub, left="", close="Explore.dc.html", dark=False):
    c = "#FFFFFF" if dark else INK
    s2 = "rgba(255,255,255,0.7)" if dark else "#4A4660"
    return (f'<div style="display: flex; align-items: center; gap: 10px;">{round_btn(X, close, "بستن", "rgba(255,255,255,0.14)" if dark else "#FFFFFF", c)}'
            f'<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center;"><span style="font-family: \'Lalezar\', sans-serif; font-size: 20px; line-height: 1.1; color: {c};">{title}</span>'
            f'<span style="font-size: 12px; color: {s2};">{sub}</span></div>{left or "<span style=\'width: 44px;\'></span>"}</div>')

def ring(pct, size=132, color=AMBER, label="نگه دار", sub=""):
    r = 58
    c = 2 * 3.14159 * r
    arc = f'<circle cx="66" cy="66" r="{r}" fill="none" stroke="{color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="{c * pct:.1f} {c:.1f}" transform="rotate(-90 66 66)"></circle>' if pct else ""
    return (f'<a href="#" aria-label="نگه دار تا دیوان باز شه" style="text-decoration: none; position: relative; width: {size}px; height: {size}px; display: flex; align-items: center; justify-content: center;">'
            f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 132 132" style="position: absolute; inset: 0;"><circle cx="66" cy="66" r="{r}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="9"></circle>{arc}</svg>'
            f'<span style="width: 96px; height: 96px; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: {DEEP}; border: 5px solid #FFFFFF; box-shadow: 0 8px 22px rgba(0,0,0,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">'
            f'<span style="font-family: \'Lalezar\', sans-serif; font-size: 21px; padding-top: 4px; line-height: 1;">{label}</span>{f"<span style=\'font-size: 11px; color: #4A4660;\'>{sub}</span>" if sub else ""}</span></a>')

GHAZAL = [("یوسف گم گشته بازآید به کنعان غم مخور", "کلبه احزان شود روزی گلستان غم مخور"),
          ("ای دل غمدیده حالت به شود دل بد مکن", "وین سر شوریده بازآید به سامان غم مخور"),
          ("گر بهار عمر باشد باز بر تخت چمن", "چتر گل در سر کشی ای مرغ خوشخوان غم مخور"),
          ("دور گردون گر دو روزی بر مراد ما نرفت", "دائماً یکسان نباشد حال دوران غم مخور"),
          ("هان مشو نومید چون واقف نه‌ای از سر غیب", "باشد اندر پرده بازی‌های پنهان غم مخور"),
          ("ای دل ار سیل فنا بنیاد هستی برکند", "چون تو را نوح است کشتیبان ز طوفان غم مخور")]
TABIR = "هر چی از دستت رفته، برمی‌گرده. این روزای سخت موندگار نیست؛ صبر کن و امیدت رو نگه دار. کاری که براش نیت کردی، دیر یا زود سر و سامون می‌گیره."
WISH = "ای حافظ شیرازی، تو محرم هر رازی.<br>به شاخ نباتت قسم، هر چی صلاحه<br>برام آشکار کن."

# ---------------- 1 make a wish ----------------
scene = art(at(84, 34, ghazal_book(132, 168, LAPIS), -5, 2), at(196, 22, nabat(150), 16, 3), at(54, 150, hafez(70, 5), -8, 4),
            sparkle(40, 40, AMBER, 20), sparkle(262, 176, "#FFFFFF", 16), sparkle(30, 120, MAGENTA, 14), h=230)
page("FalIntro.dc.html", "فال حافظ: نیت کن", f'''  {topbar("فال حافظ", "نیت کن، بعد نگه دار", round_btn(sv(I["clock"], 20, "currentColor", 2.2), "FalHistory.dc.html", "فال‌های من", "rgba(255,255,255,0.14)", "#FFFFFF"), dark=True)}
  <div style="display: flex; justify-content: center; padding-top: 4px;">{scene}</div>
  <div style="background: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.28); border-radius: 22px; padding: 14px 16px; text-align: center; {POEM} font-size: 17px; line-height: 1.85;">{WISH}</div>
  <span style="text-align: center; font-size: 14px; color: rgba(255,255,255,0.82); line-height: 1.8;">یه لحظه چشماتو ببند و نیت کن.<br>بعد انگشتت رو روی دکمه نگه دار.</span>
  <div style="margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 14px;">
    <a href="FalOpening.dc.html" style="text-decoration: none; display: flex;">{ring(0)}</a>
    <a href="FalFriend.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; height: 40px; box-sizing: border-box; padding: 0 16px; border-radius: 999px; background: rgba(255,255,255,0.14); color: #FFFFFF; font-size: 14px; font-weight: 700;">{sv(I["users"], 18, "#FFFFFF", 2.2)}با یه دوست فال بگیر</a>
  </div>
''', NIGHT)

# ---------------- 2 opening ----------------
pages_fan = "".join(at(80 + i * 14, 40 + abs(i - 2) * 6, tile(90, 120, "#FFFFFF", f'<span style="display: flex; flex-direction: column; gap: 7px; width: 56px;">{"".join(f"<span style=\'height: 4px; border-radius: 2px; background: #DAD6E2;\'></span>" for _ in range(5))}</span>', 10, 4), (i - 2) * 12, 2 + i) for i in range(5))
scene2 = art(pages_fan, at(40, 150, word("غم مخور", AMBER, INK, 20, SH_UP), -10, 9), at(214, 14, word("یوسف", "#FFFFFF", INK, 18, SH_UP), 12, 9),
             sparkle(30, 40, AMBER, 22), sparkle(260, 120, "#FFFFFF", 18), sparkle(150, 186, MAGENTA, 16), h=230)
page("FalOpening.dc.html", "فال حافظ: داره باز می‌شه", f'''  {topbar("فال حافظ", "داره باز می‌شه", dark=True)}
  <div style="display: flex; justify-content: center; padding-top: 30px;">{scene2}</div>
  <span style="text-align: center; font-family: 'Lalezar', sans-serif; font-size: 26px; padding-top: 10px;">ول نکن…</span>
  <span style="text-align: center; font-size: 14px; color: rgba(255,255,255,0.82); line-height: 1.8;">ورق‌ها دارن می‌چرخن. هر چی بیشتر نگه داری،<br>گوشی آروم‌تر می‌لرزه، تا دیوان باز شه.</span>
  <div style="margin-top: auto; display: flex; justify-content: center;"><a href="FalResult.dc.html" style="text-decoration: none; display: flex;">{ring(0.7, label="۷۰٪", sub="نگه دار")}</a></div>
  <span style="text-align: center; font-size: 12px; color: rgba(255,255,255,0.6);">زودتر ول کنی، از اول شروع می‌شه.</span>
''', NIGHT)

# ---------------- 3 result ----------------
def result(key, title, sub, top_extra, cta_text, cta_href, second):
    first = GHAZAL[0]
    body = f'''  {topbar(title, sub, round_btn(SHARE, "FalShare.dc.html", "بفرست"), close="Explore.dc.html")}
  {top_extra}
  <div style="position: relative; margin-top: 12px; background: #FFFFFF; border-radius: 26px; padding: 24px 20px 18px; box-shadow: 0 4px 14px rgba(20,17,43,0.10); display: flex; flex-direction: column; gap: 6px;">
    <span aria-hidden="true" style="position: absolute; top: -14px; left: 16px; display: flex; transform: rotate(-6deg);">{pill("حافظ · غزل ۲۵۵", MAGENTA, "#FFFFFF", 12)}</span>
    <span aria-hidden="true" style="position: absolute; top: -30px; left: 150px; display: flex; transform: rotate(-12deg);">{nabat(58)}</span>
    <span style="font-size: 11px; font-weight: 700; color: {FIRE}; padding-top: 4px;">بیتِ فالت</span>
    <span style="align-self: flex-start; {POEM} font-size: 19px; line-height: 1.9; white-space: nowrap;">{first[0]}</span>
    <span style="align-self: flex-end; {POEM} font-size: 19px; line-height: 1.9; white-space: nowrap; padding-left: 26px;">{first[1]}</span>
    <span aria-hidden="true" style="position: absolute; bottom: 0; left: 0; width: 34px; height: 34px; background: linear-gradient(135deg, #E6E3EC 50%, transparent 50%); border-radius: 0 0 0 26px; box-shadow: 2px -2px 4px rgba(20,17,43,0.08);"></span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 6px; background: #FFF4D6; border-radius: 22px; padding: 14px 16px; border-right: 6px solid {AMBER};">
    <span style="font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px;">{sv(I["sparkle"], 16, FIRE, 3)}حافظ چی می‌گه؟</span>
    <span style="font-size: 14px; line-height: 1.85;">{TABIR}</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">
    {"".join(f'<a href="{h}" style="text-decoration: none; color: {INK}; display: flex; flex-direction: column; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 18px; padding: 12px 6px 10px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); font-size: 13px; font-weight: 700;">{sv(ic, 22, LAPIS, 2.2, fill)}{t}</a>' for ic, t, h, fill in [(I["book"], "کل غزل", "FalGhazal.dc.html", "none"), ('<path d="M8 5.5v13l10-6.5z"></path>', "بشنو", "FalGhazal.dc.html", LAPIS), (I["bookmark"], "نگه دار", "#", "none")])}
  </div>
  <a href="FalGhazal.dc.html" style="text-decoration: none; color: {INK}; position: relative; display: flex; flex-direction: column; gap: 2px; padding: 4px 18px 0; -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent 100%); mask-image: linear-gradient(180deg, #000 30%, transparent 100%); max-height: 130px; overflow: hidden;">
    {"".join(f'<span style="align-self: flex-start; {POEM} font-size: 16px; line-height: 1.9; color: #4A4660;">{a}</span><span style="align-self: flex-end; {POEM} font-size: 16px; line-height: 1.9; color: #4A4660;">{b}</span>' for a, b in GHAZAL[1:3])}
  </a>
  <div style="margin-top: auto; display: flex; flex-direction: column; align-items: stretch; gap: 10px;">{cta_btn(cta_text, cta_href)}<div style="text-align: center;">{second}</div></div>
'''
    page(key, title, body, PAPER)

result("FalResult.dc.html", "فال تو", "امروز · ۷ آذر", "",
       "کارتش رو بفرست", "FalShare.dc.html", ghost_btn("برای یه نیت دیگه", "FalIntro.dc.html"))

# ---------------- 4 whole ghazal ----------------
rows = []
for i, (a, b) in enumerate(GHAZAL):
    hi = i == 0
    st = f"background: #FFF4D6; border-radius: 16px; padding: 8px 12px; margin: 0 -12px; box-shadow: inset 0 0 0 2px {AMBER};" if hi else ""
    tag = f'<span style="align-self: center; font-family: \'Vazirmatn\', sans-serif; font-size: 11px; font-weight: 700; color: {FIRE};">بیتِ فالت</span>' if hi else ""
    rows.append(f'<div style="display: flex; flex-direction: column; {POEM} font-size: 19px; line-height: 1.9; {st}">{tag}<span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></div>')
player = (f'<div style="position: absolute; left: 16px; right: 16px; bottom: 26px; display: flex; align-items: center; gap: 12px; background: {INK}; color: #FFFFFF; border-radius: 22px; padding: 10px 14px; box-shadow: 0 6px 18px rgba(20,17,43,0.3);">'
          f'<span style="width: 40px; height: 40px; border-radius: 50%; background: #FFFFFF; display: flex; align-items: center; justify-content: center;">{sv("<path d=\'M8 5h3v14H8zM13 5h3v14h-3z\'></path>", 18, INK, 0, INK)}</span>'
          f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 5px;"><span style="font-size: 12px; font-weight: 700;">خوانش · از بیتِ فالت</span><span style="height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25);"><span style="display: block; width: 12%; height: 4px; border-radius: 2px; background: {AMBER};"></span></span></div></div>')
page("FalGhazal.dc.html", "فال تو: کل غزل", f'''  {topbar("کل غزل", "حافظ · غزل ۲۵۵ · فال امروز", round_btn('<span style="font-family: \'Lalezar\', sans-serif; font-size: 18px; padding-top: 3px;">آ</span>', "PoemText.dc.html", "اندازه‌ی حروف"), close="FalResult.dc.html")}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 10px 8px 0;">{"".join(rows)}</div>
  {player}
''', PAPER.replace("gap: 14px", "gap: 10px"))

# ---------------- 5 share card ----------------
card = (f'<div style="position: relative; width: 262px; height: 440px; box-sizing: border-box; border-radius: 28px; background-color: #1C20B8; '
        f'background-image: radial-gradient(rgba(255,255,255,0.16) 1.2px, transparent 1.2px); background-size: 14px 14px; border: 6px solid #FFFFFF; {SH_UP} '
        f'color: #FFFFFF; padding: 26px 18px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; transform: rotate(-3deg);">'
        f'<span style="font-family: \'Lalezar\', sans-serif; font-size: 20px; padding-top: 4px;">فال من از حافظ</span>'
        f'<span aria-hidden="true" style="position: absolute; top: 54px; left: -14px; display: flex; transform: rotate(-14deg);">{nabat(84)}</span>'
        f'<div style="margin-top: 46px; background: #FFFFFF; color: {INK}; border-radius: 18px; padding: 14px 10px; text-align: center; {POEM} font-size: 14px; line-height: 2; white-space: nowrap;">{GHAZAL[0][0]}<br>{GHAZAL[0][1]}</div>'
        f'<span style="font-size: 12px; line-height: 1.7; text-align: center; color: rgba(255,255,255,0.88);">هر چی از دستت رفته، برمی‌گرده.</span>'
        f'<span style="margin-top: auto; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;">'
        f'<span style="display: flex; gap: 3px;"><span style="width: 9px; height: 13px; border-radius: 3px; background: {LAPIS}; border: 2px solid #FFFFFF;"></span><span style="width: 9px; height: 13px; border-radius: 3px; background: {FIRE}; border: 2px solid #FFFFFF;"></span></span>yebeyt.com · یه بیت</span></div>')
def chan(t, bg, icon, fg="#FFFFFF"):
    return f'<a href="#" style="text-decoration: none; color: {INK}; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;">{disc(56, bg, sv(icon, 24, fg, 2.2), 4)}{t}</a>'
page("FalShare.dc.html", "فال تو: کارت", f'''  {topbar("کارتِ فالت", "اسم و نیتت روش نیست", close="FalResult.dc.html")}
  <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">{card}</div>
  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; background: #FFFFFF; border-radius: 24px; padding: 16px 8px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    {chan("استوری", MAGENTA, '<rect x="4" y="4" width="16" height="16" rx="5"></rect><circle cx="12" cy="12" r="3.6"></circle>')}{chan("پیام‌ها", LAPIS, I["plane"])}{chan("ذخیره", INK, I["down"])}{chan("بیشتر", "#FFFFFF", '<circle cx="6" cy="12" r="1.2"></circle><circle cx="12" cy="12" r="1.2"></circle><circle cx="18" cy="12" r="1.2"></circle>', INK)}
  </div>
''', PAPER)

# ---------------- 6 with a friend: pick ----------------
FR = [("سارا", "sara.ghazal", "#FF3D8B", True), ("کیان", "kian_k", "#FF4D24", False), ("مهسا", "mahsa.m", "#FFB703", False), ("آرین", "aryan", "#6CCB3A", False)]
def fr_row(n, u, bg, on):
    mark = f'<span style="width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; background: {LAPIS}; border: 3px solid #FFFFFF; {SH} display: flex; align-items: center; justify-content: center;">{sv(I["check"], 14, "#FFFFFF", 3.4)}</span>' if on else f'<span style="width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; border: 3px solid #DAD6E2;"></span>'
    fc = face(SARA, bg, 48, "f" + u.replace(".", "")) if n == "سارا" else disc(48, bg, f'<span style="font-family: \'Lalezar\', sans-serif; font-size: 20px; color: #FFFFFF; padding-top: 3px;">{n[0]}</span>', 3)
    return f'<a href="#" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 2px dashed #ECE9F1;">{fc}<div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="font-size: 15px; font-weight: 700;">{n}</span><span style="font-size: 12px; color: {GREY};" dir="ltr">@{u}</span></div>{mark}</a>'
page("FalFriend.dc.html", "فال با دوست: انتخاب", f'''  {topbar("فال با یه دوست", "یه نیت مشترک، یه غزل برای هر دو", close="FalIntro.dc.html")}
  <div style="display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 22px; padding: 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">{nabat(70)}<span style="font-size: 13px; line-height: 1.8; color: #4A4660;">با دوستت یه نیت مشترک بکنید. وقتی هر دو انگشتتون رو نگه دارید، دیوان برای هر دوتون با هم باز می‌شه.</span></div>
  <label style="display: flex; align-items: center; gap: 10px; height: 46px; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF;">{sv(I["search"], 18, "#4A4660", 2.2)}<span style="font-size: 14px; color: {GREY};">بین دوستات بگرد</span></label>
  <div style="background: #FFFFFF; border-radius: 24px; padding: 6px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.06);">{"".join(fr_row(*f) for f in FR)}</div>
  <a href="#" style="text-decoration: none; align-self: center; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: {LAPIS};">{sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>', 18, LAPIS, 2.2)}دوستت اپ رو نداره؟ لینک بفرست</a>
  <div style="margin-top: auto; display: flex; flex-direction: column;">{cta_btn("دعوت کن", "FalPair.dc.html")}</div>
  <span style="text-align: center; font-size: 12px; color: {GREY}; margin-top: -4px;">فال با دوست حساب لازم داره.</span>
''', PAPER)

# ---------------- 7 with a friend: both hold ----------------
def holder(fc, name, pct, state):
    r = 46
    c = 2 * 3.14159 * r
    arc = f'<circle cx="54" cy="54" r="{r}" fill="none" stroke="{AMBER}" stroke-width="8" stroke-linecap="round" stroke-dasharray="{c * pct:.1f} {c:.1f}" transform="rotate(-90 54 54)"></circle>' if pct else ""
    return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;"><span style="position: relative; width: 108px; height: 108px; display: flex; align-items: center; justify-content: center;">'
            f'<svg aria-hidden="true" width="108" height="108" viewBox="0 0 108 108" style="position: absolute; inset: 0;"><circle cx="54" cy="54" r="{r}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="8"></circle>{arc}</svg>{fc}</span>'
            f'<span style="font-size: 15px; font-weight: 700;">{name}</span><span style="font-size: 12px; color: rgba(255,255,255,0.75);">{state}</span></div>')
page("FalPair.dc.html", "فال با دوست: با هم نگه دارید", f'''  {topbar("فال با سارا", "هر دو با هم نگه دارید", dark=True, close="FalFriend.dc.html")}
  <div style="display: flex; justify-content: center; padding-top: 6px;">{art(at(84, 10, ghazal_book(132, 168, LAPIS), -4, 2), at(206, 40, nabat(120), 16, 3), sparkle(40, 40, AMBER, 20), sparkle(250, 170, "#FFFFFF", 16), h=200)}</div>
  <div style="display: flex; justify-content: space-around; align-items: flex-start; padding-top: 6px;">{holder(face(SARA, "#FF3D8B", 80, "pair"), "سارا", 1.0, "نگه داشته، منتظر توئه")}{holder(me_face(80, "me"), "تو", 0.35, "نگه دار…")}</div>
  <span style="text-align: center; font-size: 14px; color: rgba(255,255,255,0.82); line-height: 1.8;">نیتتون رو یکی کنید. اگه یکی‌تون ول کنه،<br>از اول شروع می‌شه.</span>
  <div style="margin-top: auto; display: flex; justify-content: center;"><a href="FalPairResult.dc.html" style="text-decoration: none; display: flex;">{ring(0.35, label="نگه دار")}</a></div>
''', NIGHT)

# ---------------- 8 with a friend: result ----------------
both = (f'<div style="display: flex; align-items: center; justify-content: center; gap: 10px;"><span style="display: flex;">{face(SARA, "#FF3D8B", 46, "res")}<span style="margin-right: -14px; display: flex;">{me_face(46, "res2")}</span></span>'
        f'<span style="font-size: 13px; color: #4A4660;">یه غزل برای تو و سارا · توی پیام‌هاتون هم هست</span></div>')
result("FalPairResult.dc.html", "فال تو و سارا", "امروز · ۷ آذر", both,
       "برو به پیام‌ها", "Direct.dc.html", ghost_btn("کارتش رو بفرست", "FalShare.dc.html"))

# ---------------- 9 my fals ----------------
HIST = [("امروز", "یوسف گم گشته بازآید به کنعان غم مخور", "غزل ۲۵۵", ""), ("۳ آذر", "دوش دیدم که ملائک در میخانه زدند", "غزل ۱۸۴", "با سارا"),
        ("۲۹ آبان", "صبا به لطف بگو آن غزال رعنا را", "غزل ۴", ""), ("۲۰ آبان", "روز وصل دوستداران یاد باد", "غزل ۱۰۴", "")]
def h_row(d, m, g, w):
    chip = f'<span style="background: #FFE3EE; color: {MAGENTA}; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700;">{w}</span>' if w else ""
    return (f'<a href="FalResult.dc.html" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 20px; padding: 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">'
            f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;"><span style="{POEM} font-size: 17px; line-height: 1.7;">{m}</span>'
            f'<span style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: {GREY};">{d} · {g}{chip}</span></div>{sv(I["bookmark"], 18, "#DAD6E2", 2.2)}</a>')
page("FalHistory.dc.html", "فال‌های من", f'''  {topbar("فال‌های من", "فقط روی همین گوشی، فقط برای خودت", close="FalIntro.dc.html")}
  <div style="display: flex; flex-direction: column; gap: 10px;">{"".join(h_row(*h) for h in HIST)}</div>
  <span style="text-align: center; font-size: 12px; color: {GREY}; line-height: 1.7;">نیتت جایی نوشته نمی‌شه. فقط غزل و روزش می‌مونه.</span>
''', PAPER)
print("fal boards written")
