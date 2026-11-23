"""Shake-to-feedback: the sheet that opens on a shake (with a screenshot of the current screen) and the
«یه بازی پیشنهاد بده» form. Based on Narrio's report-a-problem flow, plus shake, screenshot and a game-idea type.
Runs LAST (after gen_v12): it reuses the final Poem screen as the background and the screenshot."""
import os, re, sys
P = sys.argv[1]
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

poem = rd("Poem.dc.html")
start = poem.index('<div dir="rtl"')
end = poem.index("</x-dc>")
screen = poem[start:end].rstrip()
assert screen.endswith("</div>")
inner = screen[screen.index(">") + 1:-len("</div>")]   # Poem's content, without its outer frame
head = lambda t: re.sub(r"<title>[^<]*</title>", f"<title>{t}</title>", poem[:start], count=1)
tail = poem[end:]
FRAME_OPEN = screen[:screen.index(">") + 1]

def shot(w, rot):
    """The current screen, scaled down into a phone-shaped sticker."""
    sc = w / 390
    return (f'<span aria-label="عکس صفحه" role="img" style="position: relative; flex-shrink: 0; width: {w}px; height: {round(844 * sc)}px; box-sizing: content-box; border-radius: 14px; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(20,17,43,0.22); overflow: hidden; transform: rotate({rot}deg); background: #F7F5F0;">'
            f'<span aria-hidden="true" style="position: absolute; top: 0; right: 0; width: 390px; height: 844px; transform: scale({sc:.4f}); transform-origin: top right; pointer-events: none;">{FRAME_OPEN}{inner}</div></span></span>')

def ic(p, c="#FFFFFF"):
    return f'<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
BUG = '<rect x="7" y="8" width="10" height="12" rx="5"></rect><path d="M9 8a3 3 0 0 1 6 0M4 12h3M17 12h3M4.5 7.5l2.8 2M19.5 7.5l-2.8 2M4.5 17.5l2.8-1.5M19.5 17.5l-2.8-1.5M12 12v6"></path>'
BULB = '<path d="M9 18h6M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"></path>'
CTRL = '<rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="currentColor"></circle>'
HEART = '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path>'
CHAT = '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path><path d="M12 8.5v3.5M12 14.6v.1"></path>'
CHEV = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8698" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>'

TYPES = [("باگ دیدم", "یه چیزی درست کار نمی‌کنه", "#FF4D24", "#FFFFFF", BUG, "FeedbackBug.dc.html"),
         ("یه ایده دارم", "چیزی که اپ رو بهتر کنه", "#FFB703", "#14112B", BULB, "#"),
         ("یه بازی پیشنهاد بدم", "بازی‌ای که دلت می‌خواد توی «یه بیت» باشه", "#2F35F5", "#FFFFFF", CTRL, "FeedbackGame.dc.html"),
         ("خوشم اومد", "بگو چی رو دوست داشتی", "#FF3D8B", "#FFFFFF", HEART, "#"),
         ("یه جاش اذیتم کرد", "انتقادت رو بی‌تعارف بگو", "#14112B", "#FFFFFF", CHAT, "#")]
rows = "".join(f'''      <a href="{href}" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; padding: 9px 4px;{"" if i == len(TYPES) - 1 else " border-bottom: 1px solid #F1EFEA;"}">
        <span style="width: 42px; height: 42px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{ic(p, fg)}</span>
        <span style="display: flex; flex-direction: column; min-width: 0; flex-grow: 1;"><span style="font-size: 15px; font-weight: 700;">{t}{' <span style="font-size: 11px; color: #2F35F5; background: #E8E9FF; border-radius: 999px; padding: 1px 8px; margin-right: 4px;">تازه</span>' if href == "FeedbackGame.dc.html" else ""}</span><span style="font-size: 12px; color: #4A4660;">{h}</span></span>
        {CHEV}
      </a>
''' for i, (t, h, bg, fg, p, href) in enumerate(TYPES))

sheet = head("بازخورد") + FRAME_OPEN + inner + f'''  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.38);"></div>
  <section role="dialog" aria-label="بازخورد" style="position: absolute; right: 0; left: 0; bottom: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 30px 30px 0 0; padding: 10px 20px 28px; box-shadow: 0 -6px 24px rgba(20,17,43,0.18); display: flex; flex-direction: column; gap: 12px;">
    <div aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DAD6E2;"></div>
    <div style="display: flex; align-items: flex-start; gap: 14px;">
      <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1; padding-top: 6px;">
        <span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1.1;">می‌خوای چیزی بگی؟</span>
        <span style="font-size: 13px; line-height: 1.7; color: #4A4660;">گوشی رو تکون دادی. هر چی تو ذهنته بگو، همه‌ش رو خودمون می‌خونیم.</span>
      </div>
    </div>
    <div style="display: flex; flex-direction: column;">
{rows}    </div>
    <span style="align-self: center; font-size: 11px; color: #8A8698;">تکون دادن برای بازخورد رو از تنظیمات می‌تونی خاموش کنی.</span>
  </section>
</div>
''' + tail
wr("FeedbackShake.dc.html", sheet)

