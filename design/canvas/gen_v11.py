"""v11: paper whole-poem view (from the lapis option), richer text sheet, flow layout of the canvas.
Run after gen_player / gen_fonts, before apply_fonts."""
import json, os, shutil, sys, tempfile
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))

# borrow gen_player's helpers without letting it overwrite the real boards
tmp = tempfile.mkdtemp()
shutil.copy(os.path.join(P, "canvas.json"), tmp)
g = {"__name__": "gp"}
sys.argv = ["gen_player.py", tmp]
exec(compile(open(os.path.join(HERE, "gen_player.py"), encoding="utf-8").read(), "gen_player.py", "exec"), g)
sys.argv = ["gen_v11.py", P]
shell, topbar, ALL9, HAFEZ_W, bar9, fade = g["shell"], g["topbar"], g["ALL9"], g["HAFEZ_W"], g["bar9"], g["fade"]
HEAD, TAIL, header, B9 = g["HEAD"], g["TAIL"], g["header"], g["B9"]

# ---------- 1-7 whole poem: the lapis layout on reading paper ----------
mark = '<div aria-hidden="true" style="align-self: center; display: flex; gap: 3px;"><span style="width: 6px; height: 9px; border-radius: 2px; background: #2F35F5;"></span><span style="width: 6px; height: 9px; border-radius: 2px; background: #FF4D24;"></span></div>'
couplets = f"\n    {mark}\n".join(
    f'''    <a href="Poem.dc.html" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; font-family: 'Parastoo', serif; font-size: 20px; line-height: 1.9;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>'''
    for a, b in ALL9)
scroll = shell("کل شعر", "background: #F7F5F0;", topbar() + f'''  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 4px;">
    <span aria-hidden="true" style="width: 58px; height: 58px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 4px solid #FFFFFF; box-shadow: 0 3px 10px rgba(20,17,43,0.18); overflow: hidden;"><img src="{HAFEZ_W}" alt="" style="width: 100%; height: 100%; display: block;"></span>
    <div style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1.2;">غزل ۳</div>
    <div style="font-size: 13px; color: #4A4660;">حافظ · ۹ بیت</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px; padding: 0 8px 120px; {fade}">
{couplets}
  </div>
{bar9}''')
open(os.path.join(P, "PoemScroll.dc.html"), "w", encoding="utf-8").write(scroll)

# ---------- 1-6 text sheet: + weight and misra layout ----------
fonts = [("پرستو", "'ParastooB', serif", True), ("نسخ", "'Noto Naskh Arabic', serif", False),
         ("نستعلیق", "'Noto Nastaliq Urdu', serif", False), ("گندم", "'Gandom', serif", False), ("مرکزی", "'Markazi Text', serif", False),
         ("شبنم", "'Shabnam', sans-serif", False), ("ساحل", "'Sahel', sans-serif", False), ("وزیر", "'Vazirmatn', sans-serif", False)]
font_cards = "".join(f'''<a href="#" aria-pressed="{"true" if sel else "false"}" style="text-decoration: none; color: #14112B; flex: 0 0 72px; display: flex; flex-direction: column; align-items: center; gap: 0; background: #FFFFFF; border: 3px solid {"#2F35F5" if sel else "#EEEBF2"}; border-radius: 16px; padding: 6px 4px 5px;"><span style="font-family: {fam}; font-size: 21px; line-height: 1.7;">بیت</span><span style="font-size: 11px; font-weight: {700 if sel else 500}; color: {"#2F35F5" if sel else "#4A4660"};">{n}</span></a>''' for n, fam, sel in fonts)

def seg(label, items, sel):
    """items: list of (inner_html, aria_label)"""
    b = "".join(f'<button aria-label="{al}" aria-pressed="{"true" if i == sel else "false"}" style="flex: 1; height: 38px; border: none; border-radius: 12px; background: {"#2F35F5" if i == sel else "transparent"}; color: {"#FFFFFF" if i == sel else "#14112B"}; font-family: \'Vazirmatn\', sans-serif; font-size: 13px; font-weight: {700 if i == sel else 500}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">{inner}</button>' for i, (inner, al) in enumerate(items))
    return f'''<div style="display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 0;"><div style="font-size: 13px; font-weight: 700; color: #4A4660;">{label}</div><div role="group" aria-label="{label}" style="display: flex; gap: 4px; background: #F1EFEA; border-radius: 14px; padding: 4px;">{b}</div></div>'''

