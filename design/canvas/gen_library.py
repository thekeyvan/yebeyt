"""Library path: Explore → همه‌ی کتاب‌ها (Library) → یه کتاب (Book) → فهرست غزل‌ها (BookSection) → خوندن غزل (Poem).
Run after gen_shared, before apply_fonts. Patches Explore and Poet links."""
import os, re, sys
P = sys.argv[1]
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

ex = rd("Explore.dc.html")
nav = re.search(r'  <nav aria-label="تب‌ها".*?</nav>\n', ex, flags=re.S).group(0)
tail = ex[ex.index("</x-dc>"):]
def head_for(title):
    return re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", ex[:ex.index('<div dir="rtl"')], count=1)
back_tpl = re.search(r'<a href="Inbox.dc.html" aria-label="برگشت".*?</a>', rd("Direct.dc.html"), flags=re.S).group(0)
back = lambda href: back_tpl.replace("Inbox.dc.html", href)
FRAME = "position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;"
FADE = "-webkit-mask-image: linear-gradient(180deg, #000 80%, transparent 100%); mask-image: linear-gradient(180deg, #000 80%, transparent 100%);"

def book_svg(cover, mark, uid, width="100%"):
    return f'''<svg aria-hidden="true" width="{width}" viewBox="0 0 112 158" style="display: block; overflow: visible;">
          <defs><pattern id="lb{uid}" width="3" height="4" patternUnits="userSpaceOnUse"><rect width="3" height="4" fill="#FBF8F1"></rect><rect x="2" width="1" height="4" fill="#E2DCCF"></rect></pattern></defs>
          <ellipse cx="58" cy="151" rx="50" ry="5" fill="rgba(20,17,43,0.16)"></ellipse>
          <path d="M2 12 L14 5 L14 147 L2 141 Z" fill="url(#lb{uid})"></path>
          <rect x="12" y="3" width="98" height="146" rx="4" fill="{cover}"></rect>
          <rect x="94" y="3" width="16" height="146" rx="4" fill="rgba(0,0,0,0.2)"></rect>
          <rect x="91" y="3" width="1.6" height="146" fill="rgba(255,255,255,0.35)"></rect>
          <path d="M52 56 C64 66 64 86 52 96 C40 86 40 66 52 56 Z" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.4"></path>
          <path d="M30 140 v16 l5 -4 l5 4 v-16z" fill="{mark}"></path>
        </svg>'''
CLAMP2 = "display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"
def book_tile(title, poet, cover, mark, uid, href="Book.dc.html"):
    return f'''      <a href="{href}" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 6px; min-width: 0;">
        {book_svg(cover, mark, uid)}
        <span style="font-family: 'Lalezar', sans-serif; font-size: 15px; line-height: 1.3; {CLAMP2}">{title}</span>
        <span style="font-size: 12px; color: #4A4660; margin-top: -4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{poet}</span>
      </a>
'''
SEARCH = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4660" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>'
def search(ph):
    return f'<label style="display: flex; align-items: center; gap: 10px; height: 48px; flex-shrink: 0; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">{SEARCH}<span style="font-size: 14px; color: #8A8698;">{ph}</span></label>'
def chips(items):
    return '<div style="display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px; padding: 0 18px 2px; flex-shrink: 0;">' + "".join(
        f'<a href="#" aria-pressed="{"true" if i == 0 else "false"}" style="flex-shrink: 0; text-decoration: none; height: 34px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 13px; border-radius: 999px; font-size: 13px; font-weight: {700 if i == 0 else 500}; background: {"#14112B" if i == 0 else "#FFFFFF"}; color: {"#FFFFFF" if i == 0 else "#14112B"};">{t}</a>'
        for i, t in enumerate(items)) + "</div>"
def progress(pct, color="#2F35F5"):
    return f'<span aria-hidden="true" style="display: block; height: 6px; border-radius: 3px; background: #E6E3EC; overflow: hidden;"><span style="display: block; width: {pct}%; height: 100%; background: {color}; border-radius: 3px;"></span></span>'

# ---------------- Library: همه‌ی کتاب‌ها ----------------
BOOKS = [("دیوان حافظ", "حافظ", "#2F35F5", "#FF3D8B"), ("گلستان", "سعدی", "#FF4D24", "#FFB703"), ("بوستان", "سعدی", "#6CCB3A", "#2F35F5"),
         ("مثنوی معنوی", "مولانا", "#FFB703", "#2F35F5"), ("غزلیات شمس تبریزی (دیوان کبیر)", "مولانا", "#FF3D8B", "#FFB703"), ("شاهنامه", "فردوسی", "#14112B", "#FF4D24"),
         ("رباعیات", "خیام", "#1C20B8", "#6CCB3A"), ("منطق‌الطیر", "عطار", "#FF4D24", "#14112B"), ("خسرو و شیرین", "نظامی", "#2F35F5", "#FFB703")]
