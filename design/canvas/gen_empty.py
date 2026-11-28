"""Empty states: every screen that can have nothing to show (first time, nothing found, done for today,
offline or failed, needs an account, still loading), and the rules board. Run after gen_feedback."""
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

NAVSRC = {"home": "Calm.dc.html", "explore": "Explore.dc.html", "games": "GamesE.dc.html", "messages": "Inbox.dc.html", "me": "Profile.dc.html"}
def nav(tab):
    s = re.search(r'<nav aria-label="تب‌ها".*?</nav>', rd(NAVSRC[tab]), re.S).group(0)
    return re.sub(r'<span aria-label="\S+ پیام نخونده"[^>]*>[^<]*</span>', "", s)   # no unread badge on an empty screen

FRAME = ("position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: {pad}; background-color: #F1EFEA; "
         "background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; "
         "font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;")
def page(key, t, body, tab=None, pad=None):
    pad = pad or ("56px 18px 112px" if tab else "50px 18px 30px")
    wr(key, head(t) + f'<div dir="rtl" style="{FRAME.format(pad=pad)}">\n' + body + (nav(tab) if tab else "") + "\n</div>\n" + tail)

direct = rd("Direct.dc.html")
SARA = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
def uniq(svg, tag):
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def sara(size, tag, border=4):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {MAGENTA}; border: {border}px solid #FFFFFF; overflow: hidden; {SH}">{uniq(SARA, tag)}</span>'
def me(size):
    return disc(size, AMBER, f'<span style="font-family: \'Lalezar\', sans-serif; font-size: {size // 2 - 4}px; color: {INK}; padding-top: 4px;">ن</span>')
onb = rd("OnbAccount.dc.html")
APPLE_BTN = re.search(r'<a href="[^"]*" style="[^"]*background: #000000;[^"]*">.*?ادامه با اپل</a>', onb, re.S).group(0)
GOOGLE_BTN = re.search(r'<a href="[^"]*" style="[^"]*">(?:(?!</a>).)*ادامه با گوگل</a>', onb, re.S).group(0)

POEM = "font-family: 'ParastooB', serif;"
def btn(icon, href="#", label="", bg="#FFFFFF", fg=INK, border=""):
    return f'<a href="{href}" aria-label="{label}" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {fg}; {border} box-shadow: 0 2px 8px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{icon}</a>'
BACK = sv('<path d="M9 5l7 7-7 7"></path>', 20, "currentColor", 2.6)
X = sv('<path d="M6 6l12 12M18 6L6 18"></path>', 20, "currentColor", 2.6)
def hdr_back(title, sub="", back="#", right="", icon=BACK):
    s = f'<span style="font-size: 13px; color: #4A4660;">{sub}</span>' if sub else ""
    return (f'<div style="display: flex; align-items: center; gap: 12px;">{btn(icon, back, "برگشت")}'
            f'<div style="display: flex; align-items: baseline; gap: 8px; flex-grow: 1; min-width: 0;"><span style="font-family: \'Lalezar\', sans-serif; font-size: 28px; line-height: 1.1; white-space: nowrap;">{title}</span>{s}</div>{right}</div>')
def hdr_tab(title, right=""):
    return f'<div style="display: flex; align-items: center; gap: 12px;"><h1 style="margin: 0; flex-grow: 1; font-family: \'Lalezar\', sans-serif; font-weight: 400; font-size: 30px; line-height: 1; padding-top: 4px;">{title}</h1>{right}</div>'
def field(text="", ph="", focus=False):
    cur = f'<span style="width: 2px; height: 20px; background: {LAPIS};"></span>' if focus else ""
    t = f'<span style="font-size: 15px; font-weight: 500;">{text}</span>{cur}' if text else f'{cur}<span style="font-size: 14px; color: {GREY};">{ph}</span>'
    clear = f'<span style="margin-right: auto; width: 22px; height: 22px; border-radius: 50%; background: #E6E3EC; display: flex; align-items: center; justify-content: center;">{sv(I["plus"].replace("M12 5v14M5 12h14", "M7 7l10 10M17 7L7 17"), 12, INK, 3)}</span>' if text else ""
    ring = f"box-shadow: 0 0 0 3px #C9CBF5;" if focus else "box-shadow: 0 2px 8px rgba(20,17,43,0.06);"
    return f'<label style="display: flex; align-items: center; gap: 10px; height: 48px; flex-shrink: 0; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF; {ring}">{sv(I["search"], 18, "#4A4660", 2.2)}{t}{clear}</label>'
def chips(items, on=0):
    return '<div style="display: flex; gap: 8px; flex-wrap: nowrap; overflow: hidden; flex-shrink: 0;">' + "".join(
        f'<span style="flex-shrink: 0; height: 34px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: {700 if i == on else 500}; background: {INK if i == on else "#FFFFFF"}; color: {"#FFFFFF" if i == on else INK};">{t}</span>'
        for i, t in enumerate(items)) + "</div>"
def tabs3(items, on):
    return '<div style="display: flex; gap: 2px; background: #E6E3EC; border-radius: 999px; padding: 3px; flex-shrink: 0;">' + "".join(
        f'<span style="flex: 1; text-align: center; font-size: 13px; font-weight: {700 if i == on else 500}; color: {"#FFFFFF" if i == on else INK}; background: {LAPIS if i == on else "transparent"}; border-radius: 999px; padding: 7px 0;">{t}</span>'
        for i, t in enumerate(items)) + "</div>"
def still_works(title, items):
    """What still works without the thing that is missing."""
    ch = "".join(f'<a href="{h}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; box-sizing: border-box; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: {INK}; font-size: 13px; font-weight: 700; box-shadow: 0 2px 6px rgba(20,17,43,0.08);"><span style="width: 10px; height: 10px; border-radius: 50%; background: {c};"></span>{t}</a>' for t, c, h in items)
    return f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: center; padding-top: 4px;"><span style="font-size: 12px; font-weight: 700; color: {GREY};">{title}</span><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">{ch}</div></div>'
def tip(t):
    return f'<div style="display: flex; align-items: flex-start; gap: 8px; text-align: right; font-size: 13px; line-height: 1.7; color: #4A4660;"><span style="flex-shrink: 0; margin-top: 7px; width: 7px; height: 7px; border-radius: 50%; background: {LAPIS};"></span><span>{t}</span></div>'
def couplet(a, b, poet, size=18, extra=""):
    return (f'<div style="background: #FFFFFF; border-radius: 22px; padding: 16px 18px 12px; box-shadow: 0 3px 12px rgba(20,17,43,0.08); display: flex; flex-direction: column; gap: 2px;">'
            f'<span style="align-self: flex-start; {POEM} font-size: {size}px; line-height: 1.9;">{a}</span><span style="align-self: flex-end; {POEM} font-size: {size}px; line-height: 1.9;">{b}</span>'
            f'<span style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: {GREY}; padding-top: 4px;"><span>{poet}</span>{extra}</span></div>')
