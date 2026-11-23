import json, os, sys
P = sys.argv[1]

def page(title, body, fonts_naskh=True):
    fam = "family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700" + ("&amp;family=Noto+Naskh+Arabic:wght@400;500" if fonts_naskh else "")
    return f'''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?{fam}&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:#2F35F5}}a:hover{{color:#14112B}}
</style>
</helmet>
<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 18px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":844}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''

ICONS = {
 "خونه": '<path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z"></path>',
 "بازی": '<rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="currentColor"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="currentColor"></circle>',
 "کاوش": '<circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path>',
 "پیام‌ها": '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>',
}
HREF = {"خونه": "Calm.dc.html", "بازی": "GamesE.dc.html", "کاوش": "Explore.dc.html", "پیام‌ها": "Inbox.dc.html", "من": "Profile.dc.html"}

def _avatar_svg(tag):
    import re as _re
    src = open(os.path.join(P, "Avatar.dc.html"), encoding="utf-8").read()
    sv = _re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', src, flags=_re.S).group(0)
    return sv.replace('role="img" aria-label="چهره‌ی تو: موی کوتاه، لبخند، با نیِ مولانا"', 'aria-hidden="true"').replace('width="196" height="196"', 'width="100%" height="100%"').replace('id="av"', f'id="{tag}"').replace('url(#av)', f'url(#{tag})')

def nav(active):
    def label(name, on):
        bar = '<span aria-hidden="true" style="width: 16px; height: 3px; border-radius: 2px; background: #2F35F5;"></span>' if on else '<span aria-hidden="true" style="width: 16px; height: 3px;"></span>'
        return f'<span style="font-size: 11px; font-weight: {700 if on else 500};">{name}</span>{bar}'
    def item(name):
        on = name == active
        cur = ' aria-current="page"' if on else ''
        col = "#2F35F5" if on else "#4A4660"
        if name == "بازی":
            circ = ("background: #2F35F5; border: 4px solid #FFFFFF; color: #FFFFFF; box-shadow: 0 3px 10px rgba(20,17,43,0.25);" if on
                    else "background: #FFFFFF; border: 3px solid #C9CBF5; color: #2F35F5; box-shadow: 0 2px 6px rgba(20,17,43,0.12);")
            icon = f'<span style="width: 56px; height: 56px; box-sizing: border-box; border-radius: 50%; {circ} display: flex; align-items: center; justify-content: center; margin-top: -30px;"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg></span>'
        elif name == "من":
            ring = "box-shadow: 0 0 0 2.5px #2F35F5;" if on else "box-shadow: 0 0 0 1.5px #DAD6E2;"
            icon = f'<span style="width: 26px; height: 26px; border-radius: 50%; overflow: hidden; display: block; border: 2px solid #FFFFFF; {ring}">{_avatar_svg("avn")}</span>'
        else:
            fill = 'currentColor' if on and name in ("خونه", "پیام‌ها") else ('rgba(47,53,245,0.18)' if on else 'none')
            icon = f'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="{fill}" stroke="currentColor" stroke-width="{2.4 if on else 2}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>'
            if name == "پیام‌ها":
                icon = f'<span style="position: relative; display: flex;">{icon}<span aria-label="۲ پیام نخونده" style="position: absolute; top: -6px; left: -9px; min-width: 18px; height: 18px; box-sizing: border-box; border-radius: 9px; background: #FF4D24; border: 2px solid #FFFFFF; color: #FFFFFF; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;">۲</span></span>'
        return f'''    <a href="{HREF[name]}"{cur} style="text-decoration: none; color: {col}; display: flex; flex-direction: column; align-items: center; gap: 3px;">
      {icon}
      {label(name, on)}
    </a>