grid = "".join(book_tile(t, p, c, m, i) for i, (t, p, c, m) in enumerate(BOOKS))
library = head_for("کتابخونه") + f'''<div dir="rtl" style="{FRAME}">
  <div style="display: flex; align-items: center; gap: 12px;">
    {back("Explore.dc.html")}
    <div style="display: flex; flex-direction: column;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1;">کتابخونه</span><span style="font-size: 12px; color: #4A4660;">۱۲۰ کتاب از ۴۸ شاعر</span></div>
  </div>
  {search("کتاب یا شاعر…")}
  <a href="Book.dc.html" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border-radius: 20px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.06); flex-shrink: 0;">
    <span style="width: 34px; flex-shrink: 0;">{book_svg("#2F35F5", "#FF3D8B", "c", "34")}</span>
    <span style="display: flex; flex-direction: column; gap: 5px; flex-grow: 1; min-width: 0;"><span style="font-size: 12px; color: #4A4660;">ادامه بده</span><span style="font-size: 14px; font-weight: 700;">دیوان حافظ · غزل ۳</span>{progress(4)}</span>
  </a>
  {chips(["همه", "دیوان‌ها", "مثنوی و داستان", "رباعی", "نثر و حکایت", "معاصر"])}
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 14px; padding-bottom: 120px; {FADE}">
{grid}  </div>
{nav}</div>
''' + tail
wr("Library.dc.html", library)

# ---------------- Book: دیوان حافظ ----------------
HAFEZ = "/_blob/05993349bc76fc57449fc1f70208d3f4"
DICE = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"></rect><circle cx="9" cy="9" r="1.3" fill="currentColor"></circle><circle cx="15" cy="15" r="1.3" fill="currentColor"></circle><circle cx="15" cy="9" r="1.3" fill="currentColor"></circle><circle cx="9" cy="15" r="1.3" fill="currentColor"></circle></svg>'
SAVE = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>'
CHEV = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8698" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>'
SECTIONS = [("غزلیات", "۴۹۵ غزل", "BookSection.dc.html", 1), ("قصاید", "۵ قصیده", "#", 0), ("مثنوی‌ها", "۲ مثنوی", "#", 0),
            ("ساقی‌نامه", "۱", "#", 0), ("قطعات", "۴۲ قطعه", "#", 0), ("رباعیات", "۴۲ رباعی", "#", 0)]
sec_rows = "".join(f'''      <a href="{href}" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 10px; padding: 13px 4px;{"" if i == len(SECTIONS) - 1 else " border-bottom: 1px solid #F1EFEA;"}"><span style="font-size: 15px; font-weight: 700;">{n}</span><span style="font-size: 12px; color: #8A8698;">{c}</span>{'<span style="font-size: 11px; font-weight: 700; color: #2F35F5; background: #E8E9FF; border-radius: 999px; padding: 2px 8px;">داری می‌خونی</span>' if reading else ""}<span style="margin-inline-start: auto; display: flex;">{CHEV}</span></a>
''' for i, (n, c, href, reading) in enumerate(SECTIONS))
book = head_for("دیوان حافظ") + f'''<div dir="rtl" style="{FRAME}">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    {back("Library.dc.html")}
    <a href="#" aria-label="نگه داشتن کتاب" style="width: 44px; height: 44px; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; color: #14112B; box-shadow: 0 2px 8px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center;">{SAVE}</a>
  </div>
  <div style="display: flex; gap: 16px; align-items: flex-end; flex-shrink: 0;">
    <span style="width: 112px; flex-shrink: 0; transform: rotate(-3deg);">{book_svg("#2F35F5", "#FF3D8B", "h")}</span>
    <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0; padding-bottom: 8px;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.15;">دیوان حافظ</span>
      <a href="Poet.dc.html" style="align-self: flex-start; text-decoration: none; color: #14112B; display: inline-flex; align-items: center; gap: 6px; background: #FFFFFF; border-radius: 999px; padding: 3px 12px 3px 4px; font-size: 13px; font-weight: 700;"><span aria-hidden="true" style="width: 26px; height: 26px; border-radius: 50%; background: #2F35F5; overflow: hidden;"><img src="{HAFEZ}" alt="" style="width: 100%; height: 100%; display: block;"></span>حافظ</a>
      <span style="font-size: 12px; color: #4A4660;">قرن هشتم · ۵۷۳ شعر · با خوانش</span>
    </div>
  </div>
  <div style="display: flex; gap: 8px; flex-shrink: 0;">
    <a href="Poem.dc.html" style="flex: 1; text-decoration: none; display: flex; flex-direction: column; gap: 6px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; border-radius: 20px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(47,53,245,0.28);"><span style="font-size: 15px; font-weight: 700;">ادامه: غزل ۳</span><span aria-hidden="true" style="display: block; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.3);"><span style="display: block; width: 4%; height: 100%; background: #FFFFFF; border-radius: 3px;"></span></span></a>
    <a href="Poem.dc.html" style="text-decoration: none; display: flex; align-items: center; gap: 6px; background: #FFFFFF; color: #14112B; border-radius: 20px; padding: 0 14px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 8px rgba(20,17,43,0.08);">{DICE}یه غزل تصادفی</a>
  </div>
  <p style="margin: 0; font-size: 13px; line-height: 1.9; color: #4A4660; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex-shrink: 0;">مشهورترین دیوان شعر فارسی؛ بیشتر غزل، با زبانی که هم رندانه‌ست هم عاشقانه. خیلی‌ها هنوز باهاش فال می‌گیرن و هر بیتش رو چند جور می‌شه خوند.</p>
  <section aria-label="بخش‌های کتاب" style="display: flex; flex-direction: column; background: #FFFFFF; border-radius: 22px; padding: 2px 14px; box-shadow: 0 2px 10px rgba(20,17,43,0.06); {FADE}">
{sec_rows}  </section>
{nav}</div>
''' + tail
wr("Book.dc.html", book)