GEAR = sv('<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>', 20, "currentColor", 1.9)
LINK = sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>', 18, "currentColor", 2.2)
PEN = sv('<path d="M4 20h4L19 9l-4-4L4 16z"></path>', 20, "#FFFFFF", 2.4)

# ======================= row: home, explore, reading =======================
# home · nobody followed yet: the public feed fills «تازه‌ها» (owner, 28 Nov: profiles are public by default)
def person_card(fc, name, why, on=False):
    btn_ = (f'<span style="background: #FFFFFF; color: {INK}; border: 2px solid #E6E3EC; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700;">دنبالش می‌کنی</span>' if on else
            f'<span style="background: {LAPIS}; color: #FFFFFF; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 700;">دنبال کن</span>')
    return (f'<a href="PersonPublic.dc.html" style="flex: 0 0 124px; text-decoration: none; color: {INK}; display: flex; flex-direction: column; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 22px; padding: 14px 8px 12px; box-shadow: 0 2px 8px rgba(20,17,43,0.08); text-align: center;">'
            f'{fc}<span style="font-size: 14px; font-weight: 700;">{name}</span><span style="font-size: 11px; color: {GREY}; line-height: 1.5; min-height: 32px;">{why}</span>{btn_}</a>')
def letter(ch, bg, size=54):
    return disc(size, bg, f'<span style="font-family: \'Lalezar\', sans-serif; font-size: {size // 2 - 2}px; color: #FFFFFF; padding-top: 4px;">{ch}</span>', 3)
page("EmptyHomeFriends.dc.html", "خونه: هنوز کسی رو دنبال نمی‌کنی", f'''  <div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 13px; color: #4A4660;">جمعه ۷ آذر</span><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.15;">بیتِ امروز</span></div>
  {couplet("ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", "سعدی", 17, sv(I["bookmark"], 18, LAPIS, 2.2))}
  <div style="display: flex; flex-direction: column; gap: 2px; padding-top: 2px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 24px;">تازه‌ها</span><span style="font-size: 12px; color: #4A4660;">هنوز کسی رو دنبال نمی‌کنی؛ اینا رو بقیه گذاشتن. هر کی رو دوست داشتی، دنبالش کن.</span></div>
  <div style="display: flex; gap: 10px; margin: 0 -18px; padding: 2px 18px 4px; overflow: hidden; flex-shrink: 0;">{person_card(sara(54, "hf1", 3), "سارا", "حافظ و مولانا رو دوست داره")}{person_card(letter("آ", GREEN), "آرین", "۸ روز پشت هم معما حل کرده")}{person_card(letter("م", AMBER), "مهسا", "۴۰ بیت از سعدی پسندیده")}</div>
  <div style="display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 22px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); flex-shrink: 0;">
    <div style="display: flex; align-items: center; gap: 10px;">{letter("ک", FIRE, 36)}<span style="flex-grow: 1; font-size: 13px;"><b>کیان</b> یه بیت بازنشر کرد</span><span style="background: #F1EFEA; color: {GREY}; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700;">پیشنهاد</span></div>
    <div style="background: #F7F5F0; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column;"><span style="align-self: flex-start; {POEM} font-size: 15px; line-height: 1.8;">بشنو این نی چون شکایت می‌کند</span><span style="align-self: flex-end; {POEM} font-size: 15px; line-height: 1.8;">از جدایی‌ها حکایت می‌کند</span></div>
  </div>
''', "home")

# search · before typing (first time, nothing searched yet)
ex_row = lambda k, v: f'<a href="#" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 16px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(20,17,43,0.05);"><span style="flex-shrink: 0; font-size: 12px; font-weight: 700; color: {GREY}; min-width: 74px;">{k}</span><span style="font-size: 15px; font-weight: 500;">{v}</span></a>'
page("EmptySearchStart.dc.html", "جستجو: هنوز چیزی ننوشتی", f'''  {hdr_back("جستجو", back="Explore.dc.html")}
  {field(ph="شاعر، شعر یا یه تیکه از بیت...", focus=True)}
  <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 6px;">{art(at(110, 8, disc(80, LAPIS, sv(I["search"], 38, "#FFFFFF", 3), 5, SH_UP), -8, 2), at(40, 50, word("سعدی", "#FFFFFF", INK, 17), -6), at(198, 54, word("گلستان", FIRE, size=17), 7), sparkle(250, 14, AMBER, 16), h=110)}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 24px;">دنبال چی می‌گردی؟</span><span style="font-size: 13px; color: #4A4660;">هر کدوم از اینا رو می‌شه پیدا کرد:</span></div>
  <div style="display: flex; flex-direction: column; gap: 8px;">{ex_row("اسم شاعر", "مولانا")}{ex_row("اسم کتاب", "رباعیات خیام")}{ex_row("تیکه‌ای از بیت", f'<span style="{POEM} font-size: 17px;">…سمرقند و بخارا را</span>')}</div>
  <div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 13px; font-weight: 700;">این روزا زیاد می‌گردن</span>{chips(["حافظ", "عشق", "شب یلدا", "خیام", "دلتنگی"], -1)}</div>
''', "explore")

# search · nothing found
page("EmptySearchNone.dc.html", "جستجو: چیزی پیدا نشد", f'''  {hdr_back("جستجو", back="Explore.dc.html")}
  {field("سمرقندو بخارا", focus=True)}
  {empty_block(art_search(), "چیزی پیدا نکردیم", "برای «سمرقندو بخارا» نه شاعری بود، نه کتابی، نه بیتی.",
               extra=f'<a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; background: #FFFFFF; color: {INK}; border-radius: 999px; padding: 8px 14px; font-size: 13px; box-shadow: 0 2px 6px rgba(20,17,43,0.08);">شاید منظورت <b style="color: {LAPIS};">سمرقند و بخارا</b> بود؟</a>'
                     f'<div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.7); border-radius: 18px; padding: 12px 14px; width: 100%; box-sizing: border-box;">{tip("یه کلمه کمتر بنویس، مثلاً فقط «سمرقند».")}{tip("املای دیگه رو امتحان کن: «کآرام» یا «که آرام».")}</div>',
               second=ghost_btn("پاک کن و از اول", "EmptySearchStart.dc.html"))}
''', "explore")

