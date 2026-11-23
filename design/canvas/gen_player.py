import json, os, sys
P = sys.argv[1]

HEAD = '''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700&amp;family=Noto+Naskh+Arabic:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
@font-face{{font-family:'Parastoo';src:url(/_blob/9fe3b1905f2e20db67b7d7711a8c69d0)}}@font-face{{font-family:'Gandom';src:url(/_blob/68a06d356b96bd36f8f9011a12ab1244)}}@font-face{{font-family:'Sahel';src:url(/_blob/b64bda18f46572bff3417fa47d760023)}}@font-face{{font-family:'Shabnam';src:url(/_blob/657f6f793803047173f39b46bb9f84cc)}}
a{{color:#2F35F5}}a:hover{{color:#14112B}}
</style>
</helmet>
'''
TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
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
 "down": '<path d="M6 9l6 6 6-6"></path>',
 "more": '<circle cx="5" cy="12" r="1.6" fill="currentColor"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor"></circle><circle cx="19" cy="12" r="1.6" fill="currentColor"></circle>',
 "back15": '<path d="M4 12a8 8 0 1 0 3-6.2"></path><path d="M4 4v4h4"></path>',
 "fwd15": '<path d="M20 12a8 8 0 1 1-3-6.2"></path><path d="M20 4v4h-4"></path>',
 "lyrics": '<path d="M5 6h14M5 11h10M5 16h7"></path>',
 "meaning": '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path>',
 "save": '<path d="M6 3.5h12v17l-6-4-6 4z"></path>',
 "send": '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>',
 "prev": '<path d="M18 6v12l-8-6zM8 6v12" ></path>',
 "next": '<path d="M6 6v12l8-6zM16 6v12"></path>',
 "voice": '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path>',
}
def ic(name, size=22, color="currentColor", sw=2.2):
    return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICON[name]}</svg>'

def roundbtn(label, inner, bg="rgba(255,255,255,0.16)", color="#FFFFFF", size=44, href="#"):
    return f'<a href="{href}" aria-label="{label}" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; color: {color}; display: flex; align-items: center; justify-content: center;">{inner}</a>'

BEYTS = [
 ("اگر آن ترک شیرازی به دست آرد دل ما را", "به خال هندویش بخشم سمرقند و بخارا را"),
 ("بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را"),
 ("فغان کاین لولیان شوخ شیرین کار شهرآشوب", "چنان بردند صبر از دل که ترکان خوان یغما را"),
 ("ز عشق ناتمام ما جمال یار مستغنی است", "به آب و رنگ و خال و خط چه حاجت روی زیبا را"),
]

def progress(on_dark):
    track = "rgba(255,255,255,0.25)" if on_dark else "#E6E3EC"
    txt = "#D6D8FF" if on_dark else "#4A4660"
    return f'''<div style="display: flex; flex-direction: column; gap: 6px;">
      <div role="slider" aria-label="جای پخش" aria-valuemin="0" aria-valuemax="130" aria-valuenow="42" style="position: relative; height: 6px; border-radius: 3px; background: {track};">
        <span style="position: absolute; top: 0; bottom: 0; right: 0; width: 32%; border-radius: 3px; background: #FFB703;"></span>
        <span style="position: absolute; top: 50%; right: 32%; width: 16px; height: 16px; margin: -8px -8px 0 0; border-radius: 50%; background: #FFB703; border: 3px solid #FFFFFF; box-sizing: border-box; box-shadow: 0 1px 4px rgba(20,17,43,0.3);"></span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: {txt}; font-weight: 500;"><span>۰:۴۲</span><span>−۱:۲۸</span></div>
    </div>'''

# ---------------- Lyrics view ----------------
lines = ""
for i, (a, b) in enumerate(BEYTS):
    if i == 1:
        lines += f'''    <a href="#" aria-current="true" style="text-decoration: none; position: relative; color: #FFFFFF; font-family: 'Noto Naskh Arabic', serif; font-weight: 600; font-size: 25px; line-height: 1.65;">
      <span aria-hidden="true" style="position: absolute; top: -14px; left: -4px; background: #FFB703; color: #14112B; border: 3px solid #FFFFFF; border-radius: 999px; padding: 1px 9px 0; font-family: 'Lalezar', sans-serif; font-size: 13px; line-height: 1.6; transform: rotate(-8deg); pointer-events: none;">الان</span>
      <div>{a}</div><div>{b}</div>
    </a>
'''
    else:
        op = "0.38" if i == 0 else ("0.55" if i == 2 else "0.35")
        lines += f'''    <a href="#" style="text-decoration: none; color: rgba(255,255,255,{op}); font-family: 'Noto Naskh Arabic', serif; font-weight: 600; font-size: 25px; line-height: 1.65;"><div>{a}</div><div>{b}</div></a>
'''