'''
    return ('  <nav aria-label="تب‌ها" style="position: absolute; right: 14px; left: 14px; bottom: 18px; height: 70px; box-sizing: border-box; background: #FFFFFF; border-radius: 26px; box-shadow: 0 4px 16px rgba(20,17,43,0.16); display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); align-items: center; padding-top: 6px;">\n'
            + item("خونه") + item("کاوش") + item("بازی") + item("پیام‌ها") + item("من") + '  </nav>')

def AVBTN(tag):
    import re as _re
    src = open(os.path.join(P, "Avatar.dc.html"), encoding="utf-8").read()
    sv = _re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', src, flags=_re.S).group(0)
    sv = sv.replace('role="img" aria-label="چهره‌ی تو: موی کوتاه، لبخند، با نیِ مولانا"', 'aria-hidden="true"').replace('width="196" height="196"', 'width="100%" height="100%"').replace('id="av"', f'id="{tag}"').replace('url(#av)', f'url(#{tag})')
    return f'<a href="Profile.dc.html" aria-label="صفحه‌ی من" style="width: 46px; height: 46px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; padding: 2px; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: block;">{sv}</a>'

BACK = lambda href: f'''<a href="{href}" aria-label="برگشت" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; color: #14112B;">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"></path></svg>
    </a>'''

# ---------- Explore ----------
chips = "".join(f'<a href="#" style="text-decoration: none; white-space: nowrap; font-size: 13px; font-weight: 500; color: #14112B; background: #FFFFFF; border-radius: 999px; padding: 6px 13px; box-shadow: 0 2px 6px rgba(20,17,43,0.10);">{c}</a>' for c in ["عشق", "دلتنگی", "امید", "بهار", "جوونی", "دوستی"])
IMG = {"حافظ": "/_blob/05993349bc76fc57449fc1f70208d3f4", "سعدی": "/_blob/edaf69952e782a1782b62dd0cfff59d8", "مولانا": "/_blob/2a4c917d315ec35f181197f163478728", "فردوسی": "/_blob/abb1f80c2ef9f9788c4c129e6f528eab", "خیام": "/_blob/9d8e9b659748d432ee291ddec65a3909", "فروغ": "/_blob/44edbbc3105b023278f424a6f8a15f7e", "سهراب": "/_blob/f75bd8401ea05cc70c966c1c693634c7", "نیما": "/_blob/d5d7bdaf204c62baaaf4cd02e8554da3"}
poets = [("حافظ", "#2F35F5", "Poet.dc.html"), ("سعدی", "#E8431C", "#"), ("مولانا", "#14112B", "#"), ("فردوسی", "#3E9A1E", "#"), ("خیام", "#E0307A", "#"), ("فروغ", "#2F35F5", "#"), ("سهراب", "#3E9A1E", "#"), ("نیما", "#E8431C", "#")]
poet_row = "".join(f'''      <a href="{h}" style="text-decoration: none; color: #14112B; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; font-weight: 700;">
        <span style="width: 70px; height: 70px; box-sizing: border-box; border-radius: 50%; background: {c}; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.22); overflow: hidden; display: block;"><img src="{IMG[n]}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1);"></span>
        {n}
      </a>
''' for n, c, h in poets)
books = [("دیوان حافظ", "حافظ", "#2F35F5", "#FFFFFF"), ("گلستان", "سعدی", "#FF4D24", "#FFFFFF"), ("مثنوی معنوی", "مولانا", "#FFB703", "#14112B"), ("شاهنامه", "فردوسی", "#6CCB3A", "#14112B"), ("رباعیات", "خیام", "#FF3D8B", "#FFFFFF"), ("بوستان", "سعدی", "#14112B", "#FFFFFF")]
BOOKN = [0]
def book(t, p, bg, fg, ribbon):
    BOOKN[0] += 1
    pid = f"pg{BOOKN[0]}"
    orn = "rgba(255,255,255,0.55)"
    rib = f'<path d="M30 140 v16 l5 -4 l5 4 v-16z" fill="{ribbon}"></path>' if ribbon else ""
    return f'''      <a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 6px; min-width: 0;">
        <svg aria-hidden="true" width="100%" viewBox="0 0 112 158" style="display: block; overflow: visible;">
          <defs><pattern id="{pid}" width="3" height="4" patternUnits="userSpaceOnUse"><rect width="3" height="4" fill="#FBF8F1"></rect><rect x="2" width="1" height="4" fill="#E2DCCF"></rect></pattern></defs>
          <ellipse cx="58" cy="151" rx="50" ry="5" fill="rgba(20,17,43,0.16)"></ellipse>
          <path d="M2 12 L14 5 L14 147 L2 141 Z" fill="url(#{pid})"></path>
          <rect x="12" y="3" width="98" height="146" rx="4" fill="{bg}"></rect>
          <rect x="94" y="3" width="16" height="146" rx="4" fill="rgba(0,0,0,0.2)"></rect>
          <rect x="91" y="3" width="1.6" height="146" fill="rgba(255,255,255,0.35)"></rect>
          <path d="M52 56 C64 66 64 86 52 96 C40 86 40 66 52 56 Z" fill="none" stroke="{orn}" stroke-width="2.4"></path>
          {rib}
        </svg>
        <span style="font-family: 'Lalezar', sans-serif; font-size: 16px; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{t}</span>
        <span style="font-size: 12px; color: #4A4660; margin-top: -4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{p}</span>
      </a>