def wt(fam, name):
    return (f"<span style=\"font-family: '{fam}', serif; font-size: 18px; line-height: 1;\">بیت</span><span>{name}</span>", name)

# stagger / centred glyphs: two short bars
def lay_icon(stagger, col):
    a, b = ("flex-start", "flex-end") if stagger else ("center", "center")
    return (f'<span aria-hidden="true" style="width: 22px; display: flex; flex-direction: column; gap: 3px;"><span style="align-self: {a}; width: 14px; height: 3px; border-radius: 2px; background: {col};"></span><span style="align-self: {b}; width: 14px; height: 3px; border-radius: 2px; background: {col};"></span></span>')

weight_row = seg("وزن قلم", [wt("Parastoo", "معمولی"), wt("ParastooB", "پررنگ")], 1)
layout_row = seg("چینش مصراع‌ها", [(lay_icon(True, "#FFFFFF") + "پلکانی", "پلکانی"), (lay_icon(False, "#14112B") + "وسط‌چین", "وسط‌چین")], 0)
spacing_row = seg("فاصله‌ی خط‌ها", [("کم", "کم"), ("معمولی", "معمولی"), ("زیاد", "زیاد")], 2)
themes = "".join(f'''<a href="#" aria-label="{n}" aria-pressed="{"true" if sel else "false"}" style="text-decoration: none; color: #14112B; flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; height: 46px; box-sizing: border-box; border-radius: 14px; background: {bg}; border: 3px solid {"#2F35F5" if sel else "#E6E3EC"}; font-size: 13px; font-weight: {700 if sel else 500}; color: {fg};"><span style="font-family: 'ParastooB', serif; font-size: 18px;">آ</span>{n}</a>''' for n, bg, fg, sel in [("روشن", "#FFFFFF", "#14112B", False), ("کاغذی", "#F7F5F0", "#14112B", True), ("تیره", "#14112B", "#F7F5F0", False)])

head_fonts = HEAD.format(title="تنظیم متن").replace("family=Noto+Naskh+Arabic:wght@400;500;600", "family=Noto+Naskh+Arabic:wght@400;500;600&amp;family=Noto+Nastaliq+Urdu&amp;family=Markazi+Text")
textpage = head_fonts + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header}
  <div style="position: absolute; top: 118px; right: 30px; left: 30px; display: flex; flex-direction: column; font-family: 'ParastooB', serif; font-size: 22px; line-height: 1.9;"><span style="align-self: flex-start;">{B9[1][0]}</span><span style="align-self: flex-end;">{B9[1][1]}</span></div>

  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.12);"></div>

  <section aria-label="تنظیم متن" style="position: absolute; right: 0; left: 0; bottom: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 30px 30px 0 0; padding: 10px 20px 28px; box-shadow: 0 -6px 24px rgba(20,17,43,0.16); display: flex; flex-direction: column; gap: 14px;">
    <div aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DAD6E2;"></div>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1;">متن</span>
      <a href="Poem.dc.html" style="text-decoration: none; font-size: 14px; font-weight: 700; color: #2F35F5;">تمام</a>
    </div>

    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-family: 'ParastooB', serif; font-size: 15px;">آ</span>
      <div role="slider" aria-label="اندازه‌ی حروف" aria-valuemin="1" aria-valuemax="5" aria-valuenow="4" style="position: relative; flex-grow: 1; height: 6px; border-radius: 3px; background: #E6E3EC;">
        <span style="position: absolute; top: 0; bottom: 0; right: 0; width: 60%; border-radius: 3px; background: #2F35F5;"></span>
        <span style="position: absolute; top: 50%; right: 60%; width: 24px; height: 24px; margin: -12px -12px 0 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; border: 4px solid #2F35F5; box-shadow: 0 2px 6px rgba(20,17,43,0.25);"></span>
      </div>
      <span style="font-family: 'ParastooB', serif; font-size: 26px;">آ</span>
    </div>

    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px;">{font_cards}</div>

    {weight_row}
    <div style="display: flex; gap: 10px;">{layout_row}</div>
    {spacing_row}

    <div style="display: flex; gap: 8px;">{themes}</div>
  </section>

