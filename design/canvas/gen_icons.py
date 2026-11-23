"""Game icons: the icons board (۰-۴) and the games tab tiles. Run after gen_play, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gameicons.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

HEAD = '''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>آیکن بازی‌ها</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
</style>
</helmet>
'''
TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1280,"height":844}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
'''
GROUPS = [("روزانه", ["daily"]), ("تکی", ["jigsaw", "poet", "misra", "book", "match", "listen"]), ("با دوست", ["mosh", "duel"])]
HREF = {"daily": "PlayDaily.dc.html", "jigsaw": "JigsawE.dc.html", "poet": "PlayPoet.dc.html", "misra": "PlaySecond.dc.html", "book": "PlayBook.dc.html",
        "match": "PlayMatch.dc.html", "listen": "PlayListen.dc.html", "mosh": "PlayMosh.dc.html", "duel": "PlayDuel.dc.html"}
def big(k):
    name = GAME[k][0]
    return f'''<a href="{HREF[k]}" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 12px; width: 120px;">{game_icon(k, 104)}<span style="font-family: 'Lalezar', sans-serif; font-size: 19px; line-height: 1.2; text-align: center;">{name}</span></a>'''
def section(g, ks):
    return f'''<section style="display: flex; flex-direction: column; gap: 16px; background: #FFFFFF; border-radius: 28px; padding: 18px 22px 20px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
      <span style="font-size: 14px; font-weight: 700; color: #4A4660;">{g}</span>
      <div style="display: flex; gap: 18px; justify-content: {"space-between" if len(ks) > 2 else "flex-start"};">{"".join(big(k) for k in ks)}</div>
    </section>'''
sizes = "".join(f'<div style="display: flex; align-items: center; gap: 14px;"><span style="width: 40px; font-size: 12px; color: #8A8698;">{s}</span>' + "".join(game_icon(k, s) for k in GAME) + "</div>" for s in [48, 34, 24])
body = f'''<div dir="rtl" style="width: 1280px; height: 844px; box-sizing: border-box; padding: 34px 44px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 18px; overflow: hidden;">
  <div style="display: flex; align-items: baseline; gap: 14px;">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 40px; line-height: 1;">آیکن بازی‌ها</span>
    <span style="font-size: 14px; color: #4A4660;">هر بازی یه برچسب گرد با رنگ خودش. بازی‌هایی که با دوست بازی می‌شن دو رنگ دارن. همه‌جا همین‌ها رو می‌بینی: تب بازی، فهرست بازی‌ها، بازی با دوست و بالای خود بازی.</span>
  </div>
  {section("تکی", GROUPS[1][1])}
  <div style="display: flex; gap: 16px; align-items: stretch;">
    {section("روزانه", GROUPS[0][1])}
    {section("با دوست", GROUPS[2][1])}
    <section style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; background: #FFFFFF; border-radius: 28px; padding: 18px 22px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
      <span style="font-size: 14px; font-weight: 700; color: #4A4660;">کوچیک هم خوانا می‌مونن</span>
      {sizes}
    </section>
  </div>
</div>
'''
wr("GameIcons.dc.html", HEAD + body + TAIL)

# ---------------- games tab: tiles carry their game's icon, open their game ----------------
ge = rd("GamesE.dc.html")
def swap_tile(ge, title, key, new_title=None, new_href=None):
    i = ge.index(f">{title}</div>")
    a = ge.rindex("<a href=", 0, i)
    tag_end = ge.index(">", a) + 1
    open_tag = ge[a:tag_end]
    if new_href:
        open_tag = re.sub(r'href="[^"]*"', f'href="{new_href}"', open_tag, count=1)
    deco_start = ge.index('<span aria-hidden="true"', tag_end)
    title_div = ge.rindex('<div style="font-family:', 0, i)
    icon = f'<span style="position: absolute; top: -14px; left: 8px; display: flex;">{game_icon(key, 50)}</span>\n      '
    seg = open_tag + "\n      " + icon + ge[title_div:i] + f">{new_title or title}</div>"
    return ge[:a] + seg + ge[i + len(f">{title}</div>"):]
if "data-game-icons" not in ge:
    ge = swap_tile(ge, "جورچین بیت", "jigsaw")
    ge = swap_tile(ge, "حدس شاعر", "poet", new_href="PlayPoet.dc.html")
    ge = swap_tile(ge, "ادامه‌ش چیه؟", "misra", new_title="مصراع دوم", new_href="PlaySecond.dc.html")
    ge = swap_tile(ge, "از کدوم کتاب؟", "book", new_href="PlayBook.dc.html")
    ge = ge.replace('<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">', '<div data-game-icons style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">', 1)
    ge = ge.replace("شاهنامه یا مثنوی؟", "کدوم کتابِ شاعره؟")
    wr("GamesE.dc.html", ge)
print("icons")