# library · filter finds no book
lib_art = art(at(30, 60, slot(64, 90, 10)), at(206, 60, slot(64, 90, 10)), at(112, 30, tile(76, 108, MAGENTA, '<span style="font-family: \'Lalezar\', sans-serif; font-size: 40px; color: #FFFFFF; padding-top: 8px;">؟</span>', 12, 5, SH_UP), 6, 2), sparkle(60, 30, AMBER), sparkle(240, 170, LAPIS, 16), h=180)
page("EmptyLibraryNone.dc.html", "کتابخونه: کتابی پیدا نشد", f'''  {hdr_back("همه‌ی کتاب‌ها", back="Explore.dc.html")}
  {field("شاملو", focus=True)}
  {chips(["همه", "دیوان", "مثنوی", "رباعی", "معاصر"], 0)}
  {empty_block(lib_art, "«شاملو» هنوز توی کتابخونه نیست", "شعر شاعرهای امروزی هنوز اجازه‌ی انتشار نداره. فعلاً ۹۹ کتاب از ۴۸ شاعر کلاسیک داریم.",
               cta_btn("همه‌ی کتاب‌ها رو ببین", "Library.dc.html"), ghost_btn("بگو کدوم شاعر رو می‌خوای", "FeedbackShake.dc.html"))}
''', "explore")

# section · search finds no poem
page("EmptySectionNone.dc.html", "فهرست غزل‌ها: پیدا نشد", f'''  {hdr_back("غزلیات", "حافظ · ۴۹۵ غزل", "Book.dc.html")}
  {field("ماهی", focus=True)}
  {chips(["شماره", "حرف آخر", "پرخواننده"], 0)}
  {empty_block(art_search(), "توی غزلیات «ماهی» نیومده", "شاید توی کتاب‌های دیگه‌ی حافظ یا شاعرهای دیگه باشه.",
               cta_btn("توی همه‌ی شعرها بگرد", "EmptySearchNone.dc.html"), ghost_btn("پاک کن", "BookSection.dc.html"))}
''', "explore")

# a page that isn't there (old link, deleted person, wrong address)
nf_art = art(at(60, 40, slot(180, 110, 22)), at(96, 20, tile(110, 76, "#FFFFFF", '<span style="font-family: \'Lalezar\', sans-serif; font-size: 34px; color: #8A8698; padding-top: 6px;">؟</span>', 18, 5, SH_UP), -10, 2),
             at(176, 92, word("گم شد", FIRE, size=18, shadow=SH_UP), 8, 3), sparkle(250, 30, AMBER), h=180)
page("EmptyNotFound.dc.html", "پیدا نشد: لینک یا صفحه", f'''  {hdr_back("", back="#")}
  {empty_block(nf_art, "این صفحه پیدا نشد", "شاید لینکش کامل نبوده، یا این کتاب، بازی یا آدم دیگه اینجا نیست.",
               cta_btn("برو به خونه", "Calm.dc.html"), ghost_btn("برگرد", "#"))}
''')

# reader · poem not on the phone and no internet
page("EmptyPoemOffline.dc.html", "شعر: بدون اینترنت", f'''  {hdr_back("غزل ۱۲", "سعدی · غزلیات", "Poet.dc.html", icon=sv('<path d="M6 9l6 6 6-6"></path>', 22, "currentColor", 2.6))}
  {empty_block(art_poem_failed(), "این شعر هنوز روی گوشیت نیست", "برای باز کردنش یه بار اینترنت لازمه. بعدش همیشه روی گوشی می‌مونه.",
               cta_btn("دوباره", "Poem.dc.html", icon=sv(I["refresh"], 18, "#FFFFFF", 2.6)),
               still_works("اینا بدون اینترنت هم باز می‌شن", [("دیوان حافظ", LAPIS, "Book.dc.html"), ("رباعیات خیام", DEEP, "#"), ("دوبیتی‌های باباطاهر", GREEN, "#")]))}
''')

# reader · loading (no blank screen: the page's shape, quietly)
def bar(w, h=14, c="#E6E3EC"):
    return f'<span style="display: block; width: {w}; height: {h}px; border-radius: {h // 2}px; background: {c};"></span>'
page("EmptyReaderLoading.dc.html", "شعر: داره باز می‌شه", f'''  <div style="display: flex; align-items: center; gap: 12px;">{btn(sv('<path d="M6 9l6 6 6-6"></path>', 22, "currentColor", 2.6), "#", "بستن")}<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;">{bar("90px", 16)}{bar("120px", 10)}</div><span style="width: 44px;"></span></div>
  <div style="align-self: center; display: flex; gap: 2px; background: #FFFFFF; border-radius: 999px; padding: 3px; opacity: 0.6;"><span style="font-size: 13px; padding: 6px 14px;">بیت به بیت</span><span style="font-size: 13px; padding: 6px 14px;">کل شعر</span></div>
  <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; gap: 22px; padding: 0 10px;">
    <div style="display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; border-radius: 26px; padding: 34px 22px; box-shadow: 0 3px 12px rgba(20,17,43,0.06);">
      <div style="display: flex; justify-content: flex-start;">{bar("78%", 18)}</div><div style="display: flex; justify-content: flex-end;">{bar("70%", 18)}</div>
      <div style="display: flex; justify-content: center; padding-top: 10px;">{bar("60px", 10)}</div></div>
    <div style="display: flex; justify-content: center; gap: 14px;">{"".join(f'<span style="width: 48px; height: 48px; border-radius: 50%; background: #E6E3EC;"></span>' for _ in range(4))}</div>
    <div style="display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 13px; color: {GREY};"><span style="display: flex; gap: 4px;"><span style="width: 8px; height: 12px; border-radius: 3px; background: {LAPIS};"></span><span style="width: 8px; height: 12px; border-radius: 3px; background: {FIRE}; transform: translateY(-3px);"></span></span>داره باز می‌شه…</div>
  </div>
''')

# offline on a screen that needs the server (here: messages)
page("EmptyOffline.dc.html", "بدون اینترنت: پیام‌ها", f'''  {hdr_tab("پیام‌ها")}
  {empty_block(art_offline(), "اینترنت نیست", "پیام‌ها بدون اینترنت نمیان. وصل که بشی، خودش دوباره می‌گیره.",
               cta_btn("دوباره", "Inbox.dc.html", icon=sv(I["refresh"], 18, "#FFFFFF", 2.6)),
               still_works("بدون اینترنت هم می‌شه", [("خوندن", LAPIS, "Explore.dc.html"), ("بازی‌های تکی", AMBER, "GamesE.dc.html"), ("دیوانت", MAGENTA, "Divan.dc.html")]))}
''', "messages")

# ======================= row: games =======================
def game_top(title, icon_key, close="GamesE.dc.html"):
    return (f'<div style="display: flex; align-items: center; gap: 12px;">{btn(X, close, "بستن")}<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">{game_icon(icon_key, 34)}'
            f'<span style="font-family: \'Lalezar\', sans-serif; font-size: 22px; padding-top: 3px;">{title}</span></div><span style="width: 44px;"></span></div>')

