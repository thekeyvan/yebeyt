import json, os, sys, re
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "gen_explore.py"), encoding="utf-8").read()
g = {"__name__": "lib", "sys": sys, "os": os, "json": json}
exec(src[src.index("def page("):src.index("# ---------- Explore ----------")], g)
nav, BACK = g["nav"], g["BACK"]
g["P"] = P
AVBTN = g["AVBTN"]
g["HREF"].update({"آروم": "Calm.dc.html", "من": "Profile.dc.html"})

def page(title, body, bg):
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
<link href="https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700&amp;family=Noto+Naskh+Arabic:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
@font-face{{font-family:'Parastoo';src:url(/_blob/9fe3b1905f2e20db67b7d7711a8c69d0)}}@font-face{{font-family:'Gandom';src:url(/_blob/68a06d356b96bd36f8f9011a12ab1244)}}@font-face{{font-family:'Sahel';src:url(/_blob/b64bda18f46572bff3417fa47d760023)}}@font-face{{font-family:'Shabnam';src:url(/_blob/657f6f793803047173f39b46bb9f84cc)}}
a{{color:#2F35F5}}a:hover{{color:#14112B}}
</style>
</helmet>
<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 18px 0; {bg} color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
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

SVG = {
 "heart": '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path>',
 "send": '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path>',
 "save": '<path d="M6 3.5h12v17l-6-4-6 4z"></path>',
 "play": '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"></path>',
 "gear": '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>',
}
def ic(n, s=22, c="currentColor", w=2.2):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{SVG[n]}</svg>'
def iconbtn(label, n, href="#"):
    return f'<a href="{href}" aria-label="{label}" style="color: #14112B; display: flex; padding: 6px;">{ic(n, 22)}</a>'

# ---------------- Calm tab ----------------
moods = [("دلتنگ", True), ("عاشق", False), ("خسته", False), ("امیدوار", False), ("آروم", False)]
mood_chips = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="text-decoration: none; white-space: nowrap; font-size: 14px; font-weight: {700 if on else 500}; color: {"#2F35F5" if on else "#14112B"}; background: #FFFFFF; border: 2px solid {"#2F35F5" if on else "transparent"}; border-radius: 999px; padding: 6px 14px;">{m}</a>' for m, on in moods)
shelves = [("دلتنگی", "۲۴ بیت", "#2F35F5"), ("عاشقی", "۳۱ بیت", "#E0307A"), ("امید", "۱۸ بیت", "#3E9A1E")]
shelf = "".join(f'''<a href="#" style="text-decoration: none; color: #14112B; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; background: #FFFFFF; border-radius: 18px; padding: 12px;"><span aria-hidden="true" style="width: 22px; height: 6px; border-radius: 3px; background: {c};"></span><span style="font-size: 15px; font-weight: 700;">{t}</span><span style="font-size: 12px; color: #4A4660;">{n}</span></a>''' for t, n, c in shelves)
calm = f'''
  <div style="display: flex; flex-direction: column; gap: 2px;">
    <div style="font-size: 14px; color: #4A4660;">دوشنبه ۲ آذر</div>
    <h1 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 40px; line-height: 1.05;">آروم</h1>
  </div>

  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 14px; font-weight: 500;">امروز حالت چطوره؟</div>
    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px;">{mood_chips}</div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; border-radius: 26px; padding: 22px 20px 12px; box-shadow: 0 6px 22px rgba(20,17,43,0.07);">
    <div style="font-size: 12px; font-weight: 700; color: #2F35F5;">بیتِ امروزِ تو · چون گفتی دلتنگی</div>
    <div style="font-family: 'Noto Naskh Arabic', serif; font-weight: 500; font-size: 23px; line-height: 2; text-align: center; padding: 6px 0;">
      <div>ای ساربان آهسته رو کآرام جانم می‌رود</div>
      <div>وان دل که با خود داشتم با دلستانم می‌رود</div>
    </div>
    <div style="text-align: center; font-size: 13px; color: #4A4660;">سعدی · غزلیات</div>
    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #EEEBF2; padding-top: 6px;">
      <div style="display: flex; gap: 8px;">{iconbtn("پسند", "heart")}{iconbtn("بفرست", "send")}{iconbtn("نگه دار", "save")}</div>
      <a href="#" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #2F35F5;">{ic("play", 14, "#2F35F5")}شنیدن</a>
    </div>
  </div>

  <a href="#" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 14px; background: #FFFFFF; border-radius: 22px; padding: 14px 16px;">
    <span aria-hidden="true" style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 14px; background: #EFEDF8; display: flex; align-items: center; justify-content: center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F35F5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path></svg>
    </span>
    <div style="display: flex; flex-direction: column; flex-grow: 1;">
      <div style="font-size: 15px; font-weight: 700;">فال حافظ</div>
      <div style="font-size: 12px; color: #4A4660;">یه نیت کن، دیوان رو باز کن</div>
    </div>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B9B4C6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
  </a>

  <div style="display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 14px; font-weight: 500;">قفسه‌ی حال‌ها</div>
    <div style="display: flex; gap: 10px;">{shelf}</div>
  </div>

{nav("خونه")}'''

# ---------------- Profile ----------------
AV = re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', open(os.path.join(P, "Avatar.dc.html"), encoding="utf-8").read(), flags=re.S).group(0)
AV = AV.replace('width="196" height="196"', 'width="100%" height="100%"').replace('id="av"', 'id="avp"').replace('url(#av)', 'url(#avp)')
stats = [("سطح", "غزل‌باز", "#2F35F5", "#FFFFFF"), ("امتیاز", "۲٬۴۸۰", "#FFB703", "#14112B"), ("پشت‌سرهم", "۷ روز", "#FF4D24", "#FFFFFF")]
stat_html = "".join(f'''<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: {bg}; color: {fg}; border: 4px solid #FFFFFF; border-radius: 20px; padding: 10px 4px; box-shadow: 0 3px 10px rgba(20,17,43,0.16);"><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1.2;">{v}</span><span style="font-size: 12px; font-weight: 500;">{k}</span></div>''' for k, v, bg, fg in stats)
badges = [("۷ روز", "#FF4D24", "#FFFFFF", -8, True), ("اولین مشاعره", "#FFB703", "#14112B", 6, True), ("حافظ‌شناس", "#2F35F5", "#FFFFFF", -4, True), ("۱۰۰ بیت", "#DAD6E2", "#4A4660", 0, False)]
badge_html = "".join(f'''<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: {'#14112B' if on else '#4A4660'}; text-align: center;"><span aria-hidden="true" style="width: 56px; height: 56px; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); transform: rotate({r}deg); display: flex; align-items: center; justify-content: center; color: {fg}; {'opacity: 0.6;' if not on else ''}"><svg width="24" height="24" viewBox="0 0 24 24" fill="{fg if on else 'none'}" stroke="{fg}" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"></path></svg></span>{t}</div>''' for t, bg, fg, r, on in badges)
saved = [("ای ساربان آهسته رو کآرام جانم می‌رود", "سعدی"), ("بشنو این نی چون شکایت می‌کند", "مولانا")]
saved_html = "".join(f'''<a href="#" style="text-decoration: none; color: #14112B; flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; height: 104px; box-sizing: border-box; background: #FFFFFF; border-radius: 18px; padding: 12px; box-shadow: 0 2px 8px rgba(20,17,43,0.08);"><span style="font-family: 'Noto Naskh Arabic', serif; font-size: 15px; line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{b}</span><span style="font-size: 11px; color: #4A4660;">{p}</span></a>''' for b, p in saved)
profile = f'''
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <h1 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 34px; line-height: 1;">من</h1>
    <div style="display: flex; gap: 8px;">
      <a href="Privacy.dc.html" aria-label="تنظیمات" style="width: 44px; height: 44px; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.14); display: flex; align-items: center; justify-content: center; color: #14112B;">{ic("gear", 22)}</a>
    </div>
  </div>

  <div style="display: flex; align-items: center; gap: 16px;">
    <a href="Avatar.dc.html" aria-label="ویرایش چهره" style="position: relative; width: 104px; height: 104px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; padding: 4px; box-shadow: 0 4px 14px rgba(20,17,43,0.18); display: block;">
      {AV}
      <span aria-hidden="true" style="position: absolute; bottom: 0; left: 0; width: 32px; height: 32px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg></span>
    </a>
    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
      <div style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1.1;">نیلوفر</div>
      <div style="font-size: 13px; color: #4A4660;">@niloofar · ۱۲ دوست</div>
      <div style="display: flex; gap: 6px; margin-top: 2px;"><span style="background: #FFFFFF; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700;">شاعرِ محبوب: حافظ</span></div>
    </div>
  </div>

  <div style="display: flex; gap: 10px;">{stat_html}</div>

  <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 22px; padding: 14px 12px 12px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px;"><span style="font-size: 15px; font-weight: 700;">نشان‌ها</span><a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه</a></div>
    <div style="display: flex; gap: 6px;">{badge_html}</div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 15px; font-weight: 700;">دیوانِ من</span><a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">۳۸ بیت</a></div>
    <div style="display: flex; gap: 10px;">{saved_html}</div>
  </div>


{nav("من")}'''

open(os.path.join(P, "Calm.dc.html"), "w", encoding="utf-8").write(page("تب آروم", calm, "background: #F7F5F0;"))
open(os.path.join(P, "Profile.dc.html"), "w", encoding="utf-8").write(page("صفحه‌ی من", profile, "background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px;"))
d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
for k, x, t in [("Calm.dc.html", 0, "۱۴ · تب آروم"), ("Profile.dc.html", 470, "۱۵ · صفحه‌ی من")]:
    d["boards"][k] = {"x": x, "y": 3892, "w": 390, "h": 844, "title": t, "page": "sticker"}
    if k not in d["order"]:
        d["order"].append(k)
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok")

# ---------------- Calm v2: just one couplet ----------------
calm2 = f'''
  <div style="text-align: center; font-size: 14px; color: #4A4660;">دوشنبه ۲ آذر</div>

  <div style="position: absolute; top: 120px; bottom: 150px; right: 34px; left: 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;">
    <div style="font-size: 13px; font-weight: 700; color: #2F35F5;">بیتِ امروز</div>
    <div style="font-family: 'Parastoo', serif; font-size: 27px; line-height: 2.05; text-align: center;">
      <div>ای ساربان آهسته رو کآرام جانم می‌رود</div>
      <div>وان دل که با خود داشتم با دلستانم می‌رود</div>
    </div>
    <div style="font-size: 14px; color: #4A4660;">سعدی</div>
    <div style="display: flex; gap: 14px; color: #4A4660;">{iconbtn("پسند", "heart")}{iconbtn("بفرست", "send")}{iconbtn("نگه دار", "save")}</div>
  </div>

  <a href="#" style="position: absolute; bottom: 110px; left: 50%; transform: translateX(-50%); text-decoration: none; white-space: nowrap; font-size: 13px; font-weight: 500; color: #4A4660;">حالت فرق کرده؟ یه بیت دیگه</a>

{nav("خونه")}'''
open(os.path.join(P, "Calm.dc.html"), "w", encoding="utf-8").write(page("تب آروم", calm2, "background: #F7F5F0;"))
print("calm2")

# ---------------- Calm v3: a quiet feed of couplets ----------------
FEED = [
 ("ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", "سعدی", True),
 ("یوسف گم گشته باز آید به کنعان غم مخور", "کلبه احزان شود روزی گلستان غم مخور", "حافظ", False),
 ("این جهان کوه است و فعل ما ندا", "سوی ما آید نداها را صدا", "مولانا", False),
]
def feed_card(a, b, poet, liked):
    heart = f'<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="{"#FF3D8B" if liked else "none"}" stroke="{"#FF3D8B" if liked else "currentColor"}" stroke-width="2.2" stroke-linejoin="round">{SVG["heart"]}</svg>'
    return f'''  <div style="display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; border-radius: 24px; padding: 22px 18px 10px; flex-shrink: 0;">
    <div style="font-family: 'Parastoo', serif; font-size: 21px; line-height: 2; text-align: center;"><div>{a}</div><div>{b}</div></div>
    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #EEEBF2; padding-top: 4px;">
      <span style="font-size: 13px; font-weight: 500; color: #4A4660;">{poet}</span>
      <div style="display: flex; gap: 4px;"><a href="#" aria-label="پسند" style="color: #14112B; display: flex; padding: 6px;">{heart}</a>{iconbtn("بفرست", "send")}{iconbtn("نگه دار", "save")}</div>
    </div>
  </div>
'''
calm3 = f'''
  <div style="display: flex; align-items: baseline; justify-content: space-between;">
    <h1 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 34px; line-height: 1;">آروم</h1>
    <span style="font-size: 13px; color: #4A4660;">دوشنبه ۲ آذر</span>
  </div>
{"".join(feed_card(*f) for f in FEED)}
{nav("خونه")}'''
open(os.path.join(P, "Calm.dc.html"), "w", encoding="utf-8").write(page("تب آروم", calm3, "background: #F7F5F0;"))
print("calm3")