CHEV_DOWN = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8698" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>'
def tech_row(what):
    """Technical details always go with a report; shown as one collapsed line the user can open, no switch."""
    return (f'<a href="#" aria-expanded="false" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 10px; border-top: 1px dashed #E6E1D6; padding-top: 8px;">'
            f'<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0;"><span style="font-size: 13px; font-weight: 500;">اطلاعات فنی</span>'
            f'<span style="font-size: 11.5px; color: #8A8698;">{what}</span></span>'
            f'<span style="font-size: 12px; font-weight: 700; color: #2F35F5; white-space: nowrap;">ببین چیه</span>{CHEV_DOWN}</a>')

# ---------------- the game-idea form ----------------
CLOSE = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
PEN = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16z"></path></svg>'
def field_label(t, sub=""):
    return f'<div style="display: flex; align-items: baseline; gap: 6px;"><span style="font-size: 13px; font-weight: 700; color: #14112B;">{t}</span><span style="font-size: 11px; color: #8A8698;">{sub}</span></div>'
toggle_on = '<span role="switch" aria-checked="true" style="width: 44px; height: 26px; flex-shrink: 0; border-radius: 999px; background: #2F35F5; position: relative;"><span style="position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF;"></span></span>'
who = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 8px 0; border-radius: 12px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "transparent"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in [("تنها", True), ("با دوست", False), ("هر دو", False)])
info = "".join(f'<div style="display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 3px 0;"><span style="color: #8A8698;">{k}</span><span style="font-weight: 500;">{v}</span></div>' for k, v in
               [("صفحه", "خوندن غزل · غزل ۳ حافظ"), ("نسخه‌ی اپ", "۲.۰ · ساخت ۱۲"), ("سیستم", "iOS ۲۶.۱"), ("گوشی", "iPhone 16 Pro")])
form = head("یه بازی پیشنهاد بده") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
  <div style="display: flex; align-items: center; gap: 10px;">
    <a href="FeedbackShake.dc.html" aria-label="بستن" style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: #FFFFFF; color: #14112B; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(20,17,43,0.1);">{CLOSE}</a>
    <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1; flex-grow: 1; padding-top: 3px;">یه بازی پیشنهاد بده</span>
    <a href="#" style="text-decoration: none; background: #2F35F5; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 7px 16px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 10px rgba(47,53,245,0.28);">بفرست</a>
  </div>
  <div style="display: flex; flex-direction: column; gap: 7px;">
    {field_label("اسمش", "اگه داره")}
    <span style="display: flex; align-items: center; height: 46px; box-sizing: border-box; padding: 0 14px; border-radius: 14px; background: #FFFFFF; font-size: 14px; color: #8A8698;">مثلاً «بیت عوضی»</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 7px;">
    {field_label("چطوری بازی می‌شه؟")}
    <span style="display: block; min-height: 118px; box-sizing: border-box; padding: 12px 14px; border-radius: 14px; background: #FFFFFF; border: 2px solid #2F35F5; font-size: 14px; line-height: 1.8;">یه بیت نشون بده که یکی از کلمه‌هاش عوض شده؛ باید پیدا کنی کدومه و درستش چی بوده<span style="display: inline-block; width: 2px; height: 18px; background: #2F35F5; vertical-align: middle; margin-right: 1px;"></span></span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 7px;">
    {field_label("با کی بازی می‌شه؟")}
    <div role="group" aria-label="با کی" style="display: flex; gap: 4px; background: #E6E3EC; border-radius: 14px; padding: 4px;">{who}</div>
  </div>
  <span style="font-size: 12px; line-height: 1.7; color: #8A8698; padding: 0 4px;">بدون حساب هم می‌شه فرستاد. اگه وارد شده باشی، نام کاربریت هم میاد تا بتونیم جوابت رو بدیم.</span>