# ---------------- BookSection: فهرست غزل‌ها ----------------
GH = [(1, "الا یا ایها الساقی ادر کأسا و ناولها", "۷ بیت", "read"), (2, "صلاح کار کجا و من خراب کجا", "۸ بیت", "read"),
      (3, "اگر آن ترک شیرازی به دست آرد دل ما را", "۹ بیت", "now"), (4, "صبا به لطف بگو آن غزال رعنا را", "۷ بیت", ""),
      (5, "دل می‌رود ز دستم صاحب‌دلان خدا را", "۱۳ بیت", ""), (6, "به ملازمان سلطان که رساند این دعا را", "۸ بیت", ""),
      (7, "صوفی بیا که آینه صافیست جام را", "۱۰ بیت", "")]
FA = "۰۱۲۳۴۵۶۷۸۹"
CHECK = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6CCB3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
def gh_row(n, first, beyts, state):
    now = state == "now"
    bg = "#E8E9FF" if now else "#FFFFFF"
    num_bg, num_fg = ("#2F35F5", "#FFFFFF") if now else ("#F1EFEA", "#14112B")
    tag = '<span style="font-size: 11px; font-weight: 700; color: #2F35F5;">داری می‌خونی</span>' if now else (f'<span style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #3E9A1E; font-weight: 700;">{CHECK}خوندی</span>' if state == "read" else "")
    return f'''    <a href="Poem.dc.html" style="text-decoration: none; color: #14112B; display: flex; align-items: center; gap: 12px; background: {bg}; border-radius: 18px; padding: 10px 12px; box-shadow: 0 2px 8px rgba(20,17,43,0.05);">
      <span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 12px; background: {num_bg}; color: {num_fg}; display: flex; align-items: center; justify-content: center; font-family: 'Lalezar', sans-serif; font-size: 16px; padding-top: 3px; box-sizing: border-box;">{"".join(FA[int(d)] for d in str(n))}</span>
      <span style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex-grow: 1;"><span style="font-family: 'Parastoo', serif; font-size: 16px; line-height: 1.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{first}</span><span style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #8A8698;">{beyts}{tag}</span></span>
    </a>
'''
seg = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 7px 0; border-radius: 12px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "transparent"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in [("شماره", True), ("حرف آخر", False), ("پرخواننده", False)])
section = head_for("غزلیات حافظ") + f'''<div dir="rtl" style="{FRAME}">
  <div style="display: flex; align-items: center; gap: 12px;">
    {back("Book.dc.html")}
    <div style="display: flex; flex-direction: column;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1;">غزلیات</span><span style="font-size: 12px; color: #4A4660;">دیوان حافظ · ۴۹۵ غزل · ۲ تا خوندی</span></div>
  </div>
  {search("یه کلمه یا شماره‌ی غزل…")}
  <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;"><span style="font-size: 13px; font-weight: 700; color: #4A4660; flex-shrink: 0;">ترتیب:</span><div role="group" aria-label="ترتیب" style="flex-grow: 1; display: flex; gap: 4px; background: #E6E3EC; border-radius: 14px; padding: 4px;">{seg}</div></div>
  <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 120px; {FADE}">
{"".join(gh_row(*g) for g in GH)}  </div>
{nav}</div>
''' + tail
wr("BookSection.dc.html", section)

# ---------------- wire the way in ----------------
BOOK_A = '<a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 6px; min-width: 0;">'
ex = ex.replace(BOOK_A, BOOK_A.replace('href="#"', 'href="Book.dc.html"'))
ex = ex.replace('<a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه‌ی کتاب‌ها</a>', '<a href="Library.dc.html" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه‌ی کتاب‌ها</a>')
assert "Library.dc.html" in ex and "Book.dc.html" in ex
wr("Explore.dc.html", ex)
po = rd("Poet.dc.html")
po = po.replace('<a href="#" style="text-decoration: none; color: #14112B; flex: 1; text-align: center; background: #FFFFFF; border-radius: 16px; padding: 10px 4px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(20,17,43,0.10);">غزلیات</a>',
                '<a href="BookSection.dc.html" style="text-decoration: none; color: #14112B; flex: 1; text-align: center; background: #FFFFFF; border-radius: 16px; padding: 10px 4px; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(20,17,43,0.10);">غزلیات</a>', 1)
wr("Poet.dc.html", po)
print("library")
