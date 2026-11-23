import json, os, sys
P = sys.argv[1]
PLAIN = len(sys.argv) > 2  # write a plain preview html too

GF = ("https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@400;500;700"
      "&amp;family=Noto+Naskh+Arabic:wght@400;500;600&amp;family=Amiri:wght@400;700"
      "&amp;family=Scheherazade+New:wght@400;500&amp;family=Mirza:wght@400;500;600"
      "&amp;family=Markazi+Text:wght@400;500;600&amp;family=Lateef:wght@400;500"
      "&amp;family=Gulzar&amp;family=Noto+Nastaliq+Urdu:wght@400;500&amp;display=swap")
FACES = ("@font-face{font-family:'Parastoo';src:url(/_blob/9fe3b1905f2e20db67b7d7711a8c69d0)}"
         "@font-face{font-family:'Gandom';src:url(/_blob/68a06d356b96bd36f8f9011a12ab1244)}")

BEYTS = [
    ("اگر آن ترک شیرازی به دست آرد دل ما را", "به خال هندویش بخشم سمرقند و بخارا را"),
    ("بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را"),
]

# (css family, persian name, style tag, note, size, line-height, weight, current)
FONTS = [
    ("Parastoo", "پرستو", "دست‌نویس‌طور", "الان این رو داریم. نازک و کم‌جون، کنار لاله‌زار گم می‌شه.", 19, 1.9, 400, True),
    ("Mirza", "میرزا", "نسخ فارسی", "برای فارسی طراحی شده؛ پررنگ‌تره و کنار استیکرها کم نمیاره.", 21, 1.85, 500, False),
    ("Amiri", "امیری", "نسخ چاپی قدیمی", "حس دیوان‌های چاپ سنگی؛ کلاسیک و باوقار.", 19, 2.0, 400, False),
    ("Markazi Text", "مرکزی", "نسخ امروزی", "طراح ایرانی؛ تمیز، کمی فشرده، خوب برای متن بلند.", 21, 1.8, 500, False),
    ("Scheherazade New", "شهرزاد", "نسخ درشت", "گرد و درشت؛ برای خوندن طولانی خیلی راحته.", 20, 1.9, 400, False),
    ("Noto Naskh Arabic", "نسخ", "نسخ کتابی", "خوانا و بی‌دردسر، ولی شخصیت زیادی نداره.", 18, 1.95, 500, False),
    ("Lateef", "لطیف", "نسخ نرم", "ظریف و نرم؛ اندازه‌ی ریزتری داره، باید درشت‌تر نشونش داد.", 23, 1.7, 400, False),
    ("Gulzar", "گلزار", "نستعلیق", "بیشترین حس شعر فارسی رو داره؛ هویت خیلی قوی.", 19, 2.3, 400, False),
    ("Noto Nastaliq Urdu", "نستعلیق نوتو", "نستعلیق", "نستعلیق کامل، ولی جای عمودی خیلی زیادی می‌گیره.", 16, 2.6, 400, False),
    ("Vazirmatn", "وزیر", "مدرن بی‌تزئین", "مثل متن خود اپ؛ امروزی ولی حس شعر رو کم می‌کنه.", 17, 2.0, 500, False),
    ("Gandom", "گندم", "مدرن گرد", "گرد و دوستانه؛ برای بازی‌ها خوبه، برای غزل کمتر.", 18, 2.0, 400, False),
]

def card(f):
    fam, name, tag, note, size, lh, w, cur = f
    poem = "\n".join(
        f'''      <div style="display: flex; flex-direction: column; font-family: '{fam}', serif; font-size: {size}px; line-height: {lh}; font-weight: {w};"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></div>'''
        for a, b in BEYTS)
    badge = ('<span style="background: #FF4D24; color: #FFFFFF; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700;">فعلی</span>' if cur else "")
    return f'''    <div style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 24px; padding: 18px 20px 20px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);{' outline: 3px solid #FF4D24; outline-offset: -3px;' if cur else ''}">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1; padding-top: 3px;">{name}</span>
        <span style="background: #E8E9FF; color: #2F35F5; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 700;">{tag}</span>
        {badge}
        <span dir="ltr" style="margin-inline-start: auto; font-size: 11px; color: #8A8698;">{fam} · OFL</span>
      </div>
{poem}
      <div style="font-size: 12px; line-height: 1.6; color: #4A4660; border-top: 1px dashed #E6E1D6; padding-top: 10px;">{note}</div>
    </div>
'''

pick = '''    <div style="display: flex; flex-direction: column; justify-content: center; gap: 10px; background: #2F35F5; color: #FFFFFF; border-radius: 24px; padding: 22px 24px; box-shadow: 0 3px 12px rgba(20,17,43,0.12);">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1.1;">پیشنهاد من</span>
      <span style="font-size: 14px; line-height: 1.8;"><b>گلزار</b> (نستعلیق) برای خوندن شعر: بیشترین فرق رو با بقیه‌ی اپ‌ها می‌سازه و هنوز خواناست.</span>
      <span style="font-size: 14px; line-height: 1.8;"><b>میرزا</b> اگه خوانایی مهم‌تره، یا به‌عنوان انتخاب دوم توی «آ».</span>
      <span style="font-size: 13px; line-height: 1.7; color: #D6D8FF;">کنار همین تخته، صفحه‌ی «کل شعر» رو با هر دو فونت گذاشتم. همه رایگان و آزاد (OFL) هستن.</span>
    </div>
'''

body = f'''<div dir="rtl" style="width: 1600px; min-height: 1180px; box-sizing: border-box; padding: 40px 44px 44px; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 26px;">
  <div style="display: flex; align-items: baseline; gap: 14px;">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 40px; line-height: 1;">فونت شعر</span>
    <span style="font-size: 15px; color: #4A4660;">همون دو بیت، توی ۱۱ فونت آزاد. اندازه‌ها جوری تنظیم شده که چشمی هم‌اندازه دیده بشن.</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; align-items: start;">
{"".join(card(f) for f in FONTS)}{pick}  </div>
</div>
'''

dc = f'''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>فونت شعر</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="{GF}" rel="stylesheet">
<style>
body{{margin:0}}
{FACES}
</style>
</helmet>
{body}</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1600,"height":1180}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
open(os.path.join(P, "PoemFonts.dc.html"), "w", encoding="utf-8").write(dc)

if PLAIN:
    plain = f'''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>fonts</title>
<link href="{GF}" rel="stylesheet"><style>body{{margin:0}}</style></head><body>{body}</body></html>'''
    open(sys.argv[2], "w", encoding="utf-8").write(plain)

d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["PoemFonts.dc.html"] = {"x": 2350, "y": 3892, "w": 1600, "h": 1180, "title": "۱۲ه · فونت شعر", "page": "sticker"}
if "PoemFonts.dc.html" not in d["order"]:
    d["order"].append("PoemFonts.dc.html")
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("fonts")