</div>
''' + TAIL
open(os.path.join(P, "PoemText.dc.html"), "w", encoding="utf-8").write(textpage)

# ---------- flow section headers ----------
# One row per flow, read right to left. Each entry: (header board, number, title, sticker bg, sticker fg, [(board, page title), ...])
FLOWS = [
    ("Flow1.dc.html", "۱", "خونه، کاوش و کتابخونه", "#2F35F5", "#FFFFFF", [
        ("Calm.dc.html", "خونه: بیت امروز و دوستات"), ("Explore.dc.html", "کاوش"), ("Poet.dc.html", "صفحه‌ی شاعر"),
        ("Library.dc.html", "همه‌ی کتاب‌ها"), ("Book.dc.html", "یه کتاب: دیوان حافظ"), ("BookSection.dc.html", "فهرست غزل‌ها")]),
    ("FlowRead.dc.html", "۲", "خوندن شعر", "#6CCB3A", "#14112B", [
        ("Poem.dc.html", "بیت به بیت"), ("PoemMeaning.dc.html", "معنی بیت"), ("PoemText.dc.html", "تنظیم متن (آ)"),
        ("PoemScroll.dc.html", "کل شعر"), ("PoemScrollHold.dc.html", "نگه داشتن روی بیت")]),
    ("Flow2.dc.html", "۳", "تب بازی و بازی‌های تکی", "#FFB703", "#14112B", [
        ("GamesE.dc.html", "تب بازی"), ("PlayDaily.dc.html", "معمای امروز"), ("JigsawE.dc.html", "جورچین بیت"),
        ("JigsawResult.dc.html", "جورچین: بعد از جواب"), ("PlayPoet.dc.html", "حدس شاعر"), ("PlayPoetAnswer.dc.html", "حدس شاعر: جواب درست"),
        ("PlaySecond.dc.html", "مصراع دوم"), ("PlayBook.dc.html", "از کدوم کتاب؟ جواب غلط"), ("PlayMatch.dc.html", "معنی‌یاب"),
        ("PlayListen.dc.html", "گوش کن"), ("ChallengeSend.dc.html", "تموم شد: یکی رو به چالش بکش"), ("LeaderboardS.dc.html", "رده‌بندی")]),
    ("FlowPlay.dc.html", "۴", "بازی با دوست", "#FF4D24", "#FFFFFF", [
        ("GameLobby.dc.html", "بساز و دعوت کن"), ("ChallengeWeb.dc.html", "لینک دعوت، بدون اپ"), ("ChallengeAccept.dc.html", "لینک دعوت، توی اپ"),
        ("PlayMosh.dc.html", "مشاعره"), ("PlayDuel.dc.html", "بازی رودررو")]),
    ("Flow3.dc.html", "۵", "پیام‌ها", "#FF3D8B", "#FFFFFF", [
        ("Inbox.dc.html", "پیام‌ها"), ("Direct.dc.html", "پیام با سارا"), ("SharedDivan.dc.html", "دیوان مشترک با سارا")]),
    ("FlowMe.dc.html", "۶", "من", "#14112B", "#FFFFFF", [
        ("Profile.dc.html", "صفحه‌ی من"), ("Divan.dc.html", "دیوان من"), ("Privacy.dc.html", "حریم خصوصی"),
        ("Avatar.dc.html", "ساختن چهره"), ("InviteFriends.dc.html", "دوستاتو بیار")]),
    ("FlowFeedback.dc.html", "۷", "بازخورد", "#1C20B8", "#FFFFFF", [
        ("FeedbackShake.dc.html", "تکون بده: بازخورد"), ("FeedbackBug.dc.html", "باگ دیدم"), ("FeedbackGame.dc.html", "یه بازی پیشنهاد بده")]),
]
REFERENCE = [  # row ۰: the wide reference boards
    ("StickerSystem.dc.html", 880, "زبان طراحی استیکری"), ("Map.dc.html", 880, "نقشه‌ی اپ"), ("Poets.dc.html", 880, "چهره‌ی شاعرها"),
    ("GameIcons.dc.html", 844, "آیکن بازی‌ها"), ("GamesCatalog.dc.html", 844, "همه‌ی بازی‌ها"),
]
SECTIONS = [(h, n, t, bg, fg, [pt for _, pt in pages]) for h, n, t, bg, fg, pages in FLOWS]
def fa(n):
    return "".join("۰۱۲۳۴۵۶۷۸۹"[int(d)] for d in str(n))
def section_board(num, title, bg, fg, items):
    pad = "4px 12px" if len(items) > 9 else ("6px 14px" if len(items) > 7 else "10px 14px")
    rows = "".join(f'''      <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 16px; padding: {pad}; box-shadow: 0 2px 8px rgba(20,17,43,0.06);"><span style="flex-shrink: 0; min-width: 34px; font-family: 'Lalezar', sans-serif; font-size: 16px; color: #2F35F5; padding-top: 2px;">{num}-{fa(i + 1)}</span><span style="font-size: 14px; font-weight: 500;">{it}</span></div>
