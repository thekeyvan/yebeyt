"""Map board in the sticker style, current structure. Run before apply_fonts.
Also renames the poem-type label on StickerSystem to bold Parastoo."""
import os, re, sys
P = sys.argv[1]

HEAD = '''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>نقشه‌ی اپ</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
a{color:#2F35F5}a:hover{color:#14112B}
</style>
</helmet>
'''
TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":880}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
'''
ICON = {
    "خونه": '<path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z"></path>',
    "کاوش": '<circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path>',
    "بازی": '<rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="currentColor"></circle>',
    "پیام‌ها": '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>',
    "من": '<circle cx="12" cy="8.5" r="4"></circle><path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6"></path>',
}
def icon(name, color):
    return f'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">{ICON[name]}</svg>'

# (tab, sticker bg, icon colour, items, screens[(code, board)], featured)
TABS = [
    ("خونه", "#FF3D8B", "#FFFFFF",
     ["<b>بیت امروز:</b> یه بیت، از روی سلیقه", "رد کن یا نگه دار؛ پسند، بازنشر، بفرست", "<b>دوستات:</b> بیت‌هایی که به اشتراک گذاشتن", "نتیجه‌ی معمای امروزشون و «تو هم»"],
     [("ردیف ۲", "Flow1.dc.html")], False),
    ("کاوش", "#6CCB3A", "#14112B",
     ["جستجو: شاعر، شعر، یه کلمه، یه تیکه از بیت", "<b>فال حافظ</b>", "موضوع‌ها، پرطرفدارها", "شاعر ← صفحه‌ی شاعر", "<b>کتابخونه:</b> کتاب ← بخش ← فهرست ← غزل"],
     [("ردیف ۲", "Flow1.dc.html")], False),
    ("بازی", "#FFB703", "#14112B",
     ["<b>معمای امروز</b>", "<b>مشاعره:</b> با یه دوست یا با «یه بیت»", "جورچین بیت · حدس شاعر · مصراع دوم", "از کدوم کتاب؟ · معنی‌یاب · گوش کن", "بازی رودررو · رده‌بندی و لیگ", "<b>بازی با دوست:</b> بساز و با لینک دعوت کن، حتی کسی که اپ رو نداره"],
     [("ردیف ۴", "Flow2.dc.html"), ("ردیف ۵", "FlowPlay.dc.html")], True),
    ("پیام‌ها", "#FF4D24", "#FFFFFF",
     ["گفتگو با دوستا", "بیت بفرست، مثل کارت پستال", "دعوت به مشاعره و بازی رودررو", "معمای امروز رو بفرست", "<b>دیوان مشترک</b> با هر دوست"],
     [("ردیف ۶", "Flow3.dc.html")], False),
    ("من", "#14112B", "#FFFFFF",
     ["چهره‌ی من و نام کاربری", "امتیاز، رشته‌ی روزها، نشان‌ها", "<b>دیوان من:</b> بیت‌های نگه‌داشته، با جستجو و دسته‌بندی", "تنظیمات و حریم خصوصی", "<b>تکون بده:</b> باگ، ایده، پیشنهاد بازی", "<b>دوستاتو بیار</b> با یه متن آماده"],
     [("ردیف ۷", "FlowMe.dc.html"), ("ردیف ۸", "FlowFeedback.dc.html")], False),
]

def chip(code, board, on_dark):
    bg, fg = ("rgba(255,255,255,0.18)", "#FFFFFF") if on_dark else ("#F1EFEA", "#2F35F5")
    return f'<a href="{board}" style="text-decoration: none; background: {bg}; color: {fg}; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700;">{code}</a>'

def column(tab, sbg, icol, items, screens, featured):
    bg, fg, sub = ("#2F35F5", "#FFFFFF", "#D6D8FF") if featured else ("#FFFFFF", "#14112B", "#4A4660")
    lift = "transform: translateY(-14px); box-shadow: 0 10px 24px rgba(47,53,245,0.30);" if featured else "box-shadow: 0 3px 12px rgba(20,17,43,0.08);"
    lis = "".join(f'<li style="display: flex; gap: 8px; align-items: baseline;"><span aria-hidden="true" style="flex-shrink: 0; width: 6px; height: 6px; border-radius: 2px; background: {sbg if not featured else "#FFB703"}; transform: translateY(-2px);"></span><span>{t}</span></li>' for t in items)
    chips = "".join(chip(c, b, featured) for c, b in screens)
    return f'''    <section aria-label="تب {tab}" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; background: {bg}; color: {fg}; border-radius: 28px; padding: 20px 18px 18px; {lift}">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="width: 48px; height: 48px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {sbg}; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center;">{icon(tab, icol)}</span>
        <span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1; padding-top: 4px;">{tab}</span>
      </div>
      <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 14.5px; line-height: 1.65; flex-grow: 1;">{lis}</ul>
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;"><span style="font-size: 12px; color: {sub};">روی بوم:</span>{chips}</div>
    </section>