</div>
''' + tail
wr("FeedbackGame.dc.html", form)
print("feedback")

# ---------------- the bug form: what happened + everything we know about that moment ----------------
REC = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3.5" fill="currentColor"></circle></svg>'
toggle_off = '<span role="switch" aria-checked="false" style="width: 44px; height: 26px; flex-shrink: 0; border-radius: 999px; background: #DAD6E2; position: relative;"><span style="position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF;"></span></span>'
often = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 7px 0; border-radius: 12px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "transparent"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in [("همیشه", False), ("گاهی", True), ("یه بار", False)])
trail = '<span style="color: #C9C5D3; margin: 0 4px;">←</span>'.join(f'<span style="white-space: nowrap;">{t}</span>' for t in ["خونه", "کاوش", "دیوان حافظ", "غزل ۳", "پخش بیت ۲", "<b style=\"color: #FF4D24;\">تکون</b>"])
tech = "".join(f'<div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11.5px; padding: 2px 0;"><span style="color: #8A8698; flex-shrink: 0;">{k}</span><span style="font-weight: 500; text-align: left;">{v}</span></div>' for k, v in [
    ("همون لحظه", "خوندن غزل · بیت ۲ از ۹ · بیت به بیت"),
    ("خوانش", "در حال پخش · ۰:۴۲ از ۲:۱۰"),
    ("متن", "پرستو · پررنگ · کاغذی · اندازه‌ی ۴"),
    ("اینترنت", "وای‌فای · خوب"),
    ("حساب", "وارد شده"),
    ("خطاهای اخیر", "۲ تا در ۵ دقیقه‌ی آخر"),
    ("نسخه‌ی اپ", "۲.۰ · ساخت ۱۲"),
    ("گوشی", "iPhone 16 Pro"),
    ("سیستم", "iOS ۲۶.۱"),
])
bugform = head("باگ دیدم") + f"""<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 12px; overflow: hidden;">
  <div style="display: flex; align-items: center; gap: 10px;">
    <a href="FeedbackShake.dc.html" aria-label="بستن" style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: #FFFFFF; color: #14112B; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(20,17,43,0.1);">{CLOSE}</a>
    <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1; flex-grow: 1; padding-top: 3px;">باگ دیدم</span>
    <a href="#" style="text-decoration: none; background: #2F35F5; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 7px 16px; font-size: 14px; font-weight: 700; box-shadow: 0 3px 10px rgba(47,53,245,0.28);">بفرست</a>
  </div>
  <div style="display: flex; flex-direction: column; gap: 6px;">
    {field_label("چی شد؟")}
    <span style="display: block; min-height: 74px; box-sizing: border-box; padding: 10px 14px; border-radius: 14px; background: #FFFFFF; border: 2px solid #2F35F5; font-size: 14px; line-height: 1.8;">دکمه‌ی پخش رو زدم، بیت دوم خونده شد ولی پیشرفت روی بیت اول موند<span style="display: inline-block; width: 2px; height: 18px; background: #2F35F5; vertical-align: middle; margin-right: 1px;"></span></span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 13px; font-weight: 700; flex-shrink: 0;">چند بار پیش اومده؟</span><div role="group" aria-label="چند بار" style="flex-grow: 1; display: flex; gap: 4px; background: #E6E3EC; border-radius: 14px; padding: 4px;">{often}</div></div>
  <a href="#" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; box-sizing: border-box; border-radius: 14px; background: #FFFFFF; color: #FF4D24; border: 2px dashed #FFC2B3; font-size: 13px; font-weight: 700;">{REC}دوباره انجامش بده، ما فیلم می‌گیریم</a>
  <section aria-label="از همون لحظه همراهش می‌فرستیم" style="display: flex; flex-direction: column; gap: 9px; background: #FFFFFF; border-radius: 22px; padding: 12px 16px; box-shadow: 0 2px 10px rgba(20,17,43,0.06);">
    <span style="font-size: 13px; font-weight: 700;">از همون لحظه همراهش می‌فرستیم</span>
    <div style="display: flex; align-items: center; gap: 12px;">
      {shot(40, 0)}
      <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;"><span style="font-size: 13px; font-weight: 500;">عکس صفحه</span><a href="#" style="align-self: flex-start; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #2F35F5;">{PEN}خط بکش یا بپوشون</a></div>
      {toggle_on}
    </div>
    {tech_row("همون لحظه، کارهای قبلش، خطاها، گوشی")}
    <span style="font-size: 11px; line-height: 1.6; color: #8A8698;">چیزی که جای دیگه تایپ کردی یا پیام‌هات هیچ‌وقت همراهش نمیاد. عکس صفحه رو خودت تصمیم می‌گیری.</span>
  </section>
</div>
""" + tail
wr("FeedbackBug.dc.html", bugform)
print("bug")