lyrics = HEAD.format(title="خوندن غزل") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 22px 0; background-color: #2F35F5; background-image: radial-gradient(rgba(255,255,255,0.12) 1.2px, transparent 1.2px); background-size: 18px 18px; color: #FFFFFF; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">

  <div style="display: flex; align-items: center; gap: 10px;">
    {roundbtn("بستن", ic("down", 22, "#FFFFFF", 2.6), href="Poet.dc.html")}
    <div style="display: flex; flex-direction: column; align-items: center; flex-grow: 1;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.1;">غزل ۳</div>
      <div style="font-size: 12px; color: #D6D8FF;">حافظ · دیوان</div>
    </div>
    {roundbtn("بیشتر", ic("more", 22, "#FFFFFF"))}
  </div>

  <div style="position: absolute; top: 118px; right: 22px; left: 22px; height: 470px; overflow: hidden; display: flex; flex-direction: column; gap: 26px; padding-top: 4px; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 40px, #000 400px, transparent 470px); mask-image: linear-gradient(180deg, transparent 0, #000 40px, #000 400px, transparent 470px);">
{lines}  </div>

  <div style="position: absolute; right: 16px; left: 16px; bottom: 24px; display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; color: #14112B; border-radius: 28px; padding: 16px 18px 14px; box-shadow: 0 6px 20px rgba(10,10,60,0.30);">
    <div style="display: flex; align-items: center; gap: 12px;">
      <a href="Player.dc.html" aria-label="پخش‌کننده‌ی کامل" style="width: 46px; height: 46px; flex-shrink: 0; box-sizing: border-box; border-radius: 12px; background: #2F35F5; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.25); display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"><path d="M12 5 C16 8 16 16 12 19 C8 16 8 8 12 5Z" fill="none" stroke="#FFFFFF" stroke-width="2"></path></svg></a>
      <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
        <div style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">اگر آن ترک شیرازی…</div>
        <div style="font-size: 12px; color: #4A4660;">با صدای [نام گوینده]</div>
      </div>
      {roundbtn("معنیِ این بیت", ic("meaning", 20, "#14112B"), bg="#F1EFEA", color="#14112B", size=40)}
    </div>
    {progress(False)}
    <div style="display: flex; align-items: center; justify-content: space-between;">
      {roundbtn("متن", ic("lyrics", 22, "#2F35F5", 2.6), bg="#E8E9FF", color="#2F35F5", size=40)}
      {roundbtn("۱۵ ثانیه جلو", ic("fwd15", 24, "#14112B"), bg="transparent", color="#14112B", size=44)}
      <a href="#" aria-label="مکث" style="width: 62px; height: 62px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 4px solid #FFFFFF; box-shadow: 0 3px 10px rgba(20,17,43,0.28); display: flex; align-items: center; justify-content: center; gap: 6px;"><span style="width: 6px; height: 20px; border-radius: 2px; background: #FFFFFF;"></span><span style="width: 6px; height: 20px; border-radius: 2px; background: #FFFFFF;"></span></a>
      {roundbtn("۱۵ ثانیه عقب", ic("back15", 24, "#14112B"), bg="transparent", color="#14112B", size=44)}
      {roundbtn("بازی با این غزل", '<span style="display: inline-flex; gap: 2px;"><span style="width: 8px; height: 13px; border-radius: 3px; background: #2F35F5;"></span><span style="width: 8px; height: 13px; border-radius: 3px; background: #FF4D24;"></span></span>', bg="#F1EFEA", color="#14112B", size=40, href="JigsawE.dc.html")}
    </div>
  </div>

</div>
''' + TAIL

# ---------------- Full player ----------------
player = HEAD.format(title="پخش غزل") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 24px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 22px; overflow: hidden;">

  <div style="display: flex; align-items: center; gap: 10px;">
    {roundbtn("بستن", ic("down", 22, "#14112B", 2.6), bg="#FFFFFF", color="#14112B", href="Poem.dc.html")}
    <div style="flex-grow: 1; text-align: center; font-size: 13px; font-weight: 700; color: #4A4660;">در حال پخش از دیوان حافظ</div>
    {roundbtn("بیشتر", ic("more", 22, "#14112B"), bg="#FFFFFF", color="#14112B")}
  </div>

  <div style="position: relative; align-self: stretch; height: 300px; box-sizing: border-box; border-radius: 34px; background: #2F35F5; border: 7px solid #FFFFFF; box-shadow: 0 10px 28px rgba(20,17,43,0.25); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px 18px; color: #FFFFFF;">
    <span style="position: absolute; top: 14px; right: 16px; font-size: 12px; font-weight: 700; color: #D6D8FF;">بیت ۲ از ۹</span>
    <span aria-hidden="true" style="position: absolute; top: -16px; left: 18px; background: #FFB703; color: #14112B; border: 4px solid #FFFFFF; border-radius: 999px; padding: 3px 12px 1px; font-family: 'Lalezar', sans-serif; font-size: 15px; transform: rotate(-9deg); box-shadow: 0 2px 6px rgba(20,17,43,0.22); pointer-events: none;">الان</span>
    <div aria-label="در حال خوندن: بده ساقی می باقی که در جنت نخواهی یافت، کنار آب رکن آباد و گلگشت مصلا را" style="font-family: 'Parastoo', serif; font-size: 24px; line-height: 2; text-align: center;">
      <div><span>بده ساقی می باقی که</span> <span style="color: rgba(255,255,255,0.42);">در جنت نخواهی یافت</span></div>
      <div style="color: rgba(255,255,255,0.42);">کنار آب رکن آباد و گلگشت مصلا را</div>
    </div>
    <span style="font-size: 12px; color: #D6D8FF;">کلمه‌ها همراه صدا روشن می‌شن</span>
  </div>

  <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
    <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
      <div style="font-family: 'Noto Naskh Arabic', serif; font-weight: 600; font-size: 21px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">اگر آن ترک شیرازی به دست آرد دل ما را</div>
      <div style="font-size: 13px; color: #4A4660;">حافظ · با صدای [نام گوینده]</div>
    </div>
    {roundbtn("نگه دار", ic("save", 22, "#14112B"), bg="#FFFFFF", color="#14112B")}
  </div>

  {progress(False)}

  <div style="display: flex; align-items: center; justify-content: center; gap: 34px;">
    {roundbtn("غزل بعدی", ic("next", 26, "#14112B", 2.4), bg="transparent", color="#14112B", size=50)}
    <a href="#" aria-label="مکث" style="width: 78px; height: 78px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 5px solid #FFFFFF; box-shadow: 0 4px 14px rgba(20,17,43,0.28); display: flex; align-items: center; justify-content: center; gap: 7px;"><span style="width: 8px; height: 26px; border-radius: 3px; background: #FFFFFF;"></span><span style="width: 8px; height: 26px; border-radius: 3px; background: #FFFFFF;"></span></a>
    {roundbtn("غزل قبلی", ic("prev", 26, "#14112B", 2.4), bg="transparent", color="#14112B", size=50)}
  </div>

  <div style="display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-radius: 22px; padding: 8px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.10);">
    <a href="Poem.dc.html" aria-label="متن" style="color: #2F35F5; display: flex; padding: 8px;">{ic("lyrics", 22, "#2F35F5", 2.6)}</a>
    <a href="#" style="text-decoration: none; color: #14112B; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; background: #F1EFEA; border-radius: 999px; padding: 7px 12px;">{ic("voice", 16, "#14112B")}صدای دیگه</a>
    <a href="#" aria-label="بفرست" style="color: #14112B; display: flex; padding: 8px;">{ic("send", 22, "#14112B")}</a>
  </div>

</div>
''' + TAIL

