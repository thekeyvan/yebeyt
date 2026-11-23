"""Invite friends + challenge anyone with a link (deep link / App Clip for people without the app).
Boards: ChallengeSend (end of a round), ChallengeWeb (the link, opened without the app), ChallengeAccept (the link, opened in the app),
InviteFriends (from the profile). Run after gen_games, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "gameicons.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

direct = rd("Direct.dc.html")
def head(t):
    return re.sub(r"<title>[^<]*</title>", f"<title>{t}</title>", direct[:direct.index('<div dir="rtl"')], count=1)
tail = direct[direct.index("</x-dc>"):]
back_tpl = re.search(r'<a href="Inbox.dc.html" aria-label="برگشت".*?</a>', direct, flags=re.S).group(0)
back = lambda href: back_tpl.replace("Inbox.dc.html", href)
sara_svg = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
me_svg = re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', rd("Avatar.dc.html"), flags=re.S).group(0)
me_svg = re.sub(r'role="img" aria-label="[^"]*"', 'aria-hidden="true"', me_svg, count=1)
me_svg = re.sub(r'width="\d+" height="\d+"', 'width="100%" height="100%"', me_svg, count=1)
def uniq(svg, tag):
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def face(svg, bg, size, tag, border=3):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; overflow: hidden; box-shadow: 0 2px 6px rgba(20,17,43,0.16);">{uniq(svg, tag)}</span>'
def letter(ch, bg, size, fg="#FFFFFF"):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {fg}; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; font-family: \'Lalezar\', sans-serif; font-size: {size // 2}px; padding-top: 3px; box-sizing: border-box;">{ch}</span>'
ME_BG = "#FFB703"
FRAME = "position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;"

def svg(p, c="#14112B", size=22, sw=2.2):
    return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
SMS = '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path>'
PLANE = '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>'
PHONE = '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"></path><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z"></path>'
STORY = '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.2"></circle><path d="M12 8.5v7M8.5 12h7"></path>'
LINK = '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>'
MORE = '<circle cx="6" cy="12" r="1.4" fill="#14112B"></circle><circle cx="12" cy="12" r="1.4" fill="#14112B"></circle><circle cx="18" cy="12" r="1.4" fill="#14112B"></circle>'
def channels():
    items = [("پیامک", SMS, False), ("تلگرام", PLANE, False), ("واتس‌اپ", PHONE, False), ("استوری", STORY, False), ("کپی لینک", LINK, True), ("بیشتر", MORE, False)]
    return '<div style="display: flex; justify-content: space-between; gap: 4px;">' + "".join(
        f'<a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 11px; font-weight: 500;"><span style="width: 50px; height: 50px; box-sizing: border-box; border-radius: 50%; background: {"#2F35F5" if hi else "#FFFFFF"}; box-shadow: 0 2px 8px rgba(20,17,43,0.10); display: flex; align-items: center; justify-content: center;">{svg(p, "#FFFFFF" if hi else "#14112B")}</span>{n}</a>'
        for n, p, hi in items) + "</div>"
LOGO = '<span aria-hidden="true" style="display: inline-flex; gap: 3px;"><span style="width: 9px; height: 13px; border-radius: 3px; background: #2F35F5; transform: rotate(-8deg);"></span><span style="width: 9px; height: 13px; border-radius: 3px; background: #FF4D24; transform: rotate(6deg);"></span></span>'

# ---------------- ChallengeSend: a round is over, send it to anyone ----------------
send = head("چالش بفرست") + f'''<div dir="rtl" style="{FRAME}">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    {back("JigsawResult.dc.html")}
    <span style="background: #FFB703; color: #14112B; border: 3px solid #FFFFFF; border-radius: 999px; padding: 4px 12px 2px; font-family: 'Lalezar', sans-serif; font-size: 16px; box-shadow: 0 2px 6px rgba(20,17,43,0.18);">+۳۲۰ امتیاز</span>
  </div>
  <div style="display: flex; align-items: center; gap: 16px; padding: 4px 4px 0;">
    <span aria-hidden="true" style="width: 96px; height: 96px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; color: #FFFFFF; border: 5px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-6deg);"><span style="font-family: 'Lalezar', sans-serif; font-size: 40px; line-height: 1; padding-top: 6px;">۸</span><span style="font-size: 12px; font-weight: 700;">از ۱۰</span></span>
    <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1.1;">تموم شد!</span><span style="font-size: 13px; color: #4A4660;">جورچین بیت · ۱۰ بیت سعدی · ۱:۴۲</span></div>
  </div>
  <section style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 26px; padding: 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1.2;">یکی رو به چالش بکش</span><span style="font-size: 12.5px; color: #4A4660; line-height: 1.6;">همین ۱۰ بیت رو بازی می‌کنه و نتیجه‌ها کنار هم میاد. اپ رو نداره؟ با همین لینک هم می‌تونه بازی کنه.</span></div>
    <div aria-label="پیش‌نمایش چیزی که می‌فرستی" style="position: relative; display: flex; flex-direction: column; gap: 8px; background: #F7F5F0; border-radius: 18px; padding: 14px 14px 12px; border: 2px dashed #E6E1D6;">
      <span aria-hidden="true" style="position: absolute; top: -10px; left: 14px; background: #FF3D8B; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 2px 10px 0; font-family: 'Lalezar', sans-serif; font-size: 13px; transform: rotate(-5deg); box-shadow: 0 2px 6px rgba(20,17,43,0.2);">چالش</span>
      <div style="display: flex; align-items: center; gap: 8px;">{face(me_svg, ME_BG, 34, "s1", 2)}<span style="font-size: 14px; font-weight: 700; line-height: 1.5;">نیلوفر توی جورچین بیت ۸ از ۱۰ گرفت. تو چند می‌گیری؟</span></div>
      <span style="font-family: 'Parastoo', serif; font-size: 15px; text-align: center; color: #4A4660;">بنی آدم اعضای یکدیگرند…</span>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #8A8698;"><span style="display: inline-flex; align-items: center; gap: 6px;">{LOGO}یه بیت</span><span dir="ltr">yebeyt.com/c/7KQ2</span></div>
    </div>
    {channels()}
  </section>
  <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 20px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">
    <span style="font-size: 13px; font-weight: 700; flex-shrink: 0;">توی اپ:</span>
    <span style="display: flex;">{face(sara_svg, "#FF3D8B", 36, "s2", 2)}<span style="margin-right: -10px; display: flex;">{letter("ک", "#6CCB3A", 36, "#14112B")}</span><span style="margin-right: -10px; display: flex;">{letter("م", "#1C20B8", 36)}</span></span>
    <span style="font-size: 12.5px; color: #4A4660; flex-grow: 1;">سارا، کیان، مهسا…</span>
    <a href="Direct.dc.html" style="text-decoration: none; font-size: 13px; font-weight: 700;">انتخاب</a>
  </div>
</div>
''' + tail
wr("ChallengeSend.dc.html", send)

# ---------------- ChallengeWeb: the link opened by someone without the app ----------------
web = head("لینک چالش") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 0; background: #F1EFEA; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; overflow: hidden;">
  <div style="flex-shrink: 0; padding: 50px 14px 10px; background: #F7F5F0; border-bottom: 1px solid #E6E1D6;">
    <div dir="ltr" style="height: 36px; border-radius: 12px; background: #E6E3EC; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: -apple-system, sans-serif; font-size: 14px; color: #14112B;"><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4A4660" stroke-width="2.6"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>yebeyt.com/c/7KQ2</div>
  </div>
  <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px; padding: 22px 20px 0; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px;">
    <div style="display: flex; align-items: center; gap: 8px;">{LOGO}<span style="font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 3px;">یه بیت</span></div>
    <div style="display: flex; align-items: center; justify-content: center; gap: 14px; padding: 6px 0;">
      <span style="display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; font-weight: 700;">{face(me_svg, ME_BG, 70, "w1", 4)}نیلوفر<span style="font-family: 'Lalezar', sans-serif; font-size: 22px; color: #2F35F5;">۸ از ۱۰</span></span>
      <span style="font-family: 'Lalezar', sans-serif; font-size: 26px; color: #FF4D24; transform: rotate(-8deg);">در برابر</span>
      <span style="display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; font-weight: 700;"><span aria-hidden="true" style="width: 70px; height: 70px; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; border: 4px dashed #C9C5D3; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 30px; color: #8A8698;">؟</span>تو<span style="font-family: 'Lalezar', sans-serif; font-size: 22px; color: #8A8698;">؟ از ۱۰</span></span>
    </div>
    <div style="text-align: center; display: flex; flex-direction: column; gap: 4px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1.2;">نیلوفر تو رو به چالش کشیده!</span><span style="font-size: 13px; color: #4A4660; line-height: 1.7;">جورچین بیت با ۱۰ بیت از سعدی. کلمه‌های هر بیت ریخته؛ به ترتیب بچسبونشون.</span></div>
    <a href="ChallengeAccept.dc.html" style="text-decoration: none; display: flex; align-items: center; justify-content: center; height: 56px; box-sizing: border-box; border-radius: 20px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 4px;">همین‌جا بازی کن</a>
    <span style="text-align: center; font-size: 12px; color: #4A4660; margin-top: -8px;">بدون نصب؛ چند ثانیه طول می‌کشه</span>
    <a href="#" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; height: 50px; box-sizing: border-box; border-radius: 18px; background: #FFFFFF; color: #14112B; font-size: 15px; font-weight: 700; box-shadow: 0 2px 8px rgba(20,17,43,0.08);">نصب «یه بیت» از اپ‌استور</a>
    <span style="text-align: center; font-size: 12px; color: #4A4660; line-height: 1.7;">بعد از نصب، همین چالش خودش باز می‌شه.<br>کد چالش: <b dir="ltr">7KQ2</b></span>
  </div>
</div>
''' + tail
wr("ChallengeWeb.dc.html", web)

# ---------------- ChallengeAccept: the link opened inside the app (or the App Clip) ----------------
accept = head("چالش نیلوفر") + f'''<div dir="rtl" style="{FRAME} justify-content: flex-start;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    {back("GamesE.dc.html")}
    <span style="font-size: 12px; color: #4A4660;">از لینک نیلوفر</span>
  </div>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 18px;">
    <span style="position: relative; display: flex;">{face(me_svg, ME_BG, 104, "a1", 5)}<span aria-hidden="true" style="position: absolute; bottom: -6px; left: -10px; background: #FF4D24; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 2px 10px 0; font-family: 'Lalezar', sans-serif; font-size: 15px; transform: rotate(-8deg); box-shadow: 0 2px 6px rgba(20,17,43,0.2);">۸ از ۱۰</span></span>
    <span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.2; text-align: center;">نیلوفر منتظرته</span>
    <span style="font-size: 14px; color: #4A4660; text-align: center; line-height: 1.8;">همون ۱۰ بیتی که اون بازی کرد.<br>بیشتر از ۸ تا بگیری، تو بردی.</span>
  </div>
  <div style="display: flex; gap: 8px; justify-content: center;">
    {"".join(f'<span style="background: #FFFFFF; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 500;">{t}</span>' for t in ["جورچین بیت", "۱۰ بیت سعدی", "حدود ۲ دقیقه"])}
  </div>
  <a href="JigsawE.dc.html" style="text-decoration: none; display: flex; align-items: center; justify-content: center; height: 60px; box-sizing: border-box; border-radius: 22px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: 'Lalezar', sans-serif; font-size: 24px; padding-top: 4px; margin-top: 8px;">شروع کن</a>
  <div style="display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 20px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">
    <span style="font-size: 13px; font-weight: 700;">حساب نمی‌خواد</span>
    <span style="font-size: 12.5px; color: #4A4660; line-height: 1.7;">بازی کن؛ آخرش فقط یه اسم بنویس تا نیلوفر نتیجه‌ت رو ببینه. اگه خوشت اومد، می‌تونی بعداً حساب بسازی و با هم مشاعره کنید.</span>
  </div>
</div>
''' + tail
wr("ChallengeAccept.dc.html", accept)

# ---------------- InviteFriends: from the profile ----------------
PEN = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"></path></svg>'
tones = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 6px 0; border-radius: 10px; font-size: 12.5px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "transparent"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in [("رفیقانه", True), ("شاعرانه", False), ("کوتاه", False)])
invite = head("دوستاتو بیار") + f'''<div dir="rtl" style="{FRAME}">
  <div style="display: flex; align-items: center; gap: 12px;">
    {back("Profile.dc.html")}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1; padding-top: 3px;">دوستاتو بیار</span>
  </div>
  <div style="position: relative; display: flex; align-items: center; gap: 14px; background: #2F35F5; color: #FFFFFF; border-radius: 26px; padding: 18px 18px; box-shadow: 0 6px 16px rgba(47,53,245,0.25); overflow: visible;">
    <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;"><span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1.2;">شعر با رفیق<br>قشنگ‌تره</span><span style="font-size: 12.5px; color: #D6D8FF; line-height: 1.6;">هر کی با لینک تو بیاد، یه آیتم تازه برای چهره‌تون می‌گیرید.</span></div>
    <span aria-hidden="true" style="display: flex; gap: 6px; transform: rotate(-8deg);"><span style="width: 34px; height: 50px; border-radius: 9px; background: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 3px 8px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;"><span style="width: 18px; height: 5px; border-radius: 3px; background: #2F35F5;"></span></span><span style="width: 34px; height: 50px; border-radius: 9px; background: #FF4D24; border: 4px solid #FFFFFF; box-shadow: 0 3px 8px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transform: rotate(10deg);"><span style="width: 18px; height: 5px; border-radius: 3px; background: #FFFFFF;"></span></span></span>
  </div>
  <section style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 24px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 13px; font-weight: 700;">متن دعوت</span><a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700;">{PEN}خودم بنویسم</a></div>
    <div role="group" aria-label="لحن" style="display: flex; gap: 4px; background: #F1EFEA; border-radius: 12px; padding: 3px;">{tones}</div>
    <div style="background: #F7F5F0; border-radius: 16px; padding: 12px 14px; font-size: 14px; line-height: 1.9;">یه اپ پیدا کردم که شعر فارسی رو بازی می‌کنه! هر روز یه بیت، جورچین، مشاعره با رفیقا. بیا با هم مشاعره کنیم، من شروع می‌کنم:<br><span style="font-family: 'Parastoo', serif; font-size: 16px;">«الا یا ایها الساقی ادر کأسا و ناولها»</span><br><span dir="ltr" style="color: #2F35F5; font-weight: 700;">yebeyt.com/i/niloofar</span></div>
    {channels()}
  </section>
  <section style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 24px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 13px; font-weight: 700;">با لینک تو اومدن</span><span style="font-size: 12px; color: #4A4660;">۱ از ۳ تا آیتم بعدی</span></div>
    <span aria-hidden="true" style="display: block; height: 8px; border-radius: 4px; background: #E6E3EC; overflow: hidden;"><span style="display: block; width: 33%; height: 100%; background: #6CCB3A; border-radius: 4px;"></span></span>
    <div style="display: flex; align-items: center; gap: 10px;">{letter("ک", "#6CCB3A", 34, "#14112B")}<span style="font-size: 13.5px; font-weight: 700; flex-grow: 1;">کیان</span><span style="font-size: 12px; color: #3E9A1E; font-weight: 700;">اومد · دیروز</span></div>
    <div style="display: flex; align-items: center; gap: 10px;">{letter("م", "#1C20B8", 34)}<span style="font-size: 13.5px; font-weight: 700; flex-grow: 1;">مهسا</span><span style="font-size: 12px; color: #8A8698;">لینک رو باز کرد، هنوز نیومده</span></div>
  </section>
</div>
''' + tail
wr("InviteFriends.dc.html", invite)

# profile: a way in next to settings
pr = rd("Profile.dc.html")
if "InviteFriends.dc.html" not in pr:
    anchor = '    <div style="display: flex; gap: 8px;">\n      <a href="Privacy.dc.html" aria-label="تنظیمات"'
    assert anchor in pr
    pill = '    <div style="display: flex; gap: 8px;">\n      <a href="InviteFriends.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; background: #2F35F5; color: #FFFFFF; font-size: 13px; font-weight: 700; box-shadow: 0 3px 10px rgba(47,53,245,0.28);">+ دوستاتو بیار</a>\n      <a href="Privacy.dc.html" aria-label="تنظیمات"'
    pr = pr.replace(anchor, pill, 1)
    wr("Profile.dc.html", pr)
print("invite")

# ---------------- GameLobby: start a two-player game and invite anyone ----------------
CHECK = '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
GAMEIC = {
 "mosh": '<path d="M4 6h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path><path d="M17 10h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v3l-3-3h-3"></path>',
 "duel": '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"></path>',
 "jigsaw": '<rect x="3.5" y="7" width="8" height="6" rx="1.6"></rect><rect x="12.5" y="11" width="8" height="6" rx="1.6"></rect><path d="M7.5 15v3M16.5 6v3"></path>',
 "poet": '<circle cx="12" cy="9" r="4"></circle><path d="M5 20c1-3.6 3.8-5.4 7-5.4s6 1.8 7 5.4"></path>',
}
games = [("mosh", "مشاعره", "#FFB703", "#14112B", True), ("duel", "رودررو", "#FF4D24", "#FFFFFF", False), ("jigsaw", "جورچین", "#2F35F5", "#FFFFFF", False), ("poet", "حدس شاعر", "#FF3D8B", "#FFFFFF", False)]
game_cards = "".join(f'''<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; min-width: 0; text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 6px; background: #FFFFFF; border: 3px solid {"#2F35F5" if on else "#FFFFFF"}; border-radius: 18px; padding: 10px 4px 8px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); font-size: 12px; font-weight: {700 if on else 500};">{game_icon(k, 42)}{n}</a>''' for k, n, bg, fg, on in games)
def seg(items, sel):
    return '<div role="group" style="display: flex; gap: 4px; background: #E6E3EC; border-radius: 14px; padding: 4px;">' + "".join(
        f'<a href="#" aria-pressed="{"true" if i == sel else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 7px 0; border-radius: 11px; font-size: 12.5px; font-weight: {700 if i == sel else 500}; background: {"#2F35F5" if i == sel else "transparent"}; color: {"#FFFFFF" if i == sel else "#14112B"};">{t}</a>' for i, t in enumerate(items)) + "</div>"
def pick(face_html, name, on):
    badge = f'<span style="position: absolute; bottom: -2px; left: -2px; width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;">{CHECK}</span>' if on else ""
    return f'<a href="#" aria-pressed="{"true" if on else "false"}" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; font-weight: {700 if on else 500};"><span style="position: relative; display: flex; {"" if on else "opacity: 0.75;"}">{face_html}{badge}</span>{name}</a>'
mini_ch = "".join(f'<a href="#" aria-label="{n}" style="width: 40px; height: 40px; box-sizing: border-box; border-radius: 50%; background: {"#2F35F5" if hi else "#F1EFEA"}; display: flex; align-items: center; justify-content: center;">{svg(p, "#FFFFFF" if hi else "#14112B", 18)}</a>' for n, p, hi in [("کپی لینک", LINK, True), ("پیامک", SMS, False), ("تلگرام", PLANE, False), ("واتس‌اپ", PHONE, False), ("بیشتر", MORE, False)])
lobby = head("بازی با دوست") + f'''<div dir="rtl" style="{FRAME} gap: 12px;">
  <div style="display: flex; align-items: center; gap: 12px;">
    {back("GamesE.dc.html")}
    <span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1; padding-top: 3px;">بازی با دوست</span>
  </div>
  <span style="font-size: 13px; font-weight: 700;">چی بازی کنیم؟</span>
  <div style="display: flex; gap: 8px;">{game_cards}</div>
  <div style="display: flex; flex-direction: column; gap: 7px;"><span style="font-size: 13px; font-weight: 700;">وقت هر نوبت</span>{seg(["۳۰ ثانیه", "۲ دقیقه", "تا فردا"], 2)}<span style="font-size: 11.5px; color: #8A8698;">«تا فردا» یعنی هر وقت سرت خلوت شد جواب بدی؛ بهت خبر می‌دیم نوبت توئه.</span></div>
  <section style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 24px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <span style="font-size: 13px; font-weight: 700;">کی رو دعوت کنی؟</span>
    <div style="display: flex; gap: 14px; align-items: flex-start;">
      {pick(face(sara_svg, "#FF3D8B", 50, "l1"), "سارا", True)}
      {pick(letter("ک", "#6CCB3A", 50, "#14112B"), "کیان", False)}
      {pick(letter("م", "#1C20B8", 50), "مهسا", False)}
      <a href="#" style="text-decoration: none; color: #4A4660; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px;"><span style="width: 50px; height: 50px; box-sizing: border-box; border-radius: 50%; border: 2px dashed #B9B4C6; display: flex; align-items: center; justify-content: center; font-size: 22px;">+</span>بیشتر</a>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed #E6E1D6; padding-top: 10px;">
      <div style="display: flex; align-items: baseline; justify-content: space-between;"><span style="font-size: 13px; font-weight: 700;">اپ رو نداره؟ لینک بفرست</span><span dir="ltr" style="font-size: 12px; color: #2F35F5; font-weight: 700;">yebeyt.com/g/M4R9</span></div>
      <div style="display: flex; justify-content: space-between;">{mini_ch}</div>
      <span style="font-size: 11.5px; color: #8A8698; line-height: 1.6;">با لینک، بدون نصب هم می‌تونه بیاد توی بازی.</span>
    </div>
  </section>
  <a href="Direct.dc.html" style="text-decoration: none; display: flex; align-items: center; justify-content: center; height: 56px; flex-shrink: 0; box-sizing: border-box; border-radius: 20px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: 'Lalezar', sans-serif; font-size: 21px; padding-top: 4px;">بساز و دعوت کن</a>
  <span style="text-align: center; font-size: 11.5px; color: #8A8698; margin-top: -4px;">هر کی اول اومد، بازی شروع می‌شه. تو هم اول می‌تونی بیت اول رو بگی.</span>
</div>
''' + tail
wr("GameLobby.dc.html", lobby)

# games tab: «با یه دوست» opens the lobby
ge = rd("GamesE.dc.html")
ge2 = re.sub(r'<a href="#"([^>]*>)با یه دوست', r'<a href="GameLobby.dc.html"\1با یه دوست', ge, count=1)
if ge2 != ge:
    wr("GamesE.dc.html", ge2)
print("lobby")

# ---------------- ways into the lobby: games tab, messages, a chat ----------------
CTRL_W = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="#14112B"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="#14112B"></circle></svg>'
ge = rd("GamesE.dc.html")
old = '    <a href="#" style="font-size: 14px; font-weight: 500; text-decoration: none;">همه‌ی بازی‌ها</a>'
if old in ge:
    ge = ge.replace(old, '    <span style="display: flex; align-items: center; gap: 12px;"><a href="GameLobby.dc.html" style="text-decoration: none; background: #2F35F5; color: #FFFFFF; border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(47,53,245,0.25);">+ بازی با دوست</a><a href="GamesCatalog.dc.html" style="font-size: 14px; font-weight: 500; text-decoration: none;">همه‌ی بازی‌ها</a></span>', 1)
    wr("GamesE.dc.html", ge)
ib = rd("Inbox.dc.html")
old = '    <a href="#" aria-label="پیام تازه"'
if "GameLobby.dc.html" not in ib and old in ib:
    ib = ib.replace(old, f'    <a href="GameLobby.dc.html" aria-label="بازی با دوست" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.14); display: flex; align-items: center; justify-content: center;">{CTRL_W}</a>\n' + old, 1)
    wr("Inbox.dc.html", ib)
dr = rd("Direct.dc.html")
dr2 = re.sub(r'<a href="#"( style="text-decoration: none; color: #14112B; display: inline-flex;[^>]*>(?:<svg.*?</svg>))(مشاعره|بازی رودررو)</a>', r'<a href="GameLobby.dc.html"\1\2</a>', dr)
if dr2 != dr:
    wr("Direct.dc.html", dr2)
print("entries", "GameLobby.dc.html" in rd("GamesE.dc.html"), "GameLobby.dc.html" in rd("Inbox.dc.html"), rd("Direct.dc.html").count("GameLobby.dc.html"))