# daily · solved for today
count = (f'<div style="display: flex; align-items: center; justify-content: space-between; background: {INK}; color: #FFFFFF; border-radius: 22px; padding: 14px 18px; width: 100%; box-sizing: border-box;">'
         f'<span style="display: flex; flex-direction: column; gap: 2px; text-align: right;"><span style="font-size: 13px; color: rgba(255,255,255,0.7);">معمای بعدی</span><span style="font-size: 13px; font-weight: 700;">فردا، برای همه با هم</span></span>'
         f'<span dir="ltr" style="font-family: \'Lalezar\', sans-serif; font-size: 30px; letter-spacing: 1px; padding-top: 4px;">۰۷:۱۲:۴۰</span></div>')
friends_solved = f'<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4A4660;"><span style="display: flex;">{sara(30, "ds", 2)}<span style="margin-right: -10px; display: flex;">{disc(30, FIRE, "", 2)}</span></span>سارا و کیان هم حلش کردن</div>'
page("EmptyDailyDone.dc.html", "معمای امروز: حل شد", f'''  {game_top("معمای امروز", "daily")}
  {empty_block(art_done(), "امروز رو حل کردی!", "با ۲ فرصت. رشته‌ات شد ۸ روز، فردا هم بیا که نشکنه.",
               cta_btn("یه بازی دیگه", "GamesCatalog.dc.html"), ghost_btn("کل بیت رو بخون", "Poem.dc.html"), extra=count + friends_solved)}
''')

# daily · today's puzzle didn't arrive
daily_art = art(at(30, 70, slot(52, 52, 12)), at(92, 70, slot(52, 52, 12)), at(154, 70, slot(52, 52, 12)), at(216, 70, slot(52, 52, 12)),
                at(200, 14, disc(70, LAPIS, sv(I["clock"], 34, "#FFFFFF", 2.6), 5, SH_UP), 10, 2), at(56, 140, word("د", AMBER, INK, 20), -10), sparkle(40, 30, MAGENTA), h=180)
page("EmptyDailyMissing.dc.html", "معمای امروز: نرسید", f'''  {game_top("معمای امروز", "daily")}
  {empty_block(daily_art, "معمای امروز هنوز نرسیده", "یه لحظه دیگه دوباره سر بزن. رشته‌ات سر جاشه، امروز تا نصف‌شب وقت داری.",
               cta_btn("دوباره", "PlayDaily.dc.html", icon=sv(I["refresh"], 18, "#FFFFFF", 2.6)), ghost_btn("تا اون موقع یه جورچین بزن", "JigsawE.dc.html"))}
''')

# a game that can't start (here: listen, which needs the internet)
page("EmptyGameFailed.dc.html", "بازی باز نشد: گوش کن", f'''  {game_top("گوش کن", "listen")}
  {empty_block(art_mute(), "گوش کن اینترنت می‌خواد", "خوانش‌ها از گنجور میان و الان نرسیدن. بازی‌های دیگه بدون اینترنت هم کار می‌کنن.",
               cta_btn("دوباره", "PlayListen.dc.html", icon=sv(I["refresh"], 18, "#FFFFFF", 2.6)),
               still_works("اینا الان هم بازی می‌شن", [("جورچین بیت", FIRE, "JigsawE.dc.html"), ("حدس شاعر", AMBER, "PlayPoet.dc.html"), ("مصراع دوم", GREEN, "PlaySecond.dc.html")]))}
''')

def board_top(on):
    return f'''{hdr_back("رده‌بندی", back="GamesE.dc.html")}
  {tabs3(["لیگ", "دوستا", "همه"], on)}'''
page("EmptyBoardNoPoints.dc.html", "رده‌بندی: هنوز امتیازی نیست", f'''  {board_top(0)}
  {empty_block(art_board(), "هنوز توی لیگ نیستی", "یه دور بازی کن تا امتیاز بگیری و وارد لیگ این هفته بشی. هر شنبه از نو شروع می‌شه.",
               cta_btn("بزن بریم", "JigsawE.dc.html"), ghost_btn("لیگ چطوری کار می‌کنه؟", "#"))}
''', "games")
page("EmptyBoardNoFriends.dc.html", "رده‌بندی: دوستی نیست", f'''  {board_top(1)}
  {empty_block(art_friends(me(84)), "رده‌بندی دوستات خالیه", "دوست که اضافه کنی، اینجا هر هفته با هم مسابقه می‌دید.",
               cta_btn("پیدا کردن دوست", "PeopleStart.dc.html"), ghost_btn("دعوت با لینک", "InviteFriends.dc.html"))}
''', "games")
week_art = art(at(40, 104, slot(64, 76, 12, "۲")), at(118, 74, slot(64, 106, 12, "۱")), at(196, 124, slot(64, 56, 12, "۳")),
               at(110, 16, pill("شنبه · هفته‌ی تازه", FIRE, "#FFFFFF", 13), -6, 2), sparkle(50, 40, AMBER), sparkle(250, 80, LAPIS, 16))
page("EmptyBoardNewWeek.dc.html", "رده‌بندی: هفته‌ی تازه", f'''  {board_top(2)}
  {empty_block(week_art, "هفته‌ی تازه شروع شد", "هنوز کسی امتیاز نگرفته. اولین نفر باش!",
               cta_btn("بزن بریم", "JigsawE.dc.html"),
               extra=f'<span style="font-size: 12px; color: {GREY}; background: rgba(255,255,255,0.7); border-radius: 999px; padding: 6px 12px;">هفته‌ی پیش: نفر ۱۲ لیگ نقره‌ای بودی</span>')}
''', "games")

BADGES = [("اولین جورچین", "یه جورچین رو کامل کن"), ("سه روز پشت هم", "سه روز معما حل کن"), ("ده بیت", "ده بیت نگه دار"),
          ("گوش شنوا", "پنج تا گوش کن رو درست بزن"), ("مشاعره‌چی", "یه مشاعره رو ببر"), ("فال‌گیر", "اولین فالت رو بگیر")]