open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(lyrics)
open(os.path.join(P, "Player.dc.html"), "w", encoding="utf-8").write(player)
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["Poem.dc.html"]["title"] = "۱۲ · خوندن غزل (مثل متنِ آهنگ)"
d["boards"]["Player.dc.html"] = {"x": 1410, "y": 2928, "w": 390, "h": 844, "title": "۱۳ · پخش‌کننده", "page": "sticker"}
if "Player.dc.html" not in d["order"]:
    d["order"].append("Player.dc.html")
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok")

# ---------------- Reading view v3 (calm, audio optional) ----------------
B9 = BEYTS
def act(label, inner, count=None, on=False):
    c = f'<span style="font-size: 12px; font-weight: 700;">{count}</span>' if count else ""
    col = "#FF3D8B" if on else "#14112B"
    return f'<a href="#" aria-label="{label}" style="text-decoration: none; color: {col}; display: inline-flex; align-items: center; gap: 4px; padding: 4px;">{inner}{c}</a>'
heart_f = '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="#FF3D8B" stroke="#FF3D8B" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path></svg>'
rep = '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l3 3-3 3M4 12V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 12v3a3 3 0 0 1-3 3H4"></path></svg>'
rows = ""
for i, (a, b) in enumerate(B9):
    n = "۱۲۳۴"[i]
    if i == 1:
        rows += f'''  <div style="display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 22px; padding: 14px 16px 8px; box-shadow: 0 4px 16px rgba(20,17,43,0.10);">
    <div style="font-family: 'Noto Naskh Arabic', serif; font-size: 21px; line-height: 1.85; text-align: center; color: #14112B;"><div>{a}</div><div>{b}</div></div>
    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #EEEBF2; padding-top: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">{act("پسند", heart_f, "۱۲", True)}{act("بازنشر", rep)}{act("بفرست", ic("send", 21))}{act("نگه دار", ic("save", 21))}</div>
      <a href="#" style="text-decoration: none; font-size: 13px; font-weight: 700; color: #2F35F5; background: #E8E9FF; border-radius: 999px; padding: 5px 12px;">معنی</a>
    </div>
  </div>
'''
    else:
        rows += f'''  <a href="#" style="text-decoration: none; display: block; font-family: 'Noto Naskh Arabic', serif; font-size: 21px; line-height: 1.85; text-align: center; color: #14112B; padding: 2px 16px;"><div>{a}</div><div>{b}</div></a>
'''
reading = HEAD.format(title="خوندن غزل") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">

  <div style="display: flex; align-items: center; gap: 10px;">
    {roundbtn("بستن", ic("down", 22, "#14112B", 2.6), bg="#FFFFFF", color="#14112B", href="Poet.dc.html")}
    <div style="display: flex; flex-direction: column; align-items: center; flex-grow: 1;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.1;">غزل ۳</div>
      <div style="font-size: 12px; color: #4A4660;">حافظ · دیوان</div>
    </div>
    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: #14112B; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 18px; padding-top: 3px;">آ</a>
  </div>

  <div style="display: flex; align-items: center; gap: 10px;">
    <div role="progressbar" aria-label="جای تو توی غزل" aria-valuemin="1" aria-valuemax="9" aria-valuenow="2" style="flex-grow: 1; display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 3px;">
      {''.join(f'<span style="height: 5px; border-radius: 3px; background: {"#2F35F5" if k < 2 else "#E1DEE8"};"></span>' for k in range(9))}
    </div>
    <span style="font-size: 12px; font-weight: 700; color: #4A4660; white-space: nowrap;">بیت ۲ از ۹</span>
  </div>

{rows}
  <div style="position: absolute; right: 18px; left: 18px; bottom: 26px; display: flex; gap: 10px; justify-content: center;">
    <a href="Player.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; border-radius: 999px; padding: 8px 16px 8px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.22); font-size: 14px; font-weight: 700;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path fill="#FFFFFF" d="M7 4v16l13-8z"></path></svg>شنیدن</a>
    <a href="JigsawE.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: #14112B; border-radius: 999px; padding: 12px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.14); font-size: 14px; font-weight: 700;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F35F5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="#2F35F5"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="#2F35F5"></circle></svg>بازی با این غزل</a>
  </div>

</div>
''' + TAIL
open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(reading)
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["Poem.dc.html"]["title"] = "۱۲ · خوندن غزل"
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v3")

# ---------------- Focus reading v4: one couplet, vertical progress, meaning state ----------------
def vprog(cur):
    segs = "".join(f'<span style="width: 5px; height: {22 if k == cur else 12}px; border-radius: 3px; background: {"#2F35F5" if k <= cur else "#DAD6E2"};"></span>' for k in range(9))
    return f'''  <div role="progressbar" aria-label="بیت ۲ از ۹" aria-valuemin="1" aria-valuemax="9" aria-valuenow="2" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 5px;">
    {segs}
    <span style="font-size: 11px; font-weight: 700; color: #4A4660; margin-top: 4px;">۲/۹</span>
  </div>
'''
header = f'''  <div style="display: flex; align-items: center; gap: 10px;">
    {roundbtn("بستن", ic("down", 22, "#14112B", 2.6), bg="#FFFFFF", color="#14112B", href="Poet.dc.html")}
    <div style="display: flex; flex-direction: column; align-items: center; flex-grow: 1;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.1;">غزل ۳</div>
      <div style="font-size: 12px; color: #4A4660;">حافظ · دیوان</div>
    </div>
    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: #14112B; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 18px; padding-top: 3px;">آ</a>
  </div>
