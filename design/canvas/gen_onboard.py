"""Onboarding and account: welcome → taste → first game → account (Apple / Google only, or not now)
→ username → friends, plus the gate shown when a guest taps something that needs an account.
Run after gen_icons, before gen_links."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gameicons.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

jig = rd("JigsawE.dc.html")
def head(t):
    return re.sub(r"<title>[^<]*</title>", f"<title>{t}</title>", jig[:jig.index('<div dir="rtl"')], count=1)
tail = jig[jig.index("</x-dc>"):]
direct = rd("Direct.dc.html")
sara_svg = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
def uniq(svg, tag):
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def face(svg, bg, size, tag, border=3):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; overflow: hidden; box-shadow: 0 2px 6px rgba(20,17,43,0.16);">{uniq(svg, tag)}</span>'
def letter(ch, bg, size, fg="#FFFFFF"):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {fg}; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; font-family: \'Lalezar\', sans-serif; font-size: {size // 2}px; padding-top: 3px;">{ch}</span>'

B = "/_blob/"
POET = [("حافظ", "05993349bc76fc57449fc1f70208d3f4", "#2F35F5"), ("سعدی", "edaf69952e782a1782b62dd0cfff59d8", "#FF4D24"),
        ("مولانا", "2a4c917d315ec35f181197f163478728", "#FF3D8B"), ("خیام", "9d8e9b659748d432ee291ddec65a3909", "#1C20B8"),
        ("فردوسی", "abb1f80c2ef9f9788c4c129e6f528eab", "#14112B"), ("عطار", "580f1dbd75c8da96601fd6fc5c207644", "#3E9A1E"),
        ("فروغ", "44edbbc3105b023278f424a6f8a15f7e", "#FF4D24"), ("سهراب", "f75bd8401ea05cc70c966c1c693634c7", "#2F35F5"),
        ("شهریار", "91ee018a451dc90bdca6dbe963ef912a", "#FF3D8B")]
def portrait(b, bg, size, border="3px solid #FFFFFF"):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: 0 0 {size}px; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}; overflow: hidden; box-shadow: 0 2px 8px rgba(20,17,43,0.18);"><img src="{B}{b}" alt="" style="width: 100%; height: 100%; display: block;"></span>'

FRAME = "position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 22px 30px; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;"
POEM = "font-family: 'Parastoo', serif;"
CHECK = '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
APPLE = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#FFFFFF" d="M16.37 12.6c-.02-2.07 1.69-3.07 1.77-3.12-.96-1.41-2.46-1.6-3-1.62-1.27-.13-2.49.75-3.13.75-.65 0-1.65-.73-2.71-.71-1.39.02-2.68.81-3.4 2.06-1.45 2.52-.37 6.25 1.04 8.29.69 1 1.51 2.12 2.59 2.08 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.02 2.51-2.02.79-1.16 1.12-2.28 1.14-2.34-.03-.01-2.18-.84-2.21-3.35zM14.3 6.5c.57-.69.96-1.65.85-2.6-.82.03-1.82.55-2.41 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.85-.47 2.43-1.17z"></path></svg>'
GOOGLE = ('<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.9c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path>'
          '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path>'
          '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"></path>'
          '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>')
def apple_btn(href="OnbUsername.dc.html"):
    return f'<a href="{href}" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; height: 54px; box-sizing: border-box; border-radius: 16px; background: #000000; color: #FFFFFF; font-size: 16px; font-weight: 700;">{APPLE}ادامه با اپل</a>'
def google_btn(href="OnbUsername.dc.html"):
    return f'<a href="{href}" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; height: 54px; box-sizing: border-box; border-radius: 16px; background: #FFFFFF; color: #14112B; border: 1.5px solid #DADCE0; font-size: 16px; font-weight: 700;">{GOOGLE}ادامه با گوگل</a>'
def cta(t, href="#"):
    return f'<a href="{href}" style="text-decoration: none; display: flex; align-items: center; justify-content: center; height: 58px; flex-shrink: 0; box-sizing: border-box; border-radius: 20px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: \'Lalezar\', sans-serif; font-size: 22px; padding-top: 4px;">{t}</a>'
def steps(cur, skip_href="#"):
    """Three onboarding steps: سلیقه، اولین بازی، حساب."""
    names = ["سلیقه", "اولین بازی", "حساب"]
    bars = "".join(f'<span style="flex: 1; display: flex; flex-direction: column; gap: 5px; align-items: stretch;"><span style="height: 6px; border-radius: 3px; background: {"#2F35F5" if i <= cur else "#DAD6E2"};"></span><span style="font-size: 11px; font-weight: {700 if i == cur else 500}; color: {"#14112B" if i == cur else "#8A8698"};">{n}</span></span>' for i, n in enumerate(names))
    return f'<div style="display: flex; align-items: flex-start; gap: 14px;"><div style="flex-grow: 1; display: flex; gap: 6px;">{bars}</div><a href="{skip_href}" style="text-decoration: none; font-size: 13px; font-weight: 700; color: #8A8698; padding-top: 0;">رد شو</a></div>'
LOGO_BIG = ('<span aria-hidden="true" style="display: flex; gap: 10px; transform: rotate(-6deg);">'
            '<span style="width: 70px; height: 100px; box-sizing: border-box; border-radius: 18px; background: #2F35F5; border: 6px solid #FFFFFF; box-shadow: 0 6px 16px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center;"><span style="width: 34px; height: 9px; border-radius: 5px; background: #FFFFFF;"></span></span>'
            '<span style="width: 70px; height: 100px; box-sizing: border-box; border-radius: 18px; background: #FF4D24; border: 6px solid #FFFFFF; box-shadow: 0 6px 16px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center; transform: rotate(10deg) translateY(6px);"><span style="width: 34px; height: 9px; border-radius: 5px; background: #FFFFFF;"></span></span></span>')
def page(key, t, body, frame=FRAME):
    wr(key, head(t) + f'<div dir="rtl" style="{frame}">\n' + body + "</div>\n" + tail)

# ---------------- 1 welcome ----------------
page("OnbWelcome.dc.html", "خوش اومدی", f'''  <div style="display: flex; justify-content: flex-start;"><a href="OnbAccount.dc.html" style="text-decoration: none; font-size: 14px; font-weight: 700;">از قبل حساب داری؟ وارد شو</a></div>
  <div style="position: relative; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;">
    <span aria-hidden="true" style="position: absolute; top: 20px; right: -6px; background: #FFFFFF; border: 4px solid #FFFFFF; border-radius: 18px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(20,17,43,0.14); {POEM} font-size: 14px; line-height: 1.7; transform: rotate(5deg); pointer-events: none;">الا یا ایها الساقی<br>ادر کأسا و ناولها</span>
    <span aria-hidden="true" style="position: absolute; bottom: 40px; left: 0; display: flex; transform: rotate(-8deg); pointer-events: none;">{portrait(*POET[0][1:], 64, "4px solid #FFFFFF")}</span>
    <span aria-hidden="true" style="position: absolute; top: 60px; left: 10px; display: flex; pointer-events: none;">{game_icon("jigsaw", 56)}</span>
    {LOGO_BIG}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 64px; line-height: 1; padding-top: 10px;">یه بیت</span>
    <span style="font-size: 18px; font-weight: 700;">هر بیت، یه بازی.</span>
    <span style="font-size: 14px; color: #4A4660; text-align: center; line-height: 1.8;">هر روز یه بیت برای تو، بازی با شعر،<br>و مشاعره با دوستات.</span>
  </div>
  {cta("بزن بریم", "OnbTaste.dc.html")}
  <span style="text-align: center; font-size: 12px; color: #8A8698; margin-top: -6px;">بدون حساب هم می‌شه شروع کرد</span>
''')

# ---------------- 2 taste ----------------
SELECTED = {"حافظ", "مولانا", "فروغ"}
def poet_pick(n, b, bg):
    on = n in SELECTED
    badge = f'<span style="position: absolute; bottom: 0; left: 2px; width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;">{CHECK}</span>' if on else ""
    ring = "4px solid #2F35F5" if on else "3px solid #FFFFFF"
    return f'<a href="#" aria-pressed="{"true" if on else "false"}" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; font-weight: {700 if on else 500};"><span style="position: relative; display: flex;">{portrait(b, bg, 72, ring)}{badge}</span>{n}</a>'
moods = [("عاشقانه", True), ("امید", False), ("دلتنگی", True), ("عرفانی", False), ("طنز", False), ("حماسی", False), ("طبیعت", False)]
mood_chips = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="text-decoration: none; height: 36px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "#FFFFFF"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in moods)
page("OnbTaste.dc.html", "سلیقه", f'''  {steps(0, "OnbGame.dc.html")}
  <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2;">کدوم شاعرها رو دوست داری؟</span><span style="font-size: 13px; color: #4A4660;">«بیت امروز»ت رو از روی همین انتخاب می‌کنیم. هر چند تا خواستی.</span></div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 8px; background: #FFFFFF; border-radius: 26px; padding: 18px 10px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    {"".join(poet_pick(*p) for p in POET)}
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 13px; font-weight: 700;">چه حالی رو بیشتر دوست داری؟</span><div style="display: flex; flex-wrap: wrap; gap: 8px;">{mood_chips}</div></div>
  <div style="margin-top: auto;">{cta("بعدی", "OnbGame.dc.html")}</div>
''')

# ---------------- 3 first game ----------------
def word(t, bg="#2F35F5", fg="#FFFFFF", rot=0, big=False):
    return f'<span style="background: {bg}; color: {fg}; border: 3px solid #FFFFFF; border-radius: 12px; padding: 6px 14px 4px; {POEM} font-size: {22 if big else 20}px; box-shadow: 0 2px 6px rgba(20,17,43,0.2); transform: rotate({rot}deg);">{t}</span>'
slot = '<span style="width: 70px; height: 44px; box-sizing: border-box; border-radius: 12px; border: 3px dashed #C9C5D3;"></span>'
page("OnbGame.dc.html", "اولین بازی", f'''  {steps(1, "OnbAccount.dc.html")}
  <div style="display: flex; align-items: center; gap: 12px;">{game_icon("jigsaw", 50)}<div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1.15;">اولین بیتت رو بچسبون</span><span style="font-size: 13px; color: #4A4660;">برچسب‌ها رو بکن و به ترتیب بچسبون. ۳۰ ثانیه.</span></div></div>
  <div style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 16px; background: #FFFFFF; border-radius: 26px; padding: 26px 18px 22px; box-shadow: 0 4px 14px rgba(20,17,43,0.10);">
    <span aria-hidden="true" style="position: absolute; top: -12px; left: 18px; background: #FF3D8B; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 2px 11px 0; font-family: 'Lalezar', sans-serif; font-size: 14px; transform: rotate(-5deg); box-shadow: 0 2px 6px rgba(20,17,43,0.22); pointer-events: none;">حافظ</span>
    <span style="{POEM} font-size: 21px; line-height: 1.8;">الا یا ایها الساقی ادر کأسا و ناولها</span>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">{word("که")}{word("عشق")}{word("آسان")}{slot}{slot}</div>
  </div>
  <span style="align-self: center; display: inline-flex; align-items: center; gap: 6px; background: #6CCB3A; color: #14112B; border: 3px solid #FFFFFF; border-radius: 999px; padding: 4px 14px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 6px rgba(20,17,43,0.16);">سه تا درست، دو تا مونده!</span>
  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; background: rgba(255,255,255,0.6); border: 2px dashed #C9C5D3; border-radius: 22px; padding: 18px 12px;">{word("مشکل‌ها", "#FFFFFF", "#14112B", -4)}{word("اول", "#FF4D24", "#FFFFFF", 8, True)}{word("نمود", "#FFFFFF", "#14112B", 3)}</div>
  <div style="margin-top: auto;">{cta("بچسبون!", "OnbAccount.dc.html")}</div>
''')

# ---------------- 4 account ----------------
def sticker(svg, bg, size=38):
    return f'<span style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.14); display: flex; align-items: center; justify-content: center;">{svg}</span>'
def perk(icon_html, t):
    return f'<div style="display: flex; align-items: center; gap: 12px;">{icon_html}<span style="font-size: 14px; font-weight: 500; line-height: 1.6;">{t}</span></div>'
STAR = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="#14112B"></path></svg>'
BOOKMARK = '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4-6 4z" fill="#FFFFFF"></path></svg>'
page("OnbAccount.dc.html", "حساب", f'''  {steps(2, "Calm.dc.html")}
  <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 6px;">
    <span style="background: #FFB703; color: #14112B; border: 5px solid #FFFFFF; border-radius: 999px; padding: 8px 20px 3px; font-family: 'Lalezar', sans-serif; font-size: 30px; box-shadow: 0 4px 12px rgba(20,17,43,0.2); transform: rotate(-4deg);">آفرین! +۵۰</span>
    <span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2; text-align: center; padding-top: 6px;">امتیازت رو نگه داریم؟</span>
    <span style="font-size: 13px; color: #4A4660; text-align: center; line-height: 1.8;">با یه حساب، هر چی جمع می‌کنی مال خودت می‌مونه،<br>روی هر گوشی‌ای.</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 24px; padding: 16px 18px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    {perk(sticker(STAR, "#FFB703"), "امتیاز، رشته‌ی روزها و رده‌بندی")}
    {perk(game_icon("mosh", 38, 3), "مشاعره و بازی با دوستات")}
    {perk(sticker(BOOKMARK, "#2F35F5"), "دیوانت روی همه‌ی گوشی‌هات")}
  </div>
  <div style="display: flex; flex-direction: column; gap: 10px; margin-top: auto;">
    {apple_btn()}
    {google_btn()}
    <a href="Calm.dc.html" style="text-decoration: none; text-align: center; padding: 8px 0 0; font-size: 14px; font-weight: 700; color: #4A4660;">فعلاً بدون حساب</a>
    <span style="text-align: center; font-size: 11px; color: #8A8698; line-height: 1.7;">با ادامه، <a href="#" style="text-decoration: none;">شرایط استفاده</a> و <a href="#" style="text-decoration: none;">حریم خصوصی</a> رو قبول می‌کنی.<br>ایمیلت رو به هیچ‌کس نشون نمی‌دیم.</span>
  </div>
''')

# ---------------- 5 username ----------------
OK = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3E9A1E" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
sugg = "".join(f'<a href="#" dir="ltr" style="text-decoration: none; height: 32px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: #14112B; font-size: 13px; font-weight: 500; font-family: -apple-system, \'Vazirmatn\', sans-serif;">{t}</a>' for t in ["niloofar.sh", "niloo_ghazal", "niloofar1403"])
page("OnbUsername.dc.html", "نام کاربری", f'''  <div style="display: flex; align-items: center; gap: 8px; background: #FFFFFF; border-radius: 999px; padding: 6px 14px 6px 8px; align-self: flex-start; box-shadow: 0 2px 6px rgba(20,17,43,0.06);"><span style="width: 24px; height: 24px; border-radius: 50%; background: #000000; display: flex; align-items: center; justify-content: center;">{APPLE.replace('width="20" height="20"', 'width="14" height="14"')}</span><span style="font-size: 12px; font-weight: 700;">با اپل وارد شدی</span></div>
  <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2;">یه نام کاربری انتخاب کن</span><span style="font-size: 13px; color: #4A4660; line-height: 1.7;">دوستات با این پیدات می‌کنن و توی لینک‌هات میاد.</span></div>
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <span style="font-size: 13px; font-weight: 700;">اسمت <span style="font-weight: 500; color: #8A8698;">· از حساب اپلت</span></span>
    <span style="display: flex; align-items: center; height: 52px; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF; font-size: 16px; font-weight: 500;">نیلوفر</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 6px;">
    <span style="font-size: 13px; font-weight: 700;">نام کاربری</span>
    <span dir="ltr" style="display: flex; align-items: center; gap: 4px; height: 52px; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF; border: 2px solid #6CCB3A; font-size: 17px; font-weight: 700; font-family: -apple-system, 'Vazirmatn', sans-serif;"><span style="color: #8A8698;">@</span>niloofar<span style="width: 2px; height: 20px; background: #2F35F5; margin-left: 1px;"></span><span dir="rtl" style="margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #3E9A1E; font-family: 'Vazirmatn', sans-serif;">{OK}آزاده</span></span>
    <span style="font-size: 11.5px; color: #8A8698; line-height: 1.7;">حروف انگلیسی، عدد، «_» و «.» · ۳ تا ۲۰ حرف · هر ۳۰ روز یه بار می‌شه عوضش کرد</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 12px; font-weight: 700; color: #4A4660;">یا یکی از این‌ها:</span><div style="display: flex; flex-wrap: wrap; gap: 8px;">{sugg}</div></div>
  <div style="display: flex; align-items: center; gap: 10px; background: #E8E9FF; border-radius: 16px; padding: 10px 14px;"><span style="font-size: 12px; color: #4A4660;">لینک دعوتت:</span><span dir="ltr" style="font-size: 13px; font-weight: 700; color: #2F35F5;">yebeyt.com/i/niloofar</span></div>
  <div style="margin-top: auto;">{cta("همینه", "OnbFriends.dc.html")}</div>
''')

# ---------------- 6 friends ----------------
CONTACTS = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="15" height="18" rx="3"></rect><circle cx="11.5" cy="10" r="2.6"></circle><path d="M7.5 16.5c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7"></path><path d="M19 7h1.5M19 12h1.5M19 17h1.5"></path></svg>'
LINKI = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>'
def follow_row(face_html, name, user, on=False):
    btn = ('<a href="#" style="text-decoration: none; height: 34px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; background: #F1EFEA; color: #4A4660; font-size: 13px; font-weight: 700;">دنبالش می‌کنی</a>' if on else
           '<a href="#" style="text-decoration: none; height: 34px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; background: #2F35F5; color: #FFFFFF; font-size: 13px; font-weight: 700;">دنبال کن</a>')
    return f'<div style="display: flex; align-items: center; gap: 12px;">{face_html}<span style="display: flex; flex-direction: column; flex-grow: 1;"><span style="font-size: 14px; font-weight: 700;">{name}</span><span dir="ltr" style="font-size: 12px; color: #8A8698; text-align: right;">@{user}</span></span>{btn}</div>'
page("OnbFriends.dc.html", "دوستات", f'''  <div style="display: flex; justify-content: flex-start;"><a href="Calm.dc.html" style="text-decoration: none; font-size: 13px; font-weight: 700; color: #8A8698;">بعداً</a></div>
  <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2;">دوستات رو پیدا کن</span><span style="font-size: 13px; color: #4A4660; line-height: 1.7;">شعر با رفیق قشنگ‌تره. هر کی رو پیدا کنی، بیت‌هایی که به اشتراک می‌ذاره توی خونه‌ت میاد.</span></div>
  <a href="#" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 22px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);"><span style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FF3D8B; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{CONTACTS}</span><span style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 15px; font-weight: 700;">از دفترچه‌ی تلفن</span><span style="font-size: 12px; color: #4A4660; line-height: 1.6;">شماره‌ها رو فقط برای پیدا کردن چک می‌کنیم، جایی نگه نمی‌داریم.</span></span></a>
  <a href="InviteFriends.dc.html" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 22px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);"><span style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFB703; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{LINKI}</span><span style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 15px; font-weight: 700;">لینک دعوتت رو بفرست</span><span dir="ltr" style="font-size: 12px; color: #2F35F5; text-align: right;">yebeyt.com/i/niloofar</span></span></a>
  <section style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 22px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <span style="font-size: 13px; font-weight: 700;">۳ نفر از دوستات اینجان</span>
    {follow_row(face(sara_svg, "#FF3D8B", 42, "f1"), "سارا", "sara.ghazal", True)}
    {follow_row(letter("ک", "#6CCB3A", 42, "#14112B"), "کیان", "kian_k")}
    {follow_row(letter("م", "#1C20B8", 42), "مهسا", "mahsa.m")}
  </section>
  <div style="margin-top: auto;">{cta("بریم خونه", "Calm.dc.html")}</div>
''')

# ---------------- 7 the gate: a guest taps something that needs an account ----------------
ge = rd("GamesE.dc.html")
gs, ge_end = ge.index('<div dir="rtl"'), ge.index("</x-dc>")
screen = ge[gs:ge_end].rstrip()
inner = screen[screen.index(">") + 1:-len("</div>")].replace("سلام نیلوفر!", "سلام!")  # a guest has no name yet
gate = head("حساب لازمه") + screen[:screen.index(">") + 1] + inner + f'''  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.38);"></div>
  <section role="dialog" aria-label="حساب لازمه" style="position: absolute; right: 0; left: 0; bottom: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 30px 30px 0 0; padding: 10px 22px 30px; box-shadow: 0 -6px 24px rgba(20,17,43,0.18); display: flex; flex-direction: column; gap: 12px;">
    <div aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DAD6E2;"></div>
    <div style="display: flex; align-items: center; gap: 12px;">{game_icon("mosh", 54)}<span style="font-family: 'Lalezar', sans-serif; font-size: 24px; line-height: 1.25; padding-top: 3px;">برای مشاعره با دوستات<br>یه حساب لازمه</span></div>
    <span style="font-size: 13px; color: #4A4660; line-height: 1.8;">با اپل یا گوگل، چند ثانیه طول می‌کشه. هر چی تا الان جمع کردی (امتیاز، دیوان، رشته‌ی روزها) هم منتقل می‌شه.</span>
    {apple_btn()}
    {google_btn()}
    <a href="GamesE.dc.html" style="text-decoration: none; text-align: center; padding-top: 4px; font-size: 14px; font-weight: 700; color: #4A4660;">بعداً</a>
  </section>
</div>
''' + tail
wr("AccountGate.dc.html", gate)
print("onboard")