''' for i, it in enumerate(items))
    return HEAD.format(title=title) + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 64px 26px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 18px; overflow: hidden;">
  <span aria-hidden="true" style="align-self: flex-start; width: 92px; height: 92px; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {fg}; border: 5px solid #FFFFFF; box-shadow: 0 4px 14px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 50px; padding-top: 8px; transform: rotate(-6deg);">{num}</span>
  <div style="font-family: 'Lalezar', sans-serif; font-size: 40px; line-height: 1.15;">{title}</div>
  <div style="font-size: 14px; color: #4A4660; line-height: 1.7;">صفحه‌ها به همین ترتیب، از راست به چپ کنار هم هستن.</div>
  <div style="display: flex; flex-direction: column; gap: {"5px" if len(items) > 9 else "8px"};">
{rows}  </div>
  <div aria-hidden="true" style="position: absolute; left: 22px; bottom: 6px; font-family: 'Lalezar', sans-serif; font-size: 44px; color: #2F35F5;">←</div>
</div>
''' + TAIL
for key, num, title, bg, fg, items in SECTIONS:
    open(os.path.join(P, key), "w", encoding="utf-8").write(section_board(num, title, bg, fg, items))

# ---------- canvas layout ----------
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
B = d["boards"]
for gone in ["PoemScrollA.dc.html", "PoemScrollB.dc.html", "PoemScrollC.dc.html", "PoemScrollGulzar.dc.html", "PoemScrollMirza.dc.html"]:
    B.pop(gone, None)

R = 0              # right edge of every row; rows read right to left
PH, PITCH, WIDE, ROW_GAP = 390, 470, 1280, 240
layout = []
x = R
for i, (k, h, t) in enumerate(REFERENCE, start=1):
    layout.append((k, x - WIDE, 0, WIDE, h, f"۰-{fa(i)} · {t}"))
    x -= WIDE + 80
y = 880 + ROW_GAP
for header, num, title, bg, fg, pages in FLOWS:
    layout.append((header, R - PH, y, PH, 844, f"{num} · {title}"))
    for i, (k, t) in enumerate(pages, start=1):
        layout.append((k, R - PH - i * PITCH, y, PH, 844, f"{num}-{fa(i)} · {t}"))
    y += 844 + ROW_GAP

sticker_order = []
for k, x, y, w, h, t in layout:
    B[k] = {"x": x, "y": y, "w": w, "h": h, "title": t, "page": "sticker"}
    sticker_order.append(k)

# everything else lives on the old-explorations page, tidied into two rows
old_big = ["Main.dc.html", "PoemFonts.dc.html"]
old_phones = ["Games.dc.html", "GamesA.dc.html", "GamesB.dc.html", "GamesC.dc.html", "GamesD.dc.html",
              "Jigsaw.dc.html", "Leaderboard.dc.html", "Circle.dc.html", "Player.dc.html"]
x = 0
for k in old_big:
    if k in B:
        B[k].update({"x": x, "y": 0, "page": "explore"})
        x += B[k]["w"] + 80
for i, k in enumerate(old_phones):
    if k in B:
        B[k].update({"x": i * PITCH, "y": 1300, "w": PH, "h": 844, "page": "explore"})
B["PoemFonts.dc.html"]["title"] = "فونت شعر (مقایسه)"

stray = [k for k, v in B.items() if k not in sticker_order and v.get("page") == "sticker"]
assert not stray, stray
explore_order = [k for k in old_big + old_phones if k in B]
d["order"] = sticker_order + explore_order
assert set(d["order"]) == set(B), set(B) ^ set(d["order"])
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
shutil.rmtree(tmp)
print("v11")
