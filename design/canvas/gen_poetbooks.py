"""A poet's books as books (owner, 28 Nov: the pills on the poet page don't read as books).
Poet.dc.html (Hafez, one book): the divan as a cover with its sections under it.
PoetMany.dc.html (Saadi, six books): a shelf of covers, like the library.
Run after gen_links, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
lib = open(os.path.join(HERE, "gen_library.py"), encoding="utf-8").read()
exec(lib[lib.index("def book_svg"):lib.index("def book_tile")])          # book_svg, CLAMP2: the library's cover
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

LAPIS, FIRE, AMBER, GREEN, MAGENTA, INK, GREY = "#2F35F5", "#FF4D24", "#FFB703", "#6CCB3A", "#FF3D8B", "#14112B", "#8A8698"
CHEV = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8698" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>'
CARD = "background: #FFFFFF; border-radius: 24px; box-shadow: 0 3px 12px rgba(20,17,43,0.10);"

def heading(t, sub, link=""):
    l = f'<a href="Library.dc.html" style="text-decoration: none; font-size: 13px; font-weight: 700; color: {LAPIS};">{link}</a>' if link else ""
    return (f'<div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: -4px; flex-shrink: 0;"><span style="font-family: \'Lalezar\', sans-serif; font-size: 22px;">{t}</span>'
            f'<span style="font-size: 12px; color: {GREY}; flex-grow: 1;">{sub}</span>{l}</div>')

def section_tile(name, count, color):
    """A part of the one book: a page with the book's spine on its edge, not a pill."""
    return (f'<a href="BookSection.dc.html" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 10px; background: #FBF8F1; border-radius: 12px; padding: 9px 10px 9px 8px; '
            f'box-shadow: inset -6px 0 0 {color};"><span style="flex-grow: 1; display: flex; flex-direction: column; padding-right: 6px;"><span style="font-size: 14px; font-weight: 700;">{name}</span>'
            f'<span style="font-size: 11px; color: {GREY};">{count}</span></span>{CHEV}</a>')

# ---------------- one book: Hafez ----------------
one = f'''<div style="display: flex; flex-direction: column; gap: 12px; flex-shrink: 0; {CARD} padding: 14px;">
    <a href="Book.dc.html" style="text-decoration: none; color: {INK}; display: flex; align-items: center; gap: 14px;">
      <span style="width: 84px; flex-shrink: 0; display: flex;">{book_svg(LAPIS, MAGENTA, "pb1")}</span>
      <span style="flex-grow: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0;">
        <span style="font-size: 11px; font-weight: 700; color: {GREY};">کتابِ حافظ</span>
        <span style="font-family: 'Lalezar', sans-serif; font-size: 24px; line-height: 1.15;">دیوان حافظ</span>
        <span style="font-size: 12px; color: #4A4660;">ادامه: غزل ۳</span>
        <span style="height: 6px; border-radius: 3px; background: #E6E3EC;"><span style="display: block; width: 8%; height: 6px; border-radius: 3px; background: {LAPIS};"></span></span>
      </span>
      <span style="flex-shrink: 0; align-self: center; background: {LAPIS}; color: #FFFFFF; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 700;">باز کن</span>
    </a>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
      {section_tile("غزلیات", "۴۹۵ غزل", LAPIS)}{section_tile("رباعیات", "۴۲ رباعی", MAGENTA)}{section_tile("قطعات", "۴۲ قطعه", AMBER)}{section_tile("مثنویات", "۲ مثنوی", GREEN)}
    </div>
  </div>'''

# ---------------- many books: Saadi ----------------
SAADI_BOOKS = [("گلستان", "نثر و شعر", FIRE, AMBER), ("بوستان", "مثنوی", GREEN, LAPIS), ("غزلیات سعدی", "غزل", AMBER, MAGENTA),
               ("رباعیات سعدی", "رباعی", LAPIS, AMBER), ("مواعظ سعدی", "قصیده و قطعه", INK, FIRE), ("رساله‌های سعدی", "نثر", "#FFC94A", INK)]
def shelf_tile(i, t, kind, cover, mark):
    return (f'<a href="Book.dc.html" style="flex: 0 0 96px; text-decoration: none; color: {INK}; display: flex; flex-direction: column; gap: 5px;">{book_svg(cover, mark, f"ps{i}")}'
            f'<span style="font-family: \'Lalezar\', sans-serif; font-size: 15px; line-height: 1.3; {CLAMP2}">{t}</span><span style="font-size: 11px; color: {GREY}; margin-top: -4px;">{kind}</span></a>')
many = (heading("کتاب‌های سعدی", "۶ کتاب", "همه") + "\n  " +
        f'<div style="display: flex; gap: 14px; margin: 0 -18px; padding: 4px 18px 2px; overflow: hidden; flex-shrink: 0;">{"".join(shelf_tile(i, *b) for i, b in enumerate(SAADI_BOOKS))}</div>')

poet = rd("Poet.dc.html")
pills = re.search(r'\n  <div style="display: flex; gap: 8px;"><a href="[^"]*" style="text-decoration: none; color: #14112B; flex: 1;.*?</div>\n', poet, re.S)
assert pills, "the poet page's pills moved"
wr("Poet.dc.html", poet[:pills.start()] + "\n  " + one + "\n" + poet[pills.end():])

s = poet[:pills.start()] + "\n  " + many + "\n" + poet[pills.end():]
for a, b in [("background: #2F35F5; color: #FFFFFF; border: 5px solid #FFFFFF; border-radius: 28px", f"background: {FIRE}; color: #FFFFFF; border: 5px solid #FFFFFF; border-radius: 28px"),
             ("background: #1C20B8; border: 4px solid #FFFFFF", "background: #C7381A; border: 4px solid #FFFFFF"),
             ("/_blob/05993349bc76fc57449fc1f70208d3f4", "/_blob/edaf69952e782a1782b62dd0cfff59d8"),
             ("شاعرِ غزل", "استادِ سخن"), ("color: #D6D8FF;\">شیراز · قرن هشتم", "color: #FFE0D8;\">شیراز · قرن هفتم"),
             ("بازی با بیت‌های حافظ", "بازی با بیت‌های سعدی"), ("فقط از حافظ", "فقط از سعدی"),
             ("الا یا ایها الساقی ادر کاسا و ناولها", "ای ساربان آهسته رو کآرام جانم می‌رود"),
             ("صلاح کار کجا و من خراب کجا", "من بی مایه که باشم که خریدار تو باشم"),
             ("اگر آن ترک شیرازی به دست آرد دل ما را", "امشب سبکتر می‌زنند این طبل بی‌هنگام را")]:
    assert a in s, a
    s = s.replace(a, b)
s = re.sub(r">حافظ</div>", ">سعدی</div>", s, count=1)
s = re.sub(r"(-webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;\">)[^<]*", r"\1مشرف‌الدین مصلح سعدی شیرازی، استاد سخن و نویسنده‌ی گلستان و بوستانه. سال‌ها سفر کرد و بعد به شیراز برگشت. نثرش ساده و شیرینه و غزل‌هاش عاشقانه؛ خیلی از ضرب‌المثل‌های فارسی از سعدیه.", s, count=1)
s = re.sub(r"<title>[^<]*</title>", "<title>صفحه‌ی شاعر: چند کتاب</title>", s, count=1)
wr("PoetMany.dc.html", s)
print("poet books")