'''

def book_old(t, p, bg, fg, ribbon):
    rib = f'<span aria-hidden="true" style="position: absolute; bottom: -10px; left: 20px; width: 9px; height: 22px; background: {ribbon}; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%);"></span>' if ribbon else ""
    return f'''      <a href="#" aria-label="{t}، {p}" style="text-decoration: none; color: #14112B; position: relative; display: block; height: 136px; filter: drop-shadow(0 4px 6px rgba(20,17,43,0.18));">
        <span aria-hidden="true" style="position: absolute; top: 7px; left: 0; right: 10px; bottom: 0; border-radius: 4px 6px 6px 4px; background: repeating-linear-gradient(180deg, #FBF8F1 0px, #FBF8F1 2px, #E2DCCF 2px, #E2DCCF 3px);"></span>
        <span style="position: absolute; top: 0; left: 6px; right: 0; bottom: 8px; border-radius: 6px 4px 4px 6px; background: {bg}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <span aria-hidden="true" style="position: absolute; top: 0; bottom: 0; right: 0; width: 13px; background: rgba(0,0,0,0.18);"></span>
          <span aria-hidden="true" style="position: absolute; top: 0; bottom: 0; right: 13px; width: 2px; background: rgba(255,255,255,0.35);"></span>
          <span aria-hidden="true" style="position: absolute; top: 10px; right: 20px; left: 8px; height: 2px; background: rgba(255,255,255,0.45);"></span>
          <span aria-hidden="true" style="position: absolute; bottom: 10px; right: 20px; left: 8px; height: 2px; background: rgba(255,255,255,0.45);"></span>
          <span style="display: flex; flex-direction: column; align-items: center; gap: 1px; background: #FFFFFF; border-radius: 8px; padding: 6px 8px 5px; margin-right: 12px; min-width: 64px; box-sizing: border-box;">
            <span style="font-family: 'Lalezar', sans-serif; font-size: 18px; line-height: 1.1;">{t}</span>
            <span style="font-size: 11px; font-weight: 500; color: #4A4660;">{p}</span>
          </span>
        </span>
        {rib}
      </a>
'''
ribbons = ["#FF3D8B", None, "#2F35F5"]
book_grid = "".join(book(t, p, bg, fg, ribbons[i]) for i, (t, p, bg, fg) in enumerate(books[:3]))
explore = f'''
  <h1 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 40px; line-height: 1.05;">کاوش</h1>

  <label style="display: flex; align-items: center; gap: 10px; height: 50px; box-sizing: border-box; background: #FFFFFF; border-radius: 999px; padding: 0 16px; box-shadow: 0 2px 10px rgba(20,17,43,0.12);">
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A4660" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>
    <span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">جستجو</span>
    <input type="search" placeholder="شاعر، شعر یا یه تیکه از بیت…" style="border: none; outline: none; background: transparent; font-family: 'Vazirmatn', sans-serif; font-size: 15px; width: 100%; color: #14112B;">
  </label>

  <a href="#" style="text-decoration: none; color: #FFFFFF; position: relative; display: flex; align-items: center; gap: 14px; background: #2F35F5; border: 5px solid #FFFFFF; border-radius: 26px; padding: 14px 16px; box-shadow: 0 4px 14px rgba(20,17,43,0.20);">
    <span aria-hidden="true" style="width: 54px; height: 54px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFB703; border: 4px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.25); transform: rotate(-8deg); display: flex; align-items: center; justify-content: center;"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path></svg></span>
    <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 24px; line-height: 1.1;">فال حافظ</span>
      <span style="font-size: 13px; color: #D6D8FF;">یه نیت کن، دیوان رو باز کن</span>
    </div>
    <span style="flex-shrink: 0; font-family: 'Lalezar', sans-serif; font-size: 17px; background: #FFFFFF; color: #2F35F5; border-radius: 14px; padding: 8px 14px 4px;">باز کن</span>
  </a>

  <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px;">{chips}</div>

  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
    <h2 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 22px;">شاعرها</h2>
    <a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه</a>
  </div>
  <div style="display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 4px;">
{poet_row}  </div>

  <div style="display: flex; align-items: center; justify-content: space-between;">
    <h2 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 22px;">کتابخونه</h2>
    <a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه‌ی کتاب‌ها</a>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
{book_grid}  </div>

  <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px;">
    <a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 4px; background: #FFFFFF; border-radius: 22px; padding: 12px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.10);">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.2;">پرطرفدارها</span>
      <span style="font-size: 12px; color: #4A4660;">بیت‌های محبوب این هفته بین دوستات</span>
    </a>
  </div>

