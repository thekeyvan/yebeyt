"""Games catalogue board: every proposed game with its icon, rule, length and a tiny mock of its core screen.
Run after gen_library, before apply_fonts. Also places it at the end of row ۳ (بازی)."""
import json, os, sys
P = sys.argv[1]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "gameicons.py"), encoding="utf-8").read())

HEAD = '''<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>بازی‌ها</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Lalezar&amp;family=Vazirmatn:wght@300;400;500;700&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
@font-face{font-family:'Parastoo';src:url(/_blob/9fe3b1905f2e20db67b7d7711a8c69d0)}
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
def svg(p, c="#FFFFFF", sw=2.3):
    return f'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
IC = {
 "daily": '<rect x="4" y="5" width="16" height="15" rx="3"></rect><path d="M4 10h16M9 3v4M15 3v4"></path><path d="M12 12.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z"></path>',
 "jigsaw": '<rect x="3.5" y="7" width="8" height="6" rx="1.6"></rect><rect x="12.5" y="11" width="8" height="6" rx="1.6"></rect><path d="M7.5 15v3M16.5 6v3"></path>',
 "poet": '<circle cx="12" cy="9" r="4"></circle><path d="M5 20c1-3.6 3.8-5.4 7-5.4s6 1.8 7 5.4"></path><path d="M17.5 3.5l1.2 1.2M19.5 7h1.4"></path>',
 "misra": '<path d="M4 7h11M9 12h11"></path><path d="M4 17h7"></path><path d="M14 17h6M17 14l3 3-3 3"></path>',
 "book": '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path>',
 "match": '<circle cx="6" cy="6" r="2.4"></circle><circle cx="18" cy="18" r="2.4"></circle><circle cx="6" cy="18" r="2.4"></circle><circle cx="18" cy="6" r="2.4"></circle><path d="M8.2 7.2l7.6 9.6M8.4 18h7.2"></path>',
 "listen": '<path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><rect x="3.5" y="14" width="4" height="6" rx="1.5"></rect><rect x="16.5" y="14" width="4" height="6" rx="1.5"></rect>',
 "mosh": '<path d="M4 6h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8l-3 3v-3H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path><path d="M17 10h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v3l-3-3h-3"></path>',
 "duel": '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"></path>',
}
B = "/_blob/"
PORTRAITS = [("05993349bc76fc57449fc1f70208d3f4", "#2F35F5"), ("edaf69952e782a1782b62dd0cfff59d8", "#FF4D24"),
             ("2a4c917d315ec35f181197f163478728", "#FF3D8B"), ("9d8e9b659748d432ee291ddec65a3909", "#14112B")]
POEM = "font-family: 'Parastoo', serif;"
def pill(t, on=None):
    st = {"ok": "background: #6CCB3A; color: #14112B; font-weight: 700;", "off": "background: #F1EFEA; color: #14112B;", None: "background: #F1EFEA; color: #14112B;"}[on]
    return f'<span style="{st} border-radius: 10px; padding: 3px 10px; font-size: 11px; {POEM} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{t}</span>'
def word(t, bg="#2F35F5", fg="#FFFFFF", rot=0):
    return f'<span style="background: {bg}; color: {fg}; border: 2px solid #FFFFFF; border-radius: 8px; padding: 1px 8px; font-size: 12px; {POEM} box-shadow: 0 1px 4px rgba(20,17,43,0.18); transform: rotate({rot}deg);">{t}</span>'
slot = '<span style="width: 26px; height: 20px; border: 2px dashed #C9C5D3; border-radius: 6px;"></span>'

MOCK = {
 "daily": f'''<div style="{POEM} font-size: 13px; text-align: center;">کنار آب رکن آباد و گلگشت <span style="display: inline-flex; gap: 3px; vertical-align: middle;">{"".join(f'<span style="width: 16px; height: 19px; box-sizing: border-box; border-radius: 4px; background: {"#2F35F5" if ch else "#FFFFFF"}; color: #FFFFFF; border: 2px solid #2F35F5; font-size: 11px; display: inline-flex; align-items: center; justify-content: center;">{ch}</span>' for ch in ["م", "ص", "", ""])}</span></div>
      <div style="display: flex; justify-content: center; gap: 4px;">{"".join(f'<span style="width: 22px; height: 22px; box-sizing: border-box; border-radius: 6px; background: {"#F1EFEA" if used else "#FFFFFF"}; color: {"#C9C5D3" if used else "#14112B"}; border: 2px solid #FFFFFF; box-shadow: {"none" if used else "0 1px 4px rgba(20,17,43,0.18)"}; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;">{ch}</span>' for ch, used in [("ل", False), ("م", True), ("ر", False), ("ا", False), ("ص", True), ("ب", False), ("ن", False)])}</div>''',
 "jigsaw": f'''<div style="display: flex; justify-content: center; gap: 5px;">{word("بنی")}{word("آدم")}{slot}{slot}</div>
      <div style="display: flex; justify-content: center; gap: 6px; padding-top: 4px;">{word("یکدیگرند", "#FFFFFF", "#14112B", -6)}{word("اعضای", "#FF4D24", "#FFFFFF", 5)}</div>''',
 "poet": f'''<div style="{POEM} font-size: 13px; text-align: center;">بشنو این نی چون شکایت می‌کند</div>
      <div style="display: flex; justify-content: center; gap: 10px;">{"".join(f'<span style="display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; font-weight: {700 if i == 2 else 500}; color: {"#3E9A1E" if i == 2 else "#14112B"};"><span style="width: 30px; height: 30px; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {"3px solid #6CCB3A" if i == 2 else "2px solid #FFFFFF"}; overflow: hidden; box-shadow: 0 1px 4px rgba(20,17,43,0.18);"><img src="{B}{b}" alt="" style="width: 100%; height: 100%; display: block;"></span>{n}</span>' for i, ((b, bg), n) in enumerate(zip(PORTRAITS, ["حافظ", "سعدی", "مولانا", "خیام"])))}</div>''',
 "misra": f'''<div style="{POEM} font-size: 13px; text-align: center;">بنی آدم اعضای یکدیگرند</div>
      <div style="display: flex; flex-direction: column; gap: 4px; align-items: stretch;">{pill("که در آفرینش ز یک گوهرند", "ok")}{pill("که از جان و دل یار یکدیگرند")}</div>''',
 "book": f'''<div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><span style="{POEM} font-size: 13px;">بشنو این نی چون شکایت می‌کند</span><span style="display: inline-flex; align-items: center; gap: 4px; background: #FFFFFF; border-radius: 999px; padding: 1px 8px 1px 2px; font-size: 10px; font-weight: 700;"><span style="width: 16px; height: 16px; border-radius: 50%; background: #FF3D8B; overflow: hidden;"><img src="{B}2a4c917d315ec35f181197f163478728" alt="" style="width: 100%; height: 100%; display: block;"></span>مولانا</span></div>
      <div style="display: flex; justify-content: center; gap: 8px; align-items: flex-end;">{"".join(f'<span style="display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px;"><span style="width: 24px; height: {h}px; border-radius: 3px; background: {c}; {"outline: 3px solid #6CCB3A; outline-offset: 1px;" if ok else ""}"></span>{n}</span>' for n, c, h, ok in [("مثنوی", "#FFB703", 34, True), ("دیوان شمس", "#FF3D8B", 30, False), ("فیه ما فیه", "#1C20B8", 28, False)])}</div>''',
 "match": f'''<div style="position: relative; display: flex; justify-content: space-between; padding: 0 6px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">{pill("گلگشت")}{pill("مصلا")}</div>
        <svg aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="none" viewBox="0 0 100 40"><path d="M70 10 C50 10 50 30 30 30" stroke="#2F35F5" stroke-width="1.6" fill="none"></path></svg>
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end;">{pill("جای نماز")}{pill("گردشگاه", "ok")}</div>
      </div>''',
 "listen": f'''<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span style="width: 30px; height: 30px; border-radius: 50%; background: #2F35F5; display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="#FFFFFF"></path></svg></span><span style="display: flex; align-items: center; gap: 2px;">{"".join(f'<span style="width: 3px; height: {h}px; border-radius: 2px; background: #2F35F5;"></span>' for h in [8,14,20,12,18,24,10,16,22,12,8,14,18,10])}</span></div>
      <div style="display: flex; flex-direction: column; gap: 4px; align-items: stretch;">{pill("کنار آب رکن آباد و گلگشت مصلا را", "ok")}{pill("به خال هندویش بخشم سمرقند و بخارا را")}</div>''',
 "mosh": f'''<div style="display: flex; flex-direction: column; gap: 5px;">
        <span style="align-self: flex-start; background: #FFFFFF; border-radius: 4px 12px 12px 12px; padding: 3px 10px; font-size: 12px; {POEM}">یاد باد آن که نهانت نظری با ما بو<b style="color: #FFFFFF; background: #2F35F5; border-radius: 4px; padding: 0 3px;">د</b></span>
        <span style="align-self: flex-end; background: #2F35F5; color: #FFFFFF; border-radius: 12px 4px 12px 12px; padding: 3px 10px; font-size: 12px; {POEM}"><b style="background: #FFB703; color: #14112B; border-radius: 4px; padding: 0 3px;">د</b>ل می‌رود ز دستم…</span>
      </div>''',
 "duel": f'''<div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="width: 34px; height: 34px; border-radius: 50%; background: #FFB703; border: 3px solid #FFFFFF; box-shadow: 0 1px 4px rgba(20,17,43,0.2);"></span>
        <span style="font-family: 'Lalezar', sans-serif; font-size: 22px;">۳</span><span style="font-size: 10px; color: #8A8698;">در برابر</span><span style="font-family: 'Lalezar', sans-serif; font-size: 22px;">۲</span>
        <span style="width: 34px; height: 34px; border-radius: 50%; background: #FF3D8B; border: 3px solid #FFFFFF; box-shadow: 0 1px 4px rgba(20,17,43,0.2);"></span>
      </div>
      <div style="display: flex; justify-content: center; gap: 4px;">{"".join(f'<span style="width: 22px; height: 6px; border-radius: 3px; background: {c};"></span>' for c in ["#6CCB3A","#FF4D24","#6CCB3A","#6CCB3A","#DAD6E2"])}</div>''',
}
# key, name, colour, icon colour, group, rule, meta, status
GAMES = [
 ("daily", "معمای امروز", "#2F35F5", "#FFFFFF", "روزانه", "یه بیت با یه کلمه‌ی جا افتاده؛ حرف‌هاش رو از برچسب‌های پایین بچین، تایپ لازم نیست. ۳ فرصت، برای همه یکی، فردا عوض می‌شه.", "۱ دقیقه · رشته‌ی روزها", "داریم"),
 ("jigsaw", "جورچین بیت", "#FFB703", "#14112B", "تکی", "کلمه‌های یه بیت ریخته؛ برچسب‌ها رو بکن و به ترتیب بچسبون.", "۱۰ بیت · ۲ دقیقه", "داریم"),
 ("poet", "حدس شاعر", "#FF3D8B", "#FFFFFF", "تکی", "یه بیت می‌بینی؛ از بین چهار شاعر (چهره و اسم) شاعرش رو انتخاب کن.", "۱۰ سؤال · زمان‌دار", "جدید"),
 ("misra", "مصراع دوم", "#6CCB3A", "#14112B", "تکی", "مصراع اول رو داری؛ مصراع دومِ درست رو از بین سه تا پیدا کن.", "۱۰ سؤال · ۲ دقیقه", "جدید"),
 ("book", "از کدوم کتاب؟", "#FF4D24", "#FFFFFF", "تکی", "شاعر رو بهت می‌گیم؛ تو بگو این بیت از کدوم کتابِ اونه. مثلاً مولانا: مثنوی، دیوان شمس یا فیه ما فیه؟", "۱۰ سؤال", "جدید"),
 ("match", "معنی‌یاب", "#1C20B8", "#FFFFFF", "تکی", "واژه‌های سخت یه بیت رو به معنی‌شون وصل کن؛ همون واژه‌های نقطه‌چین.", "۵ جفت · بی‌عجله", "جدید"),
 ("listen", "گوش کن", "#14112B", "#FFFFFF", "تکی", "مصراع اول با صدا پخش می‌شه و متنش رو نمی‌بینی؛ مصراع دومش رو از بین نوشته‌ها پیدا کن. سطح بالاتر: شاعرش رو بگو.", "۵ سؤال · با هدفون", "جدید"),
 ("mosh", "مشاعره", "#FFB703", "#14112B", "با دوست یا «یه بیت»", "بیتت باید با حرف آخرِ بیتِ اون یکی شروع بشه. نوبتی، با زمان برای هر نوبت.", "تا وقتی کسی کم بیاره", "داریم"),
 ("duel", "بازی رودررو", "#FF4D24", "#FFFFFF", "با دوست", "۵ دور سریع از بازی‌های بالا، هم‌زمان با یه دوست. هر کی بیشتر برد.", "۵ دور · ۳ دقیقه", "داریم"),
]
import json as _json
CODES = {k: v["title"].split(" · ")[0] for k, v in _json.load(open(os.path.join(P, "canvas.json"), encoding="utf-8"))["boards"].items()}
PAGES = {'daily': ('۵-۱', 'PlayDaily.dc.html'), 'jigsaw': ('۳-۳', 'JigsawE.dc.html'), 'poet': ('۵-۲', 'PlayPoet.dc.html'), 'misra': ('۵-۴', 'PlaySecond.dc.html'), 'book': ('۵-۵', 'PlayBook.dc.html'), 'match': ('۵-۶', 'PlayMatch.dc.html'), 'listen': ('۵-۷', 'PlayListen.dc.html'), 'mosh': ('۵-۸', 'PlayMosh.dc.html'), 'duel': ('۵-۹', 'PlayDuel.dc.html')}
def card(k, name, bg, icol, group, rule, meta, status):
    _, href = PAGES[k]
    code = CODES.get(href, PAGES[k][0])
    return f'''    <article style="display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 24px; padding: 14px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08); min-width: 0;">
      <div style="display: flex; align-items: center; gap: 10px;">
        {game_icon(k, 44)}
        <div style="display: flex; flex-direction: column; min-width: 0;"><span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1.1; padding-top: 3px;">{name}</span><span style="font-size: 11px; color: #4A4660;">{group} · {meta}</span></div>
        <a href="{href}" style="margin-inline-start: auto; flex-shrink: 0; text-decoration: none; background: #E8E9FF; color: #2F35F5; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700;">{code}</a>
      </div>
      <div style="display: flex; flex-direction: column; justify-content: center; gap: 8px; background: #F7F5F0; border-radius: 16px; padding: 10px 10px; height: 84px; box-sizing: border-box; overflow: hidden;">
      {MOCK[k]}
      </div>
      <div style="font-size: 12.5px; line-height: 1.7; color: #14112B;">{rule}</div>
    </article>
'''
body = f'''<div dir="rtl" style="width: 1280px; height: 844px; box-sizing: border-box; padding: 30px 40px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
  <div style="display: flex; align-items: baseline; gap: 14px;">
    <span style="font-family: 'Lalezar', sans-serif; font-size: 38px; line-height: 1;">بازی‌ها</span>
    <span style="font-size: 14px; color: #4A4660;">۹ بازی: یکی روزانه، شش تا تکی و سریع، دو تا با دوست. همه امتیاز لیگ می‌دن و بعد از هر جواب، معنی و شاعر و کتاب رو نشون می‌دن. شماره‌ی هر کارت، صفحه‌ی خود بازی روی بومه.</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;">
{"".join(card(*g) for g in GAMES)}  </div>
</div>
'''
open(os.path.join(P, "GamesCatalog.dc.html"), "w", encoding="utf-8").write(HEAD + body + TAIL)
print("games")