'''
actions = f'''<div style="display: flex; align-items: center; justify-content: center; gap: 18px;">{act("پسند", heart_f, "۱۲", True)}{act("بازنشر", rep)}{act("بفرست", ic("send", 21))}{act("نگه دار", ic("save", 21))}</div>'''
cur_a, cur_b = B9[0]
prev_hint = '<div style="font-family: \'Parastoo\', serif; font-size: 15px; line-height: 1.8; text-align: center; color: rgba(20,17,43,0.22);">…سرآغاز غزل</div>'
next_a, next_b = B9[1]
pills = '''  <div style="position: absolute; right: 18px; left: 18px; bottom: 26px; display: flex; gap: 10px; justify-content: center;">
    <a href="Player.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; border-radius: 999px; padding: 8px 16px 8px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.22); font-size: 14px; font-weight: 700;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path fill="#FFFFFF" d="M7 4v16l13-8z"></path></svg>شنیدن</a>
    <a href="JigsawE.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; color: #14112B; border-radius: 999px; padding: 12px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.14); font-size: 14px; font-weight: 700;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F35F5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="#2F35F5"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="#2F35F5"></circle></svg>بازی با این غزل</a>
  </div>
'''
def focus_page(title, mid):
    return HEAD.format(title=title) + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header}{vprog(1)}{mid}{pills}</div>
''' + TAIL


def dw(word, tip=None):
    t = ""
    if tip:
        t = f'<span role="tooltip" style="position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); white-space: nowrap; background: #14112B; color: #FFFFFF; font-family: \'Vazirmatn\', sans-serif; font-size: 13px; font-weight: 500; line-height: 1.4; border-radius: 12px; padding: 7px 12px; box-shadow: 0 4px 12px rgba(20,17,43,0.25);">{tip}<span aria-hidden="true" style="position: absolute; top: 100%; left: 50%; margin-left: -6px; border: 6px solid transparent; border-top-color: #14112B;"></span></span>'
    return f'<span style="position: relative; text-decoration: underline dotted #2F35F5; text-decoration-thickness: 2px; text-underline-offset: 9px; cursor: pointer;">{word}{t}</span>'
L2_TIP = f'کنار آب {dw("رکن آباد", "نهری در شیراز")} و {dw("گلگشت")} {dw("مصلا")} را'
L2_NOTIP = f'کنار آب {dw("رکن آباد")} و {dw("گلگشت")} {dw("مصلا")} را'

focus_mid = f'''  <div style="position: absolute; top: 120px; bottom: 110px; right: 40px; left: 40px; display: flex; flex-direction: column; justify-content: center; gap: 34px;">
    <div style="font-family: 'Parastoo', serif; font-size: 15px; line-height: 1.8; text-align: center; color: rgba(20,17,43,0.25);">{B9[0][1]}</div>
    <div style="display: flex; flex-direction: column; gap: 22px;">
      <div style="font-family: 'Parastoo', serif; font-size: 27px; line-height: 2; text-align: center;"><div>{B9[1][0]}</div><div>{B9[1][1]}</div></div>
      {actions}
      <a href="PoemMeaning.dc.html" style="align-self: center; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #2F35F5; background: #E8E9FF; border-radius: 999px; padding: 7px 16px;">{ic("meaning", 16, "#2F35F5")}معنی این بیت</a>
    </div>
    <div style="font-family: 'Parastoo', serif; font-size: 15px; line-height: 1.8; text-align: center; color: rgba(20,17,43,0.25);">{B9[2][0]}</div>
  </div>
'''
meaning_mid = f'''  <div style="position: absolute; top: 112px; bottom: 100px; right: 40px; left: 40px; display: flex; flex-direction: column; justify-content: center; gap: 22px;">
    <div style="font-family: 'Parastoo', serif; font-size: 24px; line-height: 2; text-align: center;"><div>{B9[1][0]}</div><div>{L2_TIP}</div></div>
    <div style="position: relative; display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 24px; padding: 18px 18px 16px; box-shadow: 0 6px 22px rgba(20,17,43,0.10);">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1;">معنی</span>
        <a href="Poem.dc.html" aria-label="بستن معنی" style="width: 32px; height: 32px; border-radius: 50%; background: #F1EFEA; display: flex; align-items: center; justify-content: center; color: #14112B;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
      </div>
      <div style="font-size: 15px; line-height: 1.95;">ساقی، شرابِ باقی‌مونده رو بده، چون توی بهشت هم کنارِ آبِ رکن‌آباد و گردش‌گاهِ مصلا رو پیدا نمی‌کنی.</div>
      <a href="#" style="align-self: flex-start; text-decoration: none; font-size: 13px; font-weight: 700; color: #2F35F5;">بیشتر بخون</a>
    </div>
    {actions}
  </div>
'''
open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(focus_page("خوندن غزل", focus_mid))
open(os.path.join(P, "PoemMeaning.dc.html"), "w", encoding="utf-8").write(focus_page("معنی بیت", meaning_mid))
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["PoemMeaning.dc.html"] = {"x": 1880, "y": 2928, "w": 390, "h": 844, "title": "۱۲ب · معنی بیت", "page": "sticker"}
if "PoemMeaning.dc.html" not in d["order"]:
    d["order"].append("PoemMeaning.dc.html")
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v4")