{nav("کاوش")}'''

# ---------- Poet ----------
rows = [("غزلیات", "دیوان"), ("رباعیات", "دیوان"), ("قطعات", "دیوان"), ("مثنویات", "دیوان")]
ghazals = [("۱", "الا یا ایها الساقی ادر کاسا و ناولها"), ("۲", "صلاح کار کجا و من خراب کجا"), ("۳", "اگر آن ترک شیرازی به دست آرد دل ما را")]
gh = "".join(f'''    <a href="{'Poem.dc.html' if n == '۳' else '#'}" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; padding: 12px 0;{'' if n == '۳' else ' border-bottom: 1px solid #EEEBF2;'}">
      <span style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 10px; background: #F1EFEA; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #4A4660;">{n}</span>
      <span style="flex-grow: 1; font-family: 'Noto Naskh Arabic', serif; font-size: 16px; line-height: 1.6;">{t}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B9B4C6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
    </a>
''' for n, t in ghazals)
sections = "".join(f'<a href="#" style="text-decoration: none; color: #14112B; flex: 1; text-align: center; background: #FFFFFF; border-radius: 16px; padding: 10px 4px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(20,17,43,0.10);">{a}</a>' for a, _ in rows)
poet = f'''
  <div style="display: flex; align-items: center; justify-content: space-between;">
    {BACK("Explore.dc.html")}
    <a href="#" style="text-decoration: none; font-size: 14px; font-weight: 700; color: #FFFFFF; background: #2F35F5; border: 3px solid #FFFFFF; border-radius: 999px; padding: 7px 16px; box-shadow: 0 2px 8px rgba(20,17,43,0.22);">دنبال کن</a>
  </div>

  <div style="position: relative; display: flex; flex-direction: column; gap: 6px; background: #2F35F5; color: #FFFFFF; border: 5px solid #FFFFFF; border-radius: 28px; padding: 20px 20px 18px; box-shadow: 0 4px 14px rgba(20,17,43,0.22);">
    <span aria-hidden="true" style="position: absolute; top: -14px; right: 18px; background: #FFB703; color: #14112B; border: 3px solid #FFFFFF; border-radius: 999px; padding: 3px 11px; font-family: 'Lalezar', sans-serif; font-size: 15px; padding-top: 5px; box-shadow: 0 2px 6px rgba(20,17,43,0.22); transform: rotate(6deg); pointer-events: none;">شاعرِ غزل</span>
    <span aria-hidden="true" style="position: absolute; top: 16px; left: 16px; width: 96px; height: 96px; box-sizing: border-box; border-radius: 50%; background: #1C20B8; border: 4px solid #FFFFFF; box-shadow: 0 3px 10px rgba(10,10,60,0.30); overflow: hidden;"><img src="/_blob/05993349bc76fc57449fc1f70208d3f4" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block; transform: scale(1);"></span>
    <div style="font-family: 'Lalezar', sans-serif; font-size: 64px; line-height: 1; padding-top: 8px;">حافظ</div>
    <div style="font-size: 14px; color: #D6D8FF;">شیراز · قرن هشتم</div>
    <div style="font-size: 14px; line-height: 1.8; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">شمس‌الدین محمد حافظ شیرازی یکی از بزرگ‌ترین غزل‌سراهای زبان فارسیه. توی شیراز به دنیا اومد و بیشتر عمرش رو همون‌جا گذروند. بهش «لسان‌الغیب» هم می‌گن و دیوانش رو خیلی‌ها برای فال باز می‌کنن. غزل‌هاش پر از ایهام و رندی و عشقه و هر بیتش رو می‌شه چند جور خوند.</div>
    <a href="#" style="align-self: flex-start; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; color: #FFFFFF; font-size: 13px; font-weight: 700; background: rgba(255,255,255,0.18); border-radius: 999px; padding: 4px 12px; margin-top: 2px;">بیشتر بخون<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></a>
  </div>

  <div style="display: flex; gap: 8px;">{sections}</div>

  <a href="JigsawE.dc.html" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; background: #FFB703; border: 5px solid #FFFFFF; border-radius: 22px; padding: 12px 14px; box-shadow: 0 3px 10px rgba(20,17,43,0.18);">
    <span aria-hidden="true" style="width: 42px; height: 42px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="0.7" fill="#FFFFFF"></circle><circle cx="17.5" cy="13.5" r="0.7" fill="#FFFFFF"></circle></svg></span>
    <div style="display: flex; flex-direction: column; flex-grow: 1;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.1;">بازی با بیت‌های حافظ</div>
      <div style="font-size: 12px; font-weight: 500;">یه دورِ ۱۰ سؤالی، فقط از حافظ</div>
    </div>
    <span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; background: #2F35F5; color: #FFFFFF; border-radius: 999px; padding: 7px 12px; font-size: 13px; font-weight: 700;">شروع<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg></span>
  </a>

  <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 22px; padding: 4px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.12);">
    <div style="font-size: 13px; font-weight: 700; color: #2F35F5; padding-top: 10px;">پرخواننده‌ترین غزل‌ها</div>
{gh}  </div>

