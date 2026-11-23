import json, os, sys, re
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "gen_calm.py"), encoding="utf-8").read()
g = {"__name__": "lib", "sys": sys, "os": os, "json": json, "re": re, "__file__": os.path.join(HERE, "gen_calm.py")}
# take helpers (page, SVG, ic, iconbtn, nav) without running the page writers
exec(src[:src.index("# ---------------- Calm tab ----------------")].replace("P = sys.argv[1]", f"P = {P!r}"), g)
page, ic, iconbtn, nav, SVG = g["page"], g["ic"], g["iconbtn"], g["nav"], g["SVG"]
AVBTN = g["AVBTN"]

circle = open(os.path.join(P, "Circle.dc.html"), encoding="utf-8").read()
faces = re.findall(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', circle, flags=re.S)
SARA, ARIAN, KIAN, MAHSA, BARDIA = faces[:5]
def face(svg, size, bg, tag):
    svg = re.sub(r'id="fc(\d+)"', lambda m: f'id="{tag}{m.group(1)}"', svg)
    svg = re.sub(r'url\(#fc(\d+)\)', lambda m: f'url(#{tag}{m.group(1)})', svg)
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 3px solid #FFFFFF; box-shadow: 0 1px 5px rgba(20,17,43,0.22); display: block;">{svg}</span>'

REP = '<path d="M17 3l3 3-3 3M4 12V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 12v3a3 3 0 0 1-3 3H4"></path>'
def rep(s=22): return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{REP}</svg>'
heart_on = '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="#FF3D8B" stroke="#FF3D8B" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path></svg>'
plane = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path></svg>'

msg_btn = f'''<a href="Inbox.dc.html" aria-label="پیام‌ها، ۲ تا نخونده" style="position: relative; width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.14); display: flex; align-items: center; justify-content: center; color: #14112B;">{plane}<span style="position: absolute; top: -4px; left: -4px; min-width: 20px; height: 20px; box-sizing: border-box; border-radius: 10px; background: #FF4D24; border: 2px solid #FFFFFF; color: #FFFFFF; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">۲</span></a>'''

home = f'''
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 12px;">
    <div style="display: flex; flex-direction: column;">
      <span style="font-size: 13px; color: #4A4660;">دوشنبه ۲ آذر</span>
      <h1 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 32px; line-height: 1.05;">بیتِ امروز</h1>
    </div>
    </div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 12px; background: #FFFFFF; border-radius: 26px; padding: 22px 18px 14px; box-shadow: 0 6px 22px rgba(20,17,43,0.08);">
    <div style="font-family: 'Parastoo', serif; font-size: 23px; line-height: 2; text-align: center;">
      <div>ای ساربان آهسته رو کآرام جانم می‌رود</div>
      <div>وان دل که با خود داشتم با دلستانم می‌رود</div>
    </div>
    <div style="text-align: center; font-size: 13px; color: #4A4660;">سعدی</div>
    <div style="display: flex; align-items: center; justify-content: center; gap: 18px; color: #14112B;">
      <a href="#" aria-label="پسند" style="color: #14112B; display: flex; padding: 4px;">{ic("heart", 22)}</a>
      <a href="#" aria-label="بازنشر" style="color: #14112B; display: flex; padding: 4px;">{rep()}</a>
      <a href="#" aria-label="بفرست" style="color: #14112B; display: flex; padding: 4px;">{plane}</a>
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
      <a href="#" style="text-decoration: none; height: 48px; border-radius: 16px; background: #F1EFEA; color: #14112B; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; font-weight: 700;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>رد کن</a>
      <a href="#" style="text-decoration: none; height: 48px; box-sizing: border-box; border-radius: 16px; background: #2F35F5; color: #FFFFFF; border: 3px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; font-weight: 700;">{ic("save", 18, "#FFFFFF", 2.4)}نگه دار</a>
    </div>
  </div>

  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
    <h2 style="margin: 0; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 22px;">دوستات</h2>
    <a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">پیدا کردن دوست</a>
  </div>

  <div style="display: flex; flex-direction: column; gap: 10px; background: #FFFFFF; border-radius: 22px; padding: 12px 14px 6px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <div style="display: flex; align-items: center; gap: 10px;">
      {face(KIAN, 36, "#FF4D24", "hk")}
      <div style="display: flex; flex-direction: column; flex-grow: 1;">
        <div style="font-size: 14px;"><span style="font-weight: 700;">کیان</span> یه بیت به اشتراک گذاشت</div>
        <div style="font-size: 12px; color: #4A4660;">یک ساعت پیش</div>
      </div>
    </div>
    <div style="font-family: 'Parastoo', serif; font-size: 18px; line-height: 1.9; text-align: center; background: #F7F5F0; border-radius: 16px; padding: 10px 12px;"><div>بشنو این نی چون شکایت می‌کند</div><div>از جدایی‌ها حکایت می‌کند</div><div style="font-family: 'Vazirmatn', sans-serif; font-size: 12px; color: #4A4660;">مولانا</div></div>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <a href="#" aria-label="پسند" style="text-decoration: none; color: #FF3D8B; display: inline-flex; align-items: center; gap: 4px; padding: 4px;">{heart_on}<span style="font-size: 12px; font-weight: 700;">۴</span></a>
        <a href="#" aria-label="بازنشر" style="text-decoration: none; color: #14112B; display: inline-flex; align-items: center; gap: 4px; padding: 4px;">{rep(21)}<span style="font-size: 12px; font-weight: 700;">۲</span></a>
        <a href="#" aria-label="بفرست" style="color: #14112B; display: flex; padding: 4px;">{plane}</a>
      </div>
      <a href="#" aria-label="نگه دار" style="color: #14112B; display: flex; padding: 4px;">{ic("save", 21)}</a>
    </div>
  </div>

  <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; border-radius: 22px; padding: 12px 14px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    {face(SARA, 36, "#FF3D8B", "hs")}
    <div style="display: flex; flex-direction: column; flex-grow: 1;">
      <div style="font-size: 14px;"><span style="font-weight: 700;">سارا</span> معمای امروز رو با ۳ فرصت حل کرد</div>
      <div style="font-size: 12px; color: #4A4660;">۱۰ دقیقه پیش</div>
    </div>
    <a href="GamesE.dc.html" style="text-decoration: none; flex-shrink: 0; font-size: 13px; font-weight: 700; color: #2F35F5;">تو هم</a>
  </div>

{nav("خونه")}'''

# ---------------- Inbox ----------------
rows = [
 (SARA, "#FF3D8B", "سارا", "یه مشاعره شروع کرد · نوبت توئه", "۹:۴۵", True),
 (ARIAN, "#6CCB3A", "آرین", "دعوتت کرد به بازی رودررو", "۹:۱۰", True),
 (KIAN, "#FF4D24", "کیان", "بیت قشنگی بود", "دیروز", False),
 (MAHSA, "#FFB703", "مهسا", "تو: فردا معما رو با هم حل کنیم؟", "دیروز", False),
 (BARDIA, "#2F35F5", "بردیا", "یه بیت فرستاد", "شنبه", False),
]
row_html = ""
for i, (fc, bg, name, last, t, unread) in enumerate(rows):
    href = "Direct.dc.html" if name == "سارا" else "#"
    row_html += f'''    <a href="{href}" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; padding: 10px 0;{'' if i == len(rows) - 1 else ' border-bottom: 1px solid #EEEBF2;'}">
      {face(fc, 52, bg, f"ib{i}x")}
      <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
        <div style="font-size: 15px; font-weight: {700 if unread else 500};">{name}</div>
        <div style="font-size: 13px; color: {'#14112B' if unread else '#4A4660'}; font-weight: {500 if unread else 400}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{last}</div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;">
        <span style="font-size: 12px; color: #4A4660;">{t}</span>
        {'<span aria-label="نخونده" style="width: 10px; height: 10px; border-radius: 50%; background: #2F35F5;"></span>' if unread else '<span style="height: 10px;"></span>'}
      </div>
    </a>
'''
inbox = f'''
  <div style="display: flex; align-items: center; gap: 12px;">

    <h1 style="margin: 0; flex-grow: 1; font-family: 'Lalezar', sans-serif; font-weight: 400; font-size: 30px; line-height: 1; padding-top: 4px;">پیام‌ها</h1>
    <a href="#" aria-label="پیام تازه" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 3px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.22); display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg></a>
  </div>

  <label style="display: flex; align-items: center; gap: 10px; height: 46px; box-sizing: border-box; background: #FFFFFF; border-radius: 999px; padding: 0 16px; box-shadow: 0 2px 10px rgba(20,17,43,0.10);">
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4660" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>
    <span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">جستجو</span>
    <input type="search" placeholder="جستجو بین دوستات" style="border: none; outline: none; background: transparent; font-family: 'Vazirmatn', sans-serif; font-size: 15px; width: 100%; color: #14112B;">
  </label>

  <div style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 24px; padding: 4px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
{row_html}  </div>

{nav("پیام‌ها")}'''

open(os.path.join(P, "Calm.dc.html"), "w", encoding="utf-8").write(page("خونه", home, "background: #F7F5F0;"))
open(os.path.join(P, "Inbox.dc.html"), "w", encoding="utf-8").write(page("پیام‌ها", inbox, "background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px;"))

# patch hand-written tab bars and links
newnav_game = nav("بازی")
for f, active in [("GamesE.dc.html", "بازی"), ("LeaderboardS.dc.html", "بازی")]:
    s = open(os.path.join(P, f), encoding="utf-8").read()
    s, n = re.subn(r'  <nav aria-label="تب‌ها".*?</nav>', lambda m: nav(active), s, count=1, flags=re.S)
    open(os.path.join(P, f), "w", encoding="utf-8").write(s)
    print(f, n)
for f, old, new in [("Direct.dc.html", 'href="Circle.dc.html" aria-label="برگشت"', 'href="Inbox.dc.html" aria-label="برگشت"'),
                    ("Privacy.dc.html", 'href="Circle.dc.html" aria-label="برگشت"', 'href="Profile.dc.html" aria-label="برگشت"')]:
    s = open(os.path.join(P, f), encoding="utf-8").read()
    print(f, s.count(old)); s = s.replace(old, new)
    open(os.path.join(P, f), "w", encoding="utf-8").write(s)

d = json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))
d["boards"]["Circle.dc.html"].update({"page": "explore", "x": 1880, "y": 1964, "title": "۶ · تب حلقه (حذف شد)"})
d["boards"]["Inbox.dc.html"] = {"x": 0, "y": 1964, "w": 390, "h": 844, "title": "۶ · پیام‌ها", "page": "sticker"}
if "Inbox.dc.html" not in d["order"]:
    d["order"].append("Inbox.dc.html")
d["boards"]["Calm.dc.html"]["title"] = "۱۴ · تب خونه: بیت امروز + دوستات"
json.dump(d, open(os.path.join(P, "canvas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok")