# ---------------- Text settings sheet ----------------
fonts = [("پرستو", "'Parastoo', serif", True), ("نسخ", "'Noto Naskh Arabic', serif", False), ("نستعلیق", "'Noto Nastaliq Urdu', serif", False), ("گندم", "'Gandom', serif", False), ("مرکزی", "'Markazi Text', serif", False), ("شبنم", "'Shabnam', sans-serif", False), ("ساحل", "'Sahel', sans-serif", False), ("وزیر", "'Vazirmatn', sans-serif", False)]
font_cards = "".join(f'''<a href="#" aria-pressed="{"true" if sel else "false"}" style="text-decoration: none; color: #14112B; flex: 0 0 76px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #FFFFFF; border: 3px solid {"#2F35F5" if sel else "#EEEBF2"}; border-radius: 16px; padding: 8px 4px 6px;"><span style="font-family: {fam}; font-size: 22px; line-height: 1.7;">بیت</span><span style="font-size: 11px; font-weight: {700 if sel else 500}; color: {"#2F35F5" if sel else "#4A4660"};">{n}</span></a>''' for n, fam, sel in fonts)
def opt3(label, items, sel):
    b = "".join(f'<button aria-pressed="{"true" if i == sel else "false"}" style="flex: 1; height: 40px; border: none; border-radius: 12px; background: {"#2F35F5" if i == sel else "transparent"}; color: {"#FFFFFF" if i == sel else "#14112B"}; font-family: \'Vazirmatn\', sans-serif; font-size: 13px; font-weight: {700 if i == sel else 500}; cursor: pointer;">{it}</button>' for i, it in enumerate(items))
    return f'''<div style="display: flex; flex-direction: column; gap: 8px;"><div style="font-size: 13px; font-weight: 700; color: #4A4660;">{label}</div><div role="group" aria-label="{label}" style="display: flex; gap: 4px; background: #F1EFEA; border-radius: 14px; padding: 4px;">{b}</div></div>'''
themes = "".join(f'''<a href="#" aria-label="{n}" aria-pressed="{"true" if sel else "false"}" style="text-decoration: none; color: #14112B; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; font-weight: {700 if sel else 500};"><span style="width: 44px; height: 44px; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 3px solid {"#2F35F5" if sel else "#DAD6E2"}; display: flex; align-items: center; justify-content: center; font-family: 'Parastoo', serif; font-size: 16px; color: {fg};">آ</span>{n}</a>''' for n, bg, fg, sel in [("روشن", "#FFFFFF", "#14112B", False), ("کاغذی", "#F7F5F0", "#14112B", True), ("تیره", "#14112B", "#F7F5F0", False)])
head_fonts = HEAD.format(title="تنظیم متن").replace("family=Noto+Naskh+Arabic:wght@400;500;600", "family=Noto+Naskh+Arabic:wght@400;500;600&amp;family=Noto+Nastaliq+Urdu&amp;family=Markazi+Text")
textpage = head_fonts + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header}
  <div style="position: absolute; top: 150px; right: 40px; left: 40px; font-family: 'Parastoo', serif; font-size: 30px; line-height: 2; text-align: center;"><div>{B9[1][0]}</div><div>{B9[1][1]}</div></div>

  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.12);"></div>

  <section aria-label="تنظیم متن" style="position: absolute; right: 0; left: 0; bottom: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 30px 30px 0 0; padding: 12px 20px 30px; box-shadow: 0 -6px 24px rgba(20,17,43,0.16); display: flex; flex-direction: column; gap: 18px;">
    <div aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DAD6E2;"></div>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1;">متن</span>
      <a href="Poem.dc.html" style="text-decoration: none; font-size: 14px; font-weight: 700; color: #2F35F5;">تمام</a>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: #4A4660;">اندازه</div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-family: 'Parastoo', serif; font-size: 15px;">آ</span>
        <div role="slider" aria-label="اندازه‌ی حروف" aria-valuemin="1" aria-valuemax="5" aria-valuenow="4" style="position: relative; flex-grow: 1; height: 6px; border-radius: 3px; background: #E6E3EC;">
          <span style="position: absolute; top: 0; bottom: 0; right: 0; width: 72%; border-radius: 3px; background: #2F35F5;"></span>
          {''.join(f'<span style="position: absolute; top: 50%; right: {k*25}%; width: 6px; height: 6px; margin: -3px -3px 0 0; border-radius: 50%; background: #FFFFFF;"></span>' for k in range(1,4))}
          <span style="position: absolute; top: 50%; right: 72%; width: 24px; height: 24px; margin: -12px -12px 0 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; border: 4px solid #2F35F5; box-shadow: 0 2px 6px rgba(20,17,43,0.25);"></span>
        </div>
        <span style="font-family: 'Parastoo', serif; font-size: 26px;">آ</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: #4A4660;">قلم</div>
      <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">{font_cards}</div>
    </div>

    {opt3("فاصله‌ی خط‌ها", ["کم", "معمولی", "زیاد"], 2)}

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: #4A4660;">زمینه</div>
      <div style="display: flex; gap: 8px;">{themes}</div>
    </div>
  </section>

</div>
''' + TAIL
open(os.path.join(P, "PoemText.dc.html"), "w", encoding="utf-8").write(textpage)
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["PoemText.dc.html"] = {"x": 2350, "y": 2928, "w": 390, "h": 844, "title": "۱۲ج · تنظیم متن (آ)", "page": "sticker"}
if "PoemText.dc.html" not in d["order"]:
    d["order"].append("PoemText.dc.html")
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("text")

# ---------------- v5: no big player; mini player + play per couplet ----------------
CTRL_SVG = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="currentColor"></circle></svg>'
header5 = header.replace('''    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف"''', f'''    <a href="JigsawE.dc.html" aria-label="بازی با این غزل" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: #2F35F5; display: flex; align-items: center; justify-content: center;">{CTRL_SVG}</a>
    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف"''')