badge_cells = "".join(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;">{slot(64, 64, 32, "؟")}<span style="font-size: 12px; font-weight: 700;">{n}</span><span style="font-size: 11px; color: {GREY}; line-height: 1.5;">{h}</span></div>' for n, h in BADGES)
page("EmptyBadges.dc.html", "نشان‌ها: هنوز هیچی", f'''  {hdr_back("نشان‌ها", "۰ از ۱۸", "Profile.dc.html")}
  <div style="display: flex; align-items: center; gap: 14px; background: #FFFFFF; border-radius: 24px; padding: 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">{disc(60, AMBER, sv(I["star"], 28, INK, 0, INK), 5, SH_UP)}
    <div style="display: flex; flex-direction: column; gap: 3px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; padding-top: 2px;">اولین نشانت یه بازی فاصله داره</span><span style="font-size: 12px; color: #4A4660;">نوآموز · ۰ امتیاز · رشته ۰ روز</span></div></div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 8px; background: rgba(255,255,255,0.6); border-radius: 24px; padding: 18px 10px;">{badge_cells}</div>
  <div style="margin-top: auto; display: flex; flex-direction: column;">{cta_btn("اولین جورچین رو بزن", "JigsawE.dc.html")}</div>
''')

# lobby · no friends in the app yet
GAMES4 = [("mosh", "مشاعره", True), ("duel", "رودررو", False), ("jigsaw", "جورچین", False), ("poet", "حدس شاعر", False)]
gpick = "".join(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; font-weight: {700 if on else 500};"><span style="display: flex; border-radius: 50%; {"box-shadow: 0 0 0 3px " + LAPIS + ";" if on else ""}">{game_icon(k, 54)}</span>{t}</div>' for k, t, on in GAMES4)
page("EmptyLobbyNoFriends.dc.html", "بازی با دوست: دوستی نیست", f'''  {hdr_back("بازی با دوست", back="GamesE.dc.html")}
  <div style="display: flex; flex-direction: column; gap: 10px;"><span style="font-size: 13px; font-weight: 700;">چی بازی کنیم؟</span><div style="display: flex; justify-content: space-between; background: #FFFFFF; border-radius: 22px; padding: 14px 16px;">{gpick}</div></div>
  <div style="display: flex; flex-direction: column; gap: 10px;"><span style="font-size: 13px; font-weight: 700;">با کی؟</span>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; background: rgba(255,255,255,0.7); border: 3px dashed {DASH}; border-radius: 26px; padding: 6px 16px 18px;">
    {art(at(40, 30, slot(60, 60, 30, "+")), at(200, 30, slot(60, 60, 30, "+")), at(114, 14, me(72), 0, 2), at(112, 92, pill("yebeyt.com/g/7KQ2", "#FFFFFF", LAPIS, 12), -3, 3), h=126)}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 22px;">هنوز دوستی توی یه بیت نداری</span>
    <span style="font-size: 13px; color: #4A4660; line-height: 1.8;">لینک بازی رو بفرست. دوستت بدون اپ هم می‌تونه همون‌جا بازی کنه.</span>
    {cta_btn("لینک بازی رو بفرست", "#", icon=LINK.replace("currentColor", "#FFFFFF"))}{ghost_btn("پیدا کردن دوست", "PeopleStart.dc.html")}
  </div></div>
''')

# games tab · no game with friends going on
page("EmptyGamesFriends.dc.html", "تب بازی: بازی با دوستی نیست", f'''  {hdr_tab("بازی", pill("۸ روز", FIRE, "#FFFFFF", 13))}
  <a href="PlayDaily.dc.html" style="text-decoration: none; color: #FFFFFF; display: flex; align-items: center; gap: 14px; background: {LAPIS}; border: 5px solid #FFFFFF; border-radius: 26px; padding: 16px; {SH}">{game_icon("daily", 56)}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 3px;">معمای امروز</span><span style="font-size: 12px; color: rgba(255,255,255,0.85);">۳ فرصت · یه کلمه گم شده</span></div><span style="background: #FFFFFF; color: {LAPIS}; border-radius: 14px; padding: 8px 14px; font-weight: 700; font-size: 14px;">بزن بریم</span></a>
  <div style="display: flex; align-items: baseline; justify-content: space-between;"><span style="font-family: 'Lalezar', sans-serif; font-size: 22px;">با دوستات</span>{ghost_btn("+ بازی با دوست", "GameLobby.dc.html")}</div>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; background: rgba(255,255,255,0.7); border: 3px dashed {DASH}; border-radius: 26px; padding: 4px 16px 16px;">
    {art(at(46, 30, slot(58, 58, 29)), at(196, 30, slot(58, 58, 29)), at(116, 14, game_icon("mosh", 70), -6, 2), sparkle(250, 20, AMBER), h=100)}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 20px;">نوبت هیچ‌کس نیست</span>
    <span style="font-size: 13px; color: #4A4660; line-height: 1.7;">یه مشاعره شروع کن؛ دوستت تا فردا وقت داره جواب بده.</span>
    {cta_btn("مشاعره با یه دوست", "GameLobby.dc.html")}
  </div>
  <div style="display: flex; justify-content: space-between; padding: 0 4px;">{"".join(f'<a href="#" style="display: flex;">{game_icon(k, 52)}</a>' for k in ["jigsaw", "poet", "misra", "book", "listen"])}</div>
''', "games")

# a challenge or game link that is over or wrong
ch_art = art(at(60, 50, tile(180, 96, "#FFFFFF", f'<span style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><span style="font-size: 12px; color: {GREY};">کد چالش</span><span dir="ltr" style="font-family: \'Lalezar\', sans-serif; font-size: 30px; color: {INK}; letter-spacing: 2px; padding-top: 3px;">7KQ2</span></span>', 20, 5, SH_UP), -6, 2),
             at(180, 26, pill("تموم شد", FIRE, "#FFFFFF", 13), 10, 3), at(40, 150, slot(80, 30, 10)), sparkle(250, 140, AMBER), h=190)
page("EmptyChallengeGone.dc.html", "چالش: تموم شده یا نیست", f'''  {hdr_back("", back="#", icon=X)}
  {empty_block(ch_art, "این چالش تموم شده", "چالش‌ها یه هفته باز می‌مونن. شاید هم لینکش کامل نرسیده.",
               cta_btn("خودت یه چالش بساز", "JigsawE.dc.html"), ghost_btn("برو به بازی‌ها", "GamesE.dc.html"))}
''')

# ======================= row: friends, messages, me =======================
page("EmptyPeopleNone.dc.html", "پیدا کردن دوست: کسی نیست", f'''  {hdr_back("پیدا کردن دوست", back="Calm.dc.html")}
  {field("nilou_r", focus=True)}
  {empty_block(art_friends(), "کسی با @nilou_r نیست", "نام کاربری رو دقیق بنویس. اگه هنوز نیومده، براش لینک دعوت بفرست.",
               cta_btn("لینک دعوت رو بفرست", "InviteFriends.dc.html", icon=LINK.replace("currentColor", "#FFFFFF")))}
''', "home")
page("EmptyRequests.dc.html", "درخواست‌ها: خالی", f'''  {hdr_back("درخواست‌ها", back="Inbox.dc.html")}
  {empty_block(art_requests(), "درخواستی نداری", "وقتی کسی بخواد دوستت بشه، اینجا می‌بینی و یه خبر هم می‌گیری.",
               cta_btn("پیدا کردن دوست", "PeopleStart.dc.html"))}
''', "messages")
page("EmptyFriends.dc.html", "دوستام: هنوز هیچ‌کس", f'''  {hdr_back("دوستام", back="Profile.dc.html")}
  {empty_block(art_friends(me(84)), "هنوز دوستی نداری", "با دوستات مشاعره کن، دیوان مشترک بساز و توی رده‌بندی با هم مسابقه بدید.",
               cta_btn("پیدا کردن دوست", "PeopleStart.dc.html"), ghost_btn("دعوت با لینک", "InviteFriends.dc.html"))}
''', "me")
page("EmptyInbox.dc.html", "پیام‌ها: هنوز گفتگویی نیست", f'''  {hdr_tab("پیام‌ها", btn(PEN, "#", "پیام تازه", LAPIS, "#FFFFFF", "border: 3px solid #FFFFFF;"))}
  {empty_block(art_inbox(), "هنوز گفتگویی نداری", "پیام‌ها با دوستاته. دوستات رو از مخاطبات پیدا کن، یا با لینک دعوتشون کن؛ بعد یه بیت براشون بفرست.",
               cta_btn("دوستاتو پیدا کن", "PeopleStart.dc.html", icon=sv(I["search"], 18, "#FFFFFF", 2.6)), ghost_btn("دعوت با لینک", "InviteFriends.dc.html"))}
''', "messages")
guest_art = art(at(36, 50, me(76), -6, 2), at(188, 50, sara(76, "g"), 6, 2), at(96, 18, word("الا یا ایها الساقی", "#FFFFFF", INK, 15, SH_UP), -4, 3),
                at(112, 116, disc(56, LAPIS, sv(I["plane"], 24, "#FFFFFF", 2.4), 4, SH_UP), 0, 3), sparkle(150, 170, AMBER, 16), h=190)
page("EmptyInboxGuest.dc.html", "پیام‌ها: مهمان", f'''  {hdr_tab("پیام‌ها")}
  {empty_block(guest_art, "پیام‌ها مال دوستاست", "برای بیت فرستادن، مشاعره و دیوان مشترک یه حساب لازمه. هر چی تا الان جمع کردی، می‌مونه.",
               extra=f'<div style="display: flex; flex-direction: column; gap: 10px; width: 100%; padding-top: 4px;">{APPLE_BTN}{GOOGLE_BTN}</div>', second=ghost_btn("فعلاً نه", "Calm.dc.html"))}
''', "messages")

starter = lambda icon, t, sub, h="#": f'<a href="{h}" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 20px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">{icon}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1px; text-align: right;"><span style="font-size: 14px; font-weight: 700;">{t}</span><span style="font-size: 12px; color: {GREY};">{sub}</span></div></a>'
composer = (f'<div style="position: absolute; left: 14px; right: 14px; bottom: 26px; display: flex; align-items: center; gap: 8px;"><span style="flex-shrink: 0; height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; background: {LAPIS}; color: #FFFFFF; font-family: \'Lalezar\', sans-serif; font-size: 17px; display: flex; align-items: center; padding-top: 3px;">بیت</span>'
            f'<span style="flex-grow: 1; height: 44px; box-sizing: border-box; border-radius: 999px; background: #FFFFFF; padding: 0 16px; display: flex; align-items: center; font-size: 14px; color: {GREY}; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">یه چیزی بنویس…</span></div>')
page("EmptyChatNew.dc.html", "پیام با سارا: هنوز هیچی", f'''  <div style="display: flex; align-items: center; gap: 10px;">{btn(BACK, "EmptyInbox.dc.html", "برگشت")}{sara(40, "h", 3)}<div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="font-size: 16px; font-weight: 700;">سارا</span><span style="font-size: 12px; color: {GREY};" dir="ltr">@sara.ghazal</span></div></div>
  <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding-bottom: 70px;">
    <span style="position: relative; display: flex;">{sara(96, "big", 5)}<span style="position: absolute; bottom: -6px; left: -18px; display: flex; transform: rotate(-10deg);">{pill("تازه دوست شدید", AMBER, INK, 12)}</span></span>
    <span style="font-family: 'Lalezar', sans-serif; font-size: 24px; padding-top: 8px;">اولین پیام رو تو بده</span>
    <span style="font-size: 13px; color: #4A4660;">یه بیت بفرست، یا یه بازی شروع کن:</span>
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; padding-top: 4px;">
      {starter(disc(42, LAPIS, sv(I["bookmark"], 18, "#FFFFFF", 0, "#FFFFFF"), 3), "یه بیت از دیوانت بفرست", "مثل کارت‌پستال، با معنیش", "EmptyPickerSheet.dc.html")}
      {starter(game_icon("mosh", 42), "مشاعره رو شروع کن", "تو اول، سارا تا فردا وقت داره", "PlayMosh.dc.html")}
      {starter(disc(42, AMBER, sv(I["sparkle"], 20, INK, 3), 3), "فال دونفره بگیرید", "یه نیت، یه غزل برای هر دو", "FalPair.dc.html")}
    </div>
  </div>
  {composer}
''')

two = f'<span style="display: flex;">{sara(34, "sd", 3)}<span style="margin-right: -10px; display: flex;">{me(34)}</span></span>'
sd_art = art(at(54, 44, slot(190, 46, 14)), at(54, 104, slot(150, 46, 14)), at(196, 18, tile(64, 84, MAGENTA, sv(I["bookmark"], 32, "#FFFFFF", 0, "#FFFFFF"), 16, 5, SH_UP), 10, 2),
             at(20, 140, sara(56, "sda"), -8, 3), at(64, 146, me(56), 6, 3), sparkle(250, 150, AMBER))
page("EmptySharedDivan.dc.html", "دیوان مشترک: خالی", f'''  {hdr_back("دیوان مشترک", "با سارا", "Direct.dc.html", two)}
  {chips(["همه", "از من", "از سارا"], 0)}
  {empty_block(sd_art, "هنوز بیتی اینجا نیست", "هر بیتی تو یا سارا بذارید، برای هر دوتون می‌مونه. اگه یکی‌تون بذاره، اون یکی خبردار می‌شه.",
               cta_btn("اولین بیت رو بذار", "EmptyPickerSheet.dc.html", icon=sv(I["plus"], 18, "#FFFFFF", 3)))}
''', "messages")

sheet = f'''  <div style="position: absolute; inset: 0; background: rgba(20,17,43,0.45); z-index: 1;"></div>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; top: 150px; z-index: 2; background: #F1EFEA; border-radius: 30px 30px 0 0; padding: 12px 18px 30px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px;">
    <span style="align-self: center; width: 44px; height: 5px; border-radius: 3px; background: #D9D5CE;"></span>
    <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-family: 'Lalezar', sans-serif; font-size: 24px;">یه بیت بفرست</span>{btn(X, "EmptyChatNew.dc.html", "بستن")}</div>
    {field(ph="توی همه‌ی شعرها بگرد...")}
    {tabs3(["دیوانم", "بیت امروز", "همه"], 0)}
    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 6px 0;">
      {art(at(60, 20, slot(180, 40, 12)), at(60, 70, slot(140, 40, 12)), at(200, 6, tile(52, 68, MAGENTA, sv(I["bookmark"], 26, "#FFFFFF", 0, "#FFFFFF"), 14, 4, SH_UP), 10, 2), h=116)}
      <span style="font-family: 'Lalezar', sans-serif; font-size: 21px;">دیوانت هنوز خالیه</span>
      <span style="font-size: 13px; color: #4A4660; line-height: 1.7;">بالا دنبال یه بیت بگرد، یا همین بیت امروز رو بفرست:</span></div>
    {couplet("ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", "سعدی · بیت امروز", 16, f'<span style="background: {LAPIS}; color: #FFFFFF; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 700;">بفرست</span>')}
  </div>
'''
page("EmptyPickerSheet.dc.html", "انتخاب بیت: دیوان خالی", f'''  <div style="display: flex; align-items: center; gap: 10px; opacity: 0.6;">{btn(BACK)}{sara(40, "ph", 3)}<span style="font-size: 16px; font-weight: 700;">سارا</span></div>
{sheet}''')

DIVAN_TOP = lambda count, text="", focus=False: f'''{hdr_back("دیوانِ من", count, "Profile.dc.html", f'<a href="Privacy.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 5px; height: 32px; box-sizing: border-box; padding: 0 11px; border-radius: 999px; background: #FFFFFF; color: #4A4660; font-size: 12px; font-weight: 700;">{sv(I["lock"], 14, "currentColor", 2.4)}فقط خودم</a>')}
  {field(text, "توی دیوانت بگرد: یه کلمه، یه شاعر...", focus)}'''
demo = (f'<div style="position: relative; width: 100%; box-sizing: border-box; background: #FFFFFF; border-radius: 20px; padding: 12px 16px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); display: flex; align-items: center; gap: 10px; text-align: right;">'
        f'<div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="{POEM} font-size: 15px; line-height: 1.8;">بنی آدم اعضای یکدیگرند</span><span style="font-size: 11px; color: {GREY};">هر جا این رو دیدی ←</span></div>'
        f'<span style="display: inline-flex; align-items: center; gap: 6px; background: {LAPIS}; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 14px; padding: 7px 12px; font-size: 13px; font-weight: 700; {SH_UP} transform: rotate(-4deg);">{sv(I["bookmark"], 15, "#FFFFFF", 2.2)}نگه دار</span></div>')
page("EmptyDivan.dc.html", "دیوان من: خالی", f'''  {DIVAN_TOP("")}
  {empty_block(art_divan(), "دیوانت هنوز خالیه", "هر جا یه بیت به دلت نشست، «نگه دار» رو بزن تا اینجا بمونه؛ با معنیش، فقط برای خودت.",
               cta_btn("بیت امروز رو ببین", "Calm.dc.html"), ghost_btn("برو کاوش", "Explore.dc.html"), extra=demo)}
''', "me")
page("EmptyDivanNone.dc.html", "دیوان من: پیدا نشد", f'''  {DIVAN_TOP("۳۸ بیت", "ماه", True)}
  {empty_block(art_search(), "توی دیوانت «ماه» نیست", "۳۸ بیت داری، ولی هیچ‌کدوم این کلمه رو ندارن.",
               cta_btn("توی همه‌ی شعرها بگرد", "EmptySearchNone.dc.html"), ghost_btn("پاک کن", "Divan.dc.html"))}
''', "me")
ghost_card = lambda poet, where: (f'<div style="background: #FFFFFF; border-radius: 20px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); display: flex; flex-direction: column; gap: 10px;">'
                                  f'<div style="display: flex; justify-content: flex-start;">{bar("80%", 12)}</div><div style="display: flex; justify-content: flex-end;">{bar("66%", 12)}</div>'
                                  f'<span style="display: flex; justify-content: space-between; font-size: 11px; color: {GREY};"><span>{poet} · {where}</span>{sv(I["cloudoff"], 16, GREY, 2.2)}</span></div>')
page("EmptyDivanOffline.dc.html", "دیوان من: بدون اینترنت", f'''  {DIVAN_TOP("۳۸ بیت")}
  <div style="display: flex; align-items: center; gap: 10px; background: {INK}; color: #FFFFFF; border-radius: 18px; padding: 12px 14px;">{sv(I["cloudoff"], 22, "#FFFFFF", 2.2)}<span style="font-size: 13px; line-height: 1.7;">اینترنت نیست. متن ۱۲ تا از بیت‌هات هنوز روی این گوشی نیومده؛ وصل که بشی، خودش میاد.</span></div>
  {couplet("بیا تا گل برافشانیم و می در ساغر اندازیم", "فلک را سقف بشکافیم و طرحی نو دراندازیم", "حافظ · غزل ۳۷۴", 16, sv(I["bookmark"], 16, LAPIS, 0, LAPIS))}
  {ghost_card("سعدی", "غزل ۲۰۷")}{ghost_card("مولانا", "مثنوی، دفتر اول")}
''', "me")

stat = lambda n, t: f'<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #FFFFFF; border-radius: 18px; padding: 12px 4px;"><span style="font-family: \'Lalezar\', sans-serif; font-size: 22px; color: {GREY}; padding-top: 3px;">{n}</span><span style="font-size: 11px; color: #4A4660;">{t}</span></div>'
page("EmptyProfileGuest.dc.html", "من: مهمان", f'''  {hdr_tab("من", btn(GEAR, "#", "تنظیمات"))}
  <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; background: #FFFFFF; border-radius: 26px; padding: 20px 18px; box-shadow: 0 3px 12px rgba(20,17,43,0.08); text-align: center;">
    {slot(84, 84, 42, "؟")}<span style="font-family: 'Lalezar', sans-serif; font-size: 24px; padding-top: 4px;">مهمان</span>
    <span style="font-size: 13px; color: #4A4660; line-height: 1.7;">امتیاز، رشته و دیوانت فعلاً فقط روی همین گوشیه.<br>با یه حساب، روی هر گوشی‌ای باهات میاد.</span>
    <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; padding-top: 6px;">{APPLE_BTN}{GOOGLE_BTN}</div></div>
  <div style="display: flex; gap: 8px;">{stat("۰", "امتیاز")}{stat("۰ روز", "رشته")}{stat("نوآموز", "سطح")}</div>
  {empty_card(disc(46, MAGENTA, sv(I["bookmark"], 20, "#FFFFFF", 0, "#FFFFFF"), 3), "دیوانت هنوز خالیه", "توی هر شعر «نگه دار» رو بزن.", "برو کاوش", "Explore.dc.html")}
''', "me")
page("EmptyInviteNoName.dc.html", "دوستاتو بیار: نام کاربری نداری", f'''  {hdr_back("دوستاتو بیار", back="Profile.dc.html")}
  {empty_block(art(at(40, 50, tile(220, 70, "#FFFFFF", f'<span dir="ltr" style="display: flex; align-items: center; gap: 4px; font-size: 16px; font-weight: 700; color: {INK};">yebeyt.com/i/<span style="display: inline-block; width: 70px; height: 26px; box-sizing: border-box; border: 3px dashed {DASH}; border-radius: 8px;"></span></span>', 18, 5, SH_UP), -4, 2),
                   at(222, 24, disc(52, AMBER, sv(I["lock"], 22, INK, 2.4), 4), 10, 3), sparkle(50, 150, MAGENTA), sparkle(240, 150, LAPIS, 16), h=180),
               "اول یه نام کاربری بساز", "لینک دعوتت با نام کاربریت ساخته می‌شه، مثل yebeyt.com/i/niloo. دوستات هم با همین پیدات می‌کنن.",
               cta_btn("نام کاربری بساز", "OnbUsername.dc.html"))}
''', "me")
page("EmptyFalHistory.dc.html", "فال‌های من: هنوز هیچی", f'''  {hdr_back("فال‌های من", back="FalIntro.dc.html", icon=X)}
  {empty_block(art_nabat_small(), "هنوز فالی نگرفتی", "فال‌هات اینجا می‌مونن، با روز و غزلش. نیتت هیچ‌جا نوشته نمی‌شه.",
               cta_btn("یه فال بگیر", "FalIntro.dc.html"))}
''')

# ======================= the rules board =======================
KINDS = [("هنوز چیزی نیست", "اولین بار", art_sheet(), "بگو اینجا قراره چی بیاد و اولین قدم رو نشون بده.", "دیوانت هنوز خالیه · بیت امروز رو ببین"),
         ("پیدا نشد", "جستجو و فیلتر", art_search(), "کلمه‌ی خودش رو تکرار کن، یه راه دیگه پیشنهاد بده، دکمه‌ی پاک کردن بذار.", "توی دیوانت «ماه» نیست · توی همه‌ی شعرها بگرد"),
         ("تموم شد", "کار امروز انجام شد", art_done(), "آفرین بگو، بگو بعدی کِیه، یه کار دیگه پیشنهاد بده.", "امروز رو حل کردی! · یه بازی دیگه"),
         ("نرسید", "اینترنت یا سرور", art_offline(), "تقصیر رو گردن کاربر ننداز. «دوباره» بذار و بگو چی بدون اینترنت هم کار می‌کنه.", "اینترنت نیست · دوباره"),
         ("حساب لازمه", "مهمان", art_friends(), "بگو حساب به چه درد می‌خوره و چیزی از دست نمی‌ره. فقط اپل و گوگل، و «فعلاً نه».", "پیام‌ها مال دوستاست · ادامه با اپل"),
         ("داره میاد", "در حال باز شدن", art(at(40, 50, slot(220, 30, 15)), at(40, 96, slot(170, 30, 15)), at(110, 150, pill("داره باز می‌شه…", "#FFFFFF", INK, 12))), "صفحه‌ی خالی نه: شکل همون صفحه، آروم. اگه طول کشید، «دوباره».", "شکلِ کارت‌ها، بی‌متن")]
kcards = "".join(f'''<div style="display: flex; flex-direction: column; gap: 6px; background: #FFFFFF; border-radius: 24px; padding: 12px 16px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
      <div style="display: flex; justify-content: center; transform: scale(0.78); transform-origin: top center; height: 158px;">{a}</div>
      <div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 22px;">{t}</span><span style="font-size: 12px; color: {GREY};">{w}</span></div>
      <span style="font-size: 13px; line-height: 1.7;">{r}</span><span style="font-size: 12px; color: {LAPIS}; font-weight: 700;">{ex}</span></div>''' for t, w, a, r, ex in KINDS)
RULES = ["همیشه یه راه به جلو: یه دکمه‌ی اصلی، حداکثر یه پیوند کنارش.", "عکس: برگه‌ی برچسب با جای خالیِ خط‌چین و یه برچسب که داره می‌چسبه.",
         "تیتر کوتاه و خودمونی (لاله‌زار)، یه یا دو خط توضیح. بدون «متأسفیم» و «خطا».", "اگه چیزی بدون اینترنت یا بدون حساب کار می‌کنه، همون‌جا نشونش بده.",
         "توی یه بخشِ صفحه، کارت خط‌چین کوچیک؛ کل صفحه که خالیه، وسط صفحه.", "صفحه‌ی سفید و چرخونکِ بی‌پایان نداریم: بعد از ۱۰ ثانیه «دوباره» میاد."]
rules = "".join(f'<div style="display: flex; gap: 8px; font-size: 14px; line-height: 1.7;"><span style="flex-shrink: 0; font-family: \'Lalezar\', sans-serif; color: {LAPIS}; padding-top: 2px;">{i + 1}</span><span>{r}</span></div>' for i, r in enumerate(RULES))
wr("EmptyRules.dc.html", (head("حالت‌های خالی: قاعده‌ها") + f'''<div dir="rtl" style="width: 1280px; height: 880px; box-sizing: border-box; padding: 40px 48px; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.4px, transparent 1.4px); background-size: 20px 20px; color: {INK}; font-family: 'Vazirmatn', sans-serif; display: grid; grid-template-columns: 330px 1fr; gap: 28px;">
  <div style="display: flex; flex-direction: column; gap: 14px;">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 52px; line-height: 1.05;">حالت‌های خالی</span>
    <span style="font-size: 15px; color: #4A4660; line-height: 1.8;">هر صفحه‌ای که ممکنه چیزی برای نشون دادن نداشته باشه، یکی از این شش‌تاست. صفحه‌ها توی ردیف‌های ۹ تا ۱۱ هستن.</span>
    <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 24px; padding: 18px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">{rules}</div>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-content: center;">{kcards}</div>
</div>
''' + tail).replace('"width":390,"height":844', '"width":1280,"height":880'))
print("empty boards written")