{nav("کاوش")}'''

# ---------- Poem ----------
beyts = [
 ("اگر آن ترک شیرازی به دست آرد دل ما را", "به خال هندویش بخشم سمرقند و بخارا را", True),
 ("بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را", False),
 ("فغان کاین لولیان شوخ شیرین کار شهرآشوب", "چنان بردند صبر از دل که ترکان خوان یغما را", False),
]
bhtml = ""
for i, (a, b, sel) in enumerate(beyts):
    if sel:
        bhtml += f'''  <div style="position: relative; display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border: 4px solid #2F35F5; border-radius: 22px; padding: 14px 16px 12px; box-shadow: 0 4px 14px rgba(20,17,43,0.16);">
    <div style="font-family: 'Noto Naskh Arabic', serif; font-size: 20px; line-height: 1.8; text-align: center;"><div>{a}</div><div>{b}</div></div>
    <div style="background: #F1EFEA; border-radius: 14px; padding: 8px 12px; font-size: 13px; line-height: 1.8;"><span style="font-weight: 700; color: #2F35F5;">معنی: </span>اگه اون زیباروی شیرازی دلم رو به دست بیاره، به‌خاطر خال سیاهش سمرقند و بخارا رو می‌بخشم.</div>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; gap: 14px; align-items: center;">
        <a href="#" aria-label="پسند" style="color: #14112B; display: flex;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path></svg></a>
        <a href="#" aria-label="بفرست" style="color: #14112B; display: flex;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path></svg></a>
        <a href="#" aria-label="نگه دار" style="color: #14112B; display: flex;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg></a>
      </div>
      <a href="JigsawE.dc.html" style="text-decoration: none; font-size: 13px; font-weight: 700; color: #FFFFFF; background: #2F35F5; border-radius: 999px; padding: 6px 12px;">باهاش بازی کن</a>
    </div>
  </div>
'''
    else:
        bhtml += f'''  <div style="font-family: 'Noto Naskh Arabic', serif; font-size: 20px; line-height: 1.8; text-align: center; padding: 4px 8px;"><div>{a}</div><div>{b}</div></div>
'''
poem = f'''
  <div style="display: flex; align-items: center; gap: 10px;">
    {BACK("Poet.dc.html")}
    <div style="display: flex; flex-direction: column; flex-grow: 1;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 24px; line-height: 1.1;">غزل ۳</div>
      <div style="font-size: 12px; color: #4A4660;">حافظ · دیوان · غزلیات</div>
    </div>
    <a href="#" aria-label="اندازه‌ی حروف" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; color: #14112B; font-family: 'Lalezar', sans-serif; font-size: 18px; padding-top: 3px;">آ</a>
    <a href="#" aria-label="شنیدن" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#FFFFFF" d="M18 5v14L6 12z"></path></svg></a>
  </div>

  <div style="font-size: 12px; color: #4A4660; text-align: center;">روی هر بیت بزن تا معنیش رو ببینی</div>

{bhtml}
  <div style="position: absolute; right: 18px; left: 18px; bottom: 26px; display: flex; gap: 10px;">
    <a href="JigsawE.dc.html" style="text-decoration: none; flex-grow: 1; height: 58px; box-sizing: border-box; border-radius: 20px; background: #FFB703; color: #14112B; border: 5px solid #FFFFFF; box-shadow: 0 4px 12px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 4px;">با این غزل بازی کن</a>
    <a href="#" aria-label="نگه داشتن کل غزل" style="width: 58px; height: 58px; flex-shrink: 0; box-sizing: border-box; border-radius: 20px; background: #FFFFFF; box-shadow: 0 4px 12px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; color: #14112B;"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg></a>
  </div>'''

open(os.path.join(P, "Explore.dc.html"), "w", encoding="utf-8").write(page("کاوش", explore))
open(os.path.join(P, "Poet.dc.html"), "w", encoding="utf-8").write(page("حافظ", poet))
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
for k, x, t in [("Explore.dc.html", 0, "۱۰ · تب کاوش و کتابخونه"), ("Poet.dc.html", 470, "۱۱ · صفحه‌ی شاعر")]:
    d["boards"][k] = {"x": x, "y": 2928, "w": 390, "h": 844, "title": t, "page": "sticker"}
    if k not in d["order"]:
        d["order"].append(k)
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok")