play_btn = '<a href="#" aria-label="از این بیت بخون" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: #E8E9FF; color: #2F35F5;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="currentColor"></path></svg></a>'
actions5 = f'''<div style="display: flex; align-items: center; justify-content: center; gap: 14px;">{play_btn}{act("پسند", heart_f, "۱۲", True)}{act("بازنشر", rep)}{act("بفرست", ic("send", 21))}{act("نگه دار", ic("save", 21))}</div>'''
mini = '''  <div role="region" aria-label="در حال پخش" style="position: absolute; right: 16px; left: 16px; bottom: 24px; display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 22px; padding: 10px 12px 12px; box-shadow: 0 4px 16px rgba(20,17,43,0.14);">
    <div style="display: flex; align-items: center; gap: 10px;">
      <a href="#" aria-label="مکث" style="width: 40px; height: 40px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; display: flex; align-items: center; justify-content: center; gap: 4px;"><span style="width: 4px; height: 14px; border-radius: 2px; background: #FFFFFF;"></span><span style="width: 4px; height: 14px; border-radius: 2px; background: #FFFFFF;"></span></a>
      <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
        <span style="font-size: 13px; font-weight: 700;">در حال خوندن · بیت ۲ از ۹</span>
        <span style="font-size: 12px; color: #4A4660;">با صدای [نام گوینده]</span>
      </div>
      <a href="#" aria-label="بستن پخش" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; background: #F1EFEA; display: flex; align-items: center; justify-content: center; color: #14112B;"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg></a>
    </div>
    <div role="progressbar" aria-label="پیشرفت خوندن" aria-valuemin="0" aria-valuemax="100" aria-valuenow="22" style="height: 4px; border-radius: 2px; background: #E6E3EC; position: relative;"><span style="position: absolute; top: 0; bottom: 0; right: 0; width: 22%; border-radius: 2px; background: #FFB703;"></span></div>
  </div>
'''
def focus_page5(title, mid):
    return HEAD.format(title=title) + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header5}{vprog(1)}{mid}{mini}</div>
''' + TAIL
fm5 = focus_mid.replace(actions, actions5)
mm5 = meaning_mid.replace(actions, actions5)
open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(focus_page5("خوندن غزل", fm5))
open(os.path.join(P, "PoemMeaning.dc.html"), "w", encoding="utf-8").write(focus_page5("معنی بیت", mm5))
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["Player.dc.html"].update({"page": "explore", "x": 2350, "y": 1964, "title": "۱۳ · پخش‌کننده‌ی بزرگ (حذف شد)"})
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v5")

# ---------------- v6: no player at all; play/pause toggle on the couplet ----------------
pause_btn = '<a href="#" aria-label="مکث" aria-pressed="true" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 3px; width: 34px; height: 34px; border-radius: 50%; background: #2F35F5;"><span style="width: 3.5px; height: 12px; border-radius: 2px; background: #FFFFFF;"></span><span style="width: 3.5px; height: 12px; border-radius: 2px; background: #FFFFFF;"></span></a>'
actions6_playing = actions5.replace(play_btn, pause_btn)
def focus_page6(title, mid):
    return HEAD.format(title=title) + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header5}{vprog(1)}{mid}</div>
''' + TAIL
fm6 = focus_mid.replace(actions, actions6_playing).replace("bottom: 110px;", "bottom: 40px;")
mm6 = meaning_mid.replace(actions, actions5).replace("bottom: 100px;", "bottom: 40px;")
open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(focus_page6("خوندن غزل", fm6))
open(os.path.join(P, "PoemMeaning.dc.html"), "w", encoding="utf-8").write(focus_page6("معنی بیت", mm6))
print("v6")

# ---------------- v7: reading modes (بیت به بیت | کل شعر) ----------------
ALL9 = BEYTS + [
 ("من از آن حسن روزافزون که یوسف داشت دانستم", "که عشق از پرده عصمت برون آرد زلیخا را"),
 ("حدیث از مطرب و می گو و راز دهر کمتر جو", "که کس نگشود و نگشاید به حکمت این معما را"),
 ("نصیحت گوش کن جانا که از جان دوست‌تر دارند", "جوانان سعادتمند پند پیر دانا را"),
 ("بدم گفتی و خرسندم عفاک الله نکو گفتی", "جواب تلخ می‌زیبد لب لعل شکرخا را"),
 ("غزل گفتی و در سفتی بیا و خوش بخوان حافظ", "که بر نظم تو افشاند فلک عقد ثریا را"),
]
def mode_toggle(active, absolute):
    pos = "position: absolute; top: 106px; left: 50%; transform: translateX(-50%);" if absolute else "align-self: center;"
    def b(lbl, href):
        on = lbl == active
        return f'<a href="{href}" aria-current="{"true" if on else "false"}" style="text-decoration: none; font-size: 13px; font-weight: {700 if on else 500}; color: {"#FFFFFF" if on else "#14112B"}; background: {"#2F35F5" if on else "transparent"}; border-radius: 999px; padding: 6px 14px;">{lbl}</a>'
    return f'  <div role="group" aria-label="حالت خوندن" style="{pos} display: flex; gap: 2px; background: #FFFFFF; border-radius: 999px; padding: 3px; box-shadow: 0 2px 8px rgba(20,17,43,0.08); white-space: nowrap;">{b("بیت به بیت", "Poem.dc.html")}{b("کل شعر", "PoemScroll.dc.html")}</div>\n'