'''

def step(t, hi=False):
    st = "background: #6CCB3A; color: #14112B; font-weight: 700;" if hi else "background: #F1EFEA; color: #14112B; font-weight: 500;"
    return f'<span style="{st} border-radius: 999px; padding: 6px 14px; font-size: 13px; white-space: nowrap;">{t}</span>'
arrow = '<span aria-hidden="true" style="color: #8A8698; font-size: 14px;">←</span>'
entry = arrow.join([step("خوش اومدی"), step("سلیقه"), step("یه بازی ۳۰ ثانیه‌ای"), step("حساب با اپل یا گوگل", True) + '<span style="font-size: 12px; color: #4A4660;">یا</span>' + step("«فعلاً بدون حساب»"), step("نام کاربری"), step("دوستات")]) + chip("ردیف ۱", "FlowStart.dc.html", False)

body = f'''<div dir="rtl" style="width: 1280px; height: 880px; box-sizing: border-box; padding: 36px 48px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 18px; overflow: hidden;">
  <div style="display: flex; align-items: baseline; gap: 14px;">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 44px; line-height: 1;">نقشه‌ی اپ</span>
    <span style="font-size: 15px; color: #4A4660;">۵ تب پایین صفحه؛ «بازی» وسط و بزرگ. هر تب می‌گه صفحه‌هاش توی کدوم ردیف بومه.</span>
  </div>

  <section aria-label="ورود" style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 24px; padding: 16px 20px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1; padding: 3px 0 0 6px;">ورود</span>{entry}</div>
    <div style="display: flex; gap: 12px; font-size: 13px; line-height: 1.7;">
      <div style="flex: 1; background: #EEF9E7; border-radius: 16px; padding: 8px 14px;"><b>بدون حساب:</b> کتابخونه و جستجو، بیت امروز، فال، خوندن و شنیدن شعر، بازی تکی، نگه داشتن روی همین گوشی.</div>
      <div style="flex: 1; background: #E8E9FF; border-radius: 16px; padding: 8px 14px;"><b>حساب لازمه:</b> امتیاز و رده‌بندی، مشاعره و بازی رودررو، پیام‌ها، دوستات، بازنشر، همگام شدن. همون لحظه که سراغش بری می‌پرسیم؛ فقط با اپل یا گوگل، بعدش یه نام کاربری.</div>
    </div>
  </section>

  <div style="display: flex; gap: 14px; align-items: stretch; height: 450px; padding-top: 16px;">
{"".join(column(*t) for t in TABS)}  </div>

  <div style="display: flex; gap: 14px;">
    <section aria-label="خوندن شعر" style="flex: 3; display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 24px; padding: 16px 20px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
      <div style="display: flex; align-items: center; gap: 10px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1; padding-top: 3px;">خوندن شعر</span><span style="font-size: 12px; color: #4A4660;">از هر جای اپ که یه بیت یا غزل باز بشه</span><span style="margin-inline-start: auto; display: flex; gap: 6px;">{chip("ردیف ۳", "FlowRead.dc.html", False)}</span></div>
      <div style="font-size: 13px; line-height: 1.8;"><b>بیت به بیت</b> یا <b>کل شعر</b> · «معنی این بیت» با واژه‌های نقطه‌چین · «آ»: اندازه، قلم، وزن، چینش، زمینه · نگه داشتن روی هر بیت · ▶ خوندن بیت به بیت (اگه خوانش داشته باشه) · بازی با همین غزل</div>
    </section>
    <section aria-label="امتیاز" style="flex: 2; display: flex; flex-direction: column; gap: 8px; background: #14112B; color: #FFFFFF; border-radius: 24px; padding: 16px 20px;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1; padding-top: 3px; color: #FFB703;">امتیاز</div>
      <div style="font-size: 13px; line-height: 1.8;">هر بازی امتیاز می‌ده · رشته‌ی روزها با معمای امروز · لیگ هفتگی ۲۰ نفره، بالایی‌ها می‌رن لیگ بعد · رده‌بندی: دوستا / همه</div>
    </section>
  </div>
</div>
'''
open(os.path.join(P, "Map.dc.html"), "w", encoding="utf-8").write(HEAD + body + TAIL)

# the poem type on the design-language board is bold Parastoo now
ss = os.path.join(P, "StickerSystem.dc.html")
s = open(ss, encoding="utf-8").read()
s2 = s.replace(">نسخ · شعر<", ">پرستو · شعر<").replace(">میرزا · شعر<", ">پرستو · شعر<")
open(ss, "w", encoding="utf-8").write(s2)
print("map", "sticker-label" if s2 != s else "sticker-label-unchanged")
