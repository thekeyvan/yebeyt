"""Public and private profiles, and finding friends from contacts (owner, 28 Nov):
profiles are public by default (chosen in onboarding), anyone can follow a public profile, a private one needs a friend request;
contacts are matched by email (we keep emails, not phone numbers). Run after gen_empty."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "gen_empty.py"), encoding="utf-8").read()
exec(src[:src.index("# ======================= row: home")])                 # gen_empty's helpers, nothing written
exec(src[src.index("def person_card"):src.index('page("EmptyHomeFriends')])  # person_card, letter

def steps4(cur):
    names = ["سلیقه", "اولین بازی", "حساب", "صفحه‌ت"]
    bars = "".join(f'<span style="flex: 1; display: flex; flex-direction: column; gap: 5px;"><span style="height: 6px; border-radius: 3px; background: {LAPIS if i <= cur else "#DAD6E2"};"></span><span style="font-size: 11px; font-weight: {700 if i == cur else 500}; color: {INK if i == cur else GREY};">{n}</span></span>' for i, n in enumerate(names))
    return f'<div style="display: flex; gap: 6px;">{bars}</div>'
def option(on, icon, title, badge, lines):
    ring = f"box-shadow: 0 0 0 4px {LAPIS}, 0 4px 14px rgba(20,17,43,0.12);" if on else "box-shadow: 0 2px 8px rgba(20,17,43,0.08);"
    mark = (f'<span style="width: 26px; height: 26px; box-sizing: border-box; border-radius: 50%; background: {LAPIS}; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;">{sv(I["check"], 13, "#FFFFFF", 3.4)}</span>'
            if on else '<span style="width: 26px; height: 26px; box-sizing: border-box; border-radius: 50%; border: 3px solid #DAD6E2;"></span>')
    b = f'<span style="background: {AMBER}; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700;">{badge}</span>' if badge else ""
    li = "".join(f'<span style="display: flex; gap: 6px; font-size: 12px; color: #4A4660; line-height: 1.6;"><span style="color: {c}; font-weight: 700;">{m}</span>{t}</span>' for m, c, t in lines)
    return (f'<a href="#" aria-pressed="{"true" if on else "false"}" style="text-decoration: none; color: {INK}; display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 24px; padding: 16px; {ring}">'
            f'<div style="display: flex; align-items: center; gap: 10px;">{icon}<span style="flex-grow: 1; font-family: \'Lalezar\', sans-serif; font-size: 22px; padding-top: 3px;">{title}</span>{b}{mark}</div>{li}</a>')
YES, NO = ("✓", GREEN), ("–", GREY)
GLOBE = sv('<circle cx="12" cy="12" r="8.5"></circle><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z"></path>', 20, "#FFFFFF", 2)

# ---------------- onboarding: public or private ----------------
page("OnbVisibility.dc.html", "شروع: صفحه‌ت عمومی باشه یا خصوصی؟", f'''  {steps4(3)}
  <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2;">کی صفحه‌ت رو ببینه؟</span><span style="font-size: 13px; color: #4A4660; line-height: 1.7;">صفحه‌ت یعنی اسم و چهره‌ت، بیت‌هایی که پسندیدی یا بازنشر کردی، و معمای امروزت. دیوانت جداست و پیش‌فرضش فقط خودتی.</span></div>
  {option(True, disc(40, LAPIS, GLOBE, 3), "عمومی", "پیشنهاد ما", [("✓", GREEN, "هر کسی صفحه‌ت رو می‌بینه و می‌تونه دنبالت کنه"), ("✓", GREEN, "بیت‌هات توی «تازه‌ها»ی بقیه هم میاد"), ("–", GREY, "پیام و بازی همچنان فقط با دوستات")])}
  {option(False, disc(40, INK, sv(I["lock"], 18, "#FFFFFF", 2.4), 3), "خصوصی", "", [("✓", GREEN, "فقط دوستات صفحه‌ت رو می‌بینن"), ("–", GREY, "هر کی بخواد، اول درخواست دوستی می‌ده")])}
  <span style="text-align: center; font-size: 12px; color: {GREY};">هر وقت خواستی توی «حریم خصوصی» عوضش کن.</span>
  <div style="margin-top: auto; display: flex; flex-direction: column;">{cta_btn("بعدی", "OnbFriends.dc.html")}</div>
''')

# ---------------- someone's public page ----------------
LIKES = [("الا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول ولی افتاد مشکل‌ها", "حافظ", "پسندید · دیروز"),
         ("بنی آدم اعضای یکدیگرند", "که در آفرینش ز یک گوهرند", "سعدی", "بازنشر کرد · ۳ روز پیش")]
def like_card(a, b, poet, what):
    return (f'<div style="background: #FFFFFF; border-radius: 20px; padding: 12px 16px 10px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;">'
            f'<span style="align-self: flex-start; {POEM} font-size: 16px; line-height: 1.8;">{a}</span><span style="align-self: flex-end; {POEM} font-size: 16px; line-height: 1.8;">{b}</span>'
            f'<span style="display: flex; justify-content: space-between; font-size: 11px; color: {GREY}; padding-top: 2px;"><span>{poet}</span><span>{what}</span></span></div>')
def person_head(fc, name, user, chips_html, buttons):
    return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 26px; padding: 18px 16px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08); text-align: center; flex-shrink: 0;">'
            f'{fc}<span style="font-family: \'Lalezar\', sans-serif; font-size: 26px; line-height: 1.1; padding-top: 4px;">{name}</span><span style="font-size: 12px; color: {GREY};" dir="ltr">@{user}</span>'
            f'<div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; padding: 2px 0 4px;">{chips_html}</div><div style="display: flex; gap: 10px; width: 100%;">{buttons}</div></div>')
def small(t, bg="#F1EFEA", fg=INK):
    return f'<span style="background: {bg}; color: {fg}; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 700;">{t}</span>'
def wide(t, bg, fg, href="#", border=""):
    return f'<a href="{href}" style="flex: 1; text-decoration: none; height: 44px; box-sizing: border-box; border-radius: 14px; background: {bg}; color: {fg}; {border} display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700;">{t}</a>'
page("PersonPublic.dc.html", "صفحه‌ی عمومی یه نفر", f'''  {hdr_back("", back="EmptyHomeFriends.dc.html", right=btn(sv('<circle cx="6" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="18" cy="12" r="1.3"></circle>', 20, INK, 2.2), "#", "بیشتر: گزارش، بلاک"))}
  {person_head(sara(84, "pp", 4), "سارا", "sara.ghazal", small("لیگ طلایی", AMBER) + small("۸ روز پشت هم", FIRE, "#FFFFFF") + small("حافظ و مولانا", "#E9EAFE", LAPIS),
               wide("دنبال کن", LAPIS, "#FFFFFF") + wide("دوستی بخواه", "#FFFFFF", INK, "#", "border: 2px solid #E6E3EC;"))}
  {tabs3(["پسندیده‌ها", "معماها", "نشان‌ها"], 0)}
  {"".join(like_card(*l) for l in LIKES)}
''', "home")

# ---------------- someone's private page ----------------
page("PersonPrivate.dc.html", "صفحه‌ی خصوصی یه نفر", f'''  {hdr_back("", back="PeopleStart.dc.html", right=btn(sv('<circle cx="6" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="18" cy="12" r="1.3"></circle>', 20, INK, 2.2), "#", "بیشتر: گزارش، بلاک"))}
  {person_head(letter("ب", LAPIS, 84), "بردیا", "bardia", small("صفحه‌ی خصوصی", INK, "#FFFFFF"), wide("دوستی بخواه", LAPIS, "#FFFFFF"))}
  {empty_block(art(at(60, 40, slot(180, 46, 14)), at(60, 100, slot(140, 46, 14)), at(196, 14, disc(76, INK, sv(I["lock"], 32, "#FFFFFF", 2.4), 5, SH_UP), 10, 2), sparkle(40, 150, AMBER), h=170),
               "این صفحه خصوصیه", "بردیا صفحه‌ش رو فقط به دوستاش نشون می‌ده. درخواست دوستی بفرست؛ اگه قبول کنه، بیت‌ها و معماهاش رو می‌بینی.")}
''', "home")

# ---------------- privacy: who sees what ----------------
def seg3(items, on):
    return '<div style="display: flex; gap: 2px; background: #F1EFEA; border-radius: 999px; padding: 3px;">' + "".join(
        f'<span style="flex: 1; text-align: center; font-size: 12px; font-weight: {700 if i == on else 500}; color: {"#FFFFFF" if i == on else INK}; background: {LAPIS if i == on else "transparent"}; border-radius: 999px; padding: 6px 0;">{t}</span>' for i, t in enumerate(items)) + "</div>"
def setting(t, sub, ctrl):
    return f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-bottom: 2px dashed #ECE9F1;"><div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 14px; font-weight: 700;">{t}</span><span style="font-size: 12px; color: {GREY}; line-height: 1.6;">{sub}</span></div>{ctrl}</div>'
def switch(on):
    return f'<span style="display: block; flex-shrink: 0; width: 52px; height: 30px; border-radius: 15px; background: {GREEN if on else "#DAD6E2"}; position: relative;"><span style="position: absolute; top: 3px; {"left: 3px" if on else "right: 3px"}; width: 24px; height: 24px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span></span>'
page("PrivacyVisibility.dc.html", "حریم خصوصی: کی چی ببینه", f'''  {hdr_back("حریم خصوصی", back="Profile.dc.html")}
  <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 24px; padding: 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 20px; padding-top: 2px;">صفحه‌ی من</span>
    {tabs3(["عمومی", "خصوصی"], 0)}
    <span style="font-size: 12px; color: #4A4660; line-height: 1.7;">عمومی: هر کسی صفحه‌ت رو می‌بینه و دنبالت می‌کنه. خصوصی: فقط دوستات؛ بقیه درخواست می‌دن. کسی که خصوصی بشی و دنبالت می‌کرد ولی دوستت نیست، دیگه نمی‌بینه.</span>
  </div>
  <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 4px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    {setting("بیت‌هایی که پسندیدم و بازنشر کردم", "توی صفحه‌م و «تازه‌ها»ی بقیه", seg3(["همه", "دوستام", "فقط خودم"], 0))}
    {setting("معمای امروزم", "حل کردم یا نه، با چند فرصت", seg3(["همه", "دوستام", "فقط خودم"], 0))}
    {setting("دیوانم", "بیت‌هایی که نگه داشتم", seg3(["همه", "دوستام", "فقط خودم"], 2))}
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0;"><div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 14px; font-weight: 700;">با ایمیلم پیدام کنن</span><span style="font-size: 12px; color: {GREY}; line-height: 1.6;">کسی که ایمیلت توی مخاطباتشه، تو رو توی یه بیت می‌بینه. ایمیلت به هیچ‌کس نشون داده نمی‌شه.</span></div>{switch(True)}</div>
  </div>
''', "me")

# ---------------- find friends: the start ----------------
contacts_card = (f'<a href="ContactsAsk.dc.html" style="text-decoration: none; color: #FFFFFF; display: flex; align-items: center; gap: 12px; background: {LAPIS}; border: 5px solid #FFFFFF; border-radius: 24px; padding: 14px; {SH} flex-shrink: 0;">'
                 f'{disc(50, "#FFFFFF", sv(I["users"], 24, LAPIS, 2.2), 0, "")}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;"><span style="font-family: \'Lalezar\', sans-serif; font-size: 20px; padding-top: 2px;">دوستاتو از مخاطبات پیدا کن</span>'
                 f'<span style="font-size: 12px; color: rgba(255,255,255,0.85);">با ایمیل‌هاشون؛ شماره‌ها رو نگاه نمی‌کنیم</span></div>'
                 f'<span style="background: #FFFFFF; color: {LAPIS}; border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 700;">ببین</span></a>')
row = lambda fc, n, why, on=False, label="دنبال کن": (f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 2px dashed #ECE9F1;">{fc}<div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="font-size: 15px; font-weight: 700;">{n}</span><span style="font-size: 12px; color: {GREY};">{why}</span></div>'
                                    + (f'<span style="border: 2px solid #E6E3EC; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700;">دنبالش می‌کنی</span>' if on else f'<span style="background: {LAPIS}; color: #FFFFFF; border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 700;">{label}</span>') + "</div>")
page("PeopleStart.dc.html", "پیدا کردن دوست", f'''  {hdr_back("پیدا کردن دوست", back="Calm.dc.html")}
  {field(ph="نام کاربری، مثلاً sara.ghazal")}
  {contacts_card}
  <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 6px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.06);">
    <span style="font-size: 13px; font-weight: 700; padding-top: 8px;">شاید بخوای دنبالشون کنی</span>
    {row(sara(44, "ps1", 3), "سارا", "اونم حافظ و مولانا رو دوست داره")}{row(letter("آ", GREEN, 44), "آرین", "۸ روز پشت هم معما حل کرده")}{row(letter("م", AMBER, 44), "مهسا", "توی لیگ طلایی با توئه", True)}
  </div>
  <a href="InviteFriends.dc.html" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.7); border: 3px dashed {DASH}; border-radius: 20px; padding: 12px 14px;">{LINK.replace("currentColor", LAPIS)}<span style="flex-grow: 1; font-size: 13px; font-weight: 700;">دوستت هنوز نیومده؟ لینک دعوت بفرست</span></a>
''', "home")

# ---------------- contacts: before the system asks ----------------
contacts_art = art(at(30, 60, tile(96, 110, "#FFFFFF", f'<span style="display: flex; flex-direction: column; align-items: center; gap: 6px;">{letter("س", MAGENTA, 40)}<span style="width: 50px; height: 6px; border-radius: 3px; background: #E6E3EC;"></span></span>', 16, 4), -8),
                   at(174, 60, tile(96, 110, "#FFFFFF", f'<span style="display: flex; flex-direction: column; align-items: center; gap: 6px;">{letter("ک", FIRE, 40)}<span style="width: 50px; height: 6px; border-radius: 3px; background: #E6E3EC;"></span></span>', 16, 4), 8),
                   at(112, 20, disc(80, LAPIS, sv(I["envelope"], 36, "#FFFFFF", 2.2), 5, SH_UP), 0, 3), sparkle(150, 176, AMBER), h=190)
bullet = lambda ic, t: f'<div style="display: flex; align-items: flex-start; gap: 10px; text-align: right;">{disc(30, "#E9EAFE", sv(ic, 15, LAPIS, 2.4), 0, "")}<span style="font-size: 13px; line-height: 1.7; padding-top: 4px;">{t}</span></div>'
page("ContactsAsk.dc.html", "مخاطبات: قبل از اجازه", f'''  {hdr_back("", back="PeopleStart.dc.html", icon=X)}
  {empty_block(contacts_art, "ببین کدوم دوستات اینجان", "",
               extra=f'<div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 22px; padding: 16px; width: 100%; box-sizing: border-box; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">'
                     + bullet(I["envelope"], "فقط ایمیل‌های مخاطبات رو نگاه می‌کنیم؛ نه شماره، نه اسم.")
                     + bullet(I["lock"], "ایمیل‌ها قبل از فرستادن روی همین گوشی رمزی می‌شن و ما نگهشون نمی‌داریم.")
                     + bullet(I["eye"], "فقط کسایی رو نشونت می‌دیم که خودشون گذاشتن با ایمیل پیدا بشن.") + "</div>",
               cta=cta_btn("اجازه بده", "ContactsFound.dc.html"), second=ghost_btn("فعلاً نه", "PeopleStart.dc.html"))}
''')

# ---------------- contacts: found ----------------
inv = lambda n, mail: f'<div style="display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 2px dashed #ECE9F1;">{disc(40, "#F1EFEA", f"<span style=\'font-size: 15px; font-weight: 700; color: {GREY};\'>{n[0]}</span>", 0, "")}<div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="font-size: 14px; font-weight: 700;">{n}</span><span style="font-size: 11px; color: {GREY};" dir="ltr">{mail}</span></div><span style="border: 2px solid {LAPIS}; color: {LAPIS}; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700;">دعوت</span></div>'
page("ContactsFound.dc.html", "مخاطبات: کیا اینجان", f'''  {hdr_back("از مخاطبات", back="PeopleStart.dc.html")}
  <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 6px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.06);">
    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px;"><span style="font-size: 13px; font-weight: 700;">۳ نفر از مخاطبات اینجان</span>{ghost_btn("همه رو دنبال کن")}</div>
    {row(sara(44, "cf1", 3), "سارا", "@sara.ghazal")}{row(letter("ک", FIRE, 44), "کیان", "@kian_k")}{row(letter("ر", MAGENTA, 44), "رها", "@raha · صفحه‌ی خصوصی", label="دوستی بخواه")}
  </div>
  <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.7); border-radius: 24px; padding: 6px 16px;">
    <span style="font-size: 13px; font-weight: 700; padding-top: 8px;">هنوز نیومدن</span>
    {inv("نگار", "negar.r@gmail.com")}{inv("امید", "omid@icloud.com")}
    <span style="font-size: 11px; color: {GREY}; padding: 8px 0; line-height: 1.6;">«دعوت» لینکت رو با پیام یا هر جا که خودت بخوای می‌فرسته. ما به کسی ایمیل نمی‌زنیم.</span>
  </div>
''', "home")

# ---------------- contacts: nobody here yet (an empty state) ----------------
page("ContactsNone.dc.html", "مخاطبات: هیچ‌کس هنوز نیومده", f'''  {hdr_back("از مخاطبات", back="PeopleStart.dc.html")}
  {empty_block(contacts_art, "هنوز هیچ‌کدوم از مخاطبات اینجا نیستن", "شاید هنوز نیومدن، یا با یه ایمیل دیگه وارد شدن. لینک دعوتت رو بفرست؛ هر کی بیاد، دوستت می‌شه.",
               cta_btn("لینک دعوت رو بفرست", "InviteFriends.dc.html", icon=LINK.replace("currentColor", "#FFFFFF")), ghost_btn("با نام کاربری بگرد", "PeopleStart.dc.html"))}
''', "home")
# onboarding: the username step now leads to this choice
u = rd("OnbUsername.dc.html")
if 'href="OnbFriends.dc.html"' in u:
    wr("OnbUsername.dc.html", u.replace('href="OnbFriends.dc.html"', 'href="OnbVisibility.dc.html"'))
print("social boards written")