fm7 = fm6.replace("top: 120px; bottom: 40px;", "top: 156px; bottom: 40px;")
open(os.path.join(P, "Poem.dc.html"), "w", encoding="utf-8").write(HEAD.format(title="خوندن غزل") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; overflow: hidden;">
{header5}{mode_toggle("بیت به بیت", True)}{vprog(1)}{fm7}</div>
''' + TAIL)

nums = "۱۲۳۴۵۶۷۸۹"
items = ""
for i, (a, b) in enumerate(ALL9[:6]):
    if i == 1:
        items += f'''    <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 22px; padding: 14px 14px 8px; box-shadow: 0 4px 16px rgba(20,17,43,0.08);">
      <div style="font-family: 'Parastoo', serif; font-size: 21px; line-height: 1.95; text-align: center;"><div>{a}</div><div>{b}</div></div>
      {actions5}
    </div>
'''
    else:
        items += f'''    <a href="#" style="text-decoration: none; color: #14112B; position: relative; display: block; font-family: 'Parastoo', serif; font-size: 21px; line-height: 1.95; text-align: center; padding: 4px 22px;"><span aria-hidden="true" style="position: absolute; top: 10px; right: 0; font-family: 'Vazirmatn', sans-serif; font-size: 11px; color: #9C98B3;">{nums[i]}</span><div>{a}</div><div>{b}</div></a>
'''
scroll = HEAD.format(title="کل شعر") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
{header5}{mode_toggle("کل شعر", False)}
  <div style="display: flex; flex-direction: column; gap: 12px; -webkit-mask-image: linear-gradient(180deg, #000 85%, transparent 100%); mask-image: linear-gradient(180deg, #000 85%, transparent 100%);">
{items}  </div>
  <div aria-hidden="true" style="position: absolute; left: 6px; top: 160px; width: 4px; height: 120px; border-radius: 2px; background: #DAD6E2;"><span style="display: block; width: 4px; height: 34px; border-radius: 2px; background: #2F35F5;"></span></div>
</div>
''' + TAIL
open(os.path.join(P, "PoemScroll.dc.html"), "w", encoding="utf-8").write(scroll)
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["PoemScroll.dc.html"] = {"x": 1410, "y": 2928, "w": 390, "h": 844, "title": "۱۲د · کل شعر (اسکرول)", "page": "sticker"}
if "PoemScroll.dc.html" not in d["order"]:
    d["order"].append("PoemScroll.dc.html")
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v7")

# ---------------- v8: cleaner whole-poem view ----------------
items8 = "".join(f'''    <a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 2px; font-family: 'Parastoo', serif; font-size: 20px; line-height: 1.9;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>
''' for a, b in ALL9)
scroll8 = HEAD.format(title="کل شعر") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background: #F7F5F0; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 18px; overflow: hidden;">
{header5}{mode_toggle("کل شعر", False)}
  <div style="display: flex; flex-direction: column; gap: 22px; padding: 8px 10px 0; -webkit-mask-image: linear-gradient(180deg, #000 88%, transparent 100%); mask-image: linear-gradient(180deg, #000 88%, transparent 100%);">
{items8}  </div>
</div>
''' + TAIL
open(os.path.join(P, "PoemScroll.dc.html"), "w", encoding="utf-8").write(scroll8)
print("v8")

# ---------------- v9: whole poem with identity (hero + paper sheet + beyt marks) ----------------
HAFEZ_W = "/_blob/05993349bc76fc57449fc1f70208d3f4"
mark = '<div aria-hidden="true" style="display: flex; justify-content: center; gap: 3px; padding: 2px 0;"><span style="width: 7px; height: 10px; border-radius: 2px; background: #2F35F5;"></span><span style="width: 7px; height: 10px; border-radius: 2px; background: #FF4D24;"></span></div>'
body9 = f"\n      {mark}\n".join(f'''      <a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; font-family: 'Parastoo', serif; font-size: 19px; line-height: 1.9;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>''' for a, b in ALL9)
def pillbtn(label, inner, bg="#F1EFEA", col="#14112B"):
    return f'<a href="#" aria-label="{label}" style="width: 44px; height: 44px; border-radius: 50%; background: {bg}; color: {col}; display: flex; align-items: center; justify-content: center;">{inner}</a>'
bar9 = f'''  <div style="position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: #FFFFFF; border-radius: 999px; padding: 6px; box-shadow: 0 4px 16px rgba(20,17,43,0.16);">
    <a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; border-radius: 999px; background: #2F35F5; color: #FFFFFF; padding: 0 18px 0 16px; font-size: 14px; font-weight: 700; white-space: nowrap;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="#FFFFFF"></path></svg>بخون برام</a>
    {pillbtn("نگه دار", ic("save", 20))}
    {pillbtn("بفرست", ic("send", 20))}
    {pillbtn("بازی با این غزل", CTRL_SVG, "#E8E9FF", "#2F35F5")}
  </div>
'''
hero9 = f'''  <div style="display: flex; align-items: center; gap: 14px; padding: 2px 4px;">
    <span aria-hidden="true" style="width: 64px; height: 64px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 4px solid #FFFFFF; box-shadow: 0 3px 10px rgba(20,17,43,0.2); overflow: hidden;"><img src="{HAFEZ_W}" alt="" style="width: 100%; height: 100%; display: block;"></span>
    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1;">غزل ۳ · حافظ</div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <span style="background: #FFFFFF; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 500;">۹ بیت</span>
        <span style="background: #FFFFFF; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 500;">۲ دقیقه</span>
        <span style="background: #E8E9FF; color: #2F35F5; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700;">با خوانش</span>
      </div>
    </div>
  </div>
'''
header9 = f'''  <div style="display: flex; align-items: center; justify-content: space-between;">
    {roundbtn("بستن", ic("down", 22, "#14112B", 2.6), bg="#FFFFFF", color="#14112B", href="Poet.dc.html")}
{mode_toggle("کل شعر", False).replace("align-self: center; ", "")}    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: #14112B; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 18px; padding-top: 3px;">آ</a>
  </div>
'''
scroll9 = HEAD.format(title="کل شعر") + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 16px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
{header9}{hero9}
  <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 28px 28px 0 0; padding: 26px 22px 120px; box-shadow: 0 -2px 16px rgba(20,17,43,0.06); flex-grow: 1;">
{body9}
  </div>
{bar9}</div>
''' + TAIL
open(os.path.join(P, "PoemScroll.dc.html"), "w", encoding="utf-8").write(scroll9)
print("v9")

# ---------------- v10: three alternatives for the whole-poem view ----------------
def shell(title, bg, body, color="#14112B"):
    return HEAD.format(title=title) + f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 16px 0; {bg} color: {color}; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
{body}</div>
''' + TAIL
def topbar(dark=False):
    btn_bg = "rgba(255,255,255,0.16)" if dark else "#FFFFFF"
    col = "#FFFFFF" if dark else "#14112B"
    tg = mode_toggle("کل شعر", False).replace("align-self: center; ", "")
    if dark:
        tg = tg.replace("background: #FFFFFF; border-radius: 999px; padding: 3px;", "background: rgba(255,255,255,0.14); border-radius: 999px; padding: 3px;").replace("color: #14112B; background: transparent", "color: #FFFFFF; background: transparent").replace("color: #FFFFFF; background: #2F35F5", "color: #2F35F5; background: #FFFFFF")
    return f'''  <div style="display: flex; align-items: center; justify-content: space-between;">
    {roundbtn("بستن", ic("down", 22, col, 2.6), bg=btn_bg, color=col, href="Poet.dc.html")}
{tg}    <a href="PoemText.dc.html" aria-label="اندازه‌ی حروف" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {btn_bg}; color: {col}; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 18px; padding-top: 3px;">آ</a>
  </div>
'''
fade = "-webkit-mask-image: linear-gradient(180deg, #000 86%, transparent 100%); mask-image: linear-gradient(180deg, #000 86%, transparent 100%);"

# A: each couplet is its own sticker card
ca = "".join(f'''    <a href="#" style="text-decoration: none; color: #14112B; position: relative; display: flex; flex-direction: column; background: #FFFFFF; border-radius: 22px; padding: 16px 18px 14px; box-shadow: 0 3px 10px rgba(20,17,43,0.10); font-family: 'Parastoo', serif; font-size: 19px; line-height: 1.9;">
      <span aria-hidden="true" style="position: absolute; top: -9px; left: 14px; min-width: 26px; height: 26px; box-sizing: border-box; border-radius: 50%; background: {["#2F35F5","#FF4D24","#FFB703","#6CCB3A","#FF3D8B"][i%5]}; color: {"#14112B" if i%5 in (2,3) else "#FFFFFF"}; border: 3px solid #FFFFFF; font-family: 'Lalezar', sans-serif; font-size: 13px; display: flex; align-items: center; justify-content: center; padding-top: 2px; transform: rotate({[-8,6,-5,7,-6][i%5]}deg); box-shadow: 0 2px 5px rgba(20,17,43,0.2); pointer-events: none;">{"۱۲۳۴۵۶۷۸۹"[i]}</span>
      <span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span>
    </a>
''' for i, (a, b) in enumerate(ALL9[:6]))
A = shell("کل شعر · کارتی", "background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px;",
  topbar() + f'''  <div style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1; padding: 0 4px;">غزل ۳ <span style="font-family: 'Vazirmatn', sans-serif; font-size: 14px; font-weight: 500; color: #4A4660;">حافظ · ۹ بیت</span></div>
  <div style="display: flex; flex-direction: column; gap: 16px; padding-top: 6px; {fade}">
{ca}  </div>
''')

# B: immersive lapis
cb = "\n".join(f'''    <a href="#" style="text-decoration: none; color: #FFFFFF; display: flex; flex-direction: column; font-family: 'Parastoo', serif; font-size: 22px; line-height: 1.9;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>
    <div aria-hidden="true" style="align-self: center; display: flex; gap: 3px;"><span style="width: 6px; height: 9px; border-radius: 2px; background: #FFB703;"></span><span style="width: 6px; height: 9px; border-radius: 2px; background: #FF4D24;"></span></div>''' for a, b in ALL9[:5])
B = shell("کل شعر · لاجوردی", "background-color: #2F35F5; background-image: radial-gradient(rgba(255,255,255,0.10) 1.2px, transparent 1.2px); background-size: 18px 18px;",
  topbar(True) + f'''  <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0 4px;">
    <span aria-hidden="true" style="width: 58px; height: 58px; box-sizing: border-box; border-radius: 50%; background: #1C20B8; border: 4px solid #FFFFFF; overflow: hidden;"><img src="{HAFEZ_W}" alt="" style="width: 100%; height: 100%; display: block;"></span>
    <div style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1.2;">غزل ۳</div>
    <div style="font-size: 13px; color: #D6D8FF;">حافظ · ۹ بیت</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 14px; padding: 0 8px; {fade}">
{cb}
  </div>
''', color="#FFFFFF")

# C: divan page, misras side by side
cc = "".join(f'''      <a href="#" style="text-decoration: none; color: #14112B; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 14px; font-family: 'Parastoo', serif; font-size: 14.5px; line-height: 1.8; padding: 9px 0;{'' if i == len(ALL9) - 1 else ' border-bottom: 1px dashed #E6E1D6;'}"><span style="text-align: justify; text-align-last: justify;">{a}</span><span style="text-align: justify; text-align-last: justify;">{b}</span></a>
''' for i, (a, b) in enumerate(ALL9))
C = shell("کل شعر · دیوانی", "background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px;",
  topbar() + f'''  <div style="position: relative; display: flex; flex-direction: column; background: #FFFDF8; border-radius: 22px; padding: 20px 18px 18px; box-shadow: 0 4px 16px rgba(20,17,43,0.10);">
    <span aria-hidden="true" style="position: absolute; top: -12px; left: 18px; background: #FF3D8B; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 2px 11px 0; font-family: 'Lalezar', sans-serif; font-size: 14px; transform: rotate(-6deg); box-shadow: 0 2px 6px rgba(20,17,43,0.2); pointer-events: none;">حافظ</span>
    <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 2px solid #2F35F5;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1;">غزل ۳</span>
      <span style="font-size: 12px; color: #4A4660;">دیوان · ۹ بیت</span>
    </div>
{cc}  </div>
  <div style="display: flex; justify-content: center; gap: 10px;">
    <a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; border-radius: 999px; padding: 8px 16px; box-shadow: 0 3px 10px rgba(20,17,43,0.2); font-size: 14px; font-weight: 700;"><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="#FFFFFF"></path></svg>بخون برام</a>
  </div>
''')
for k, html in [("PoemScrollA.dc.html", A), ("PoemScrollB.dc.html", B), ("PoemScrollC.dc.html", C)]:
    open(os.path.join(P, k), "w", encoding="utf-8").write(html)
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
for k, x, t in [("PoemScrollA.dc.html", 940, "۱۲د-الف · کل شعر: هر بیت یه کارت"), ("PoemScrollB.dc.html", 1410, "۱۲د-ب · کل شعر: لاجوردی"), ("PoemScrollC.dc.html", 1880, "۱۲د-ج · کل شعر: صفحه‌ی دیوان")]:
    d["boards"][k] = {"x": x, "y": 3892, "w": 390, "h": 844, "title": t, "page": "sticker"}
    if k not in d["order"]:
        d["order"].append(k)
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("v10")
