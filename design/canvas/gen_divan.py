"""«دیوان من» page (search + group by poet), linked from the profile. Run before apply_fonts."""
import os, re, sys
P = sys.argv[1]
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

prof = rd("Profile.dc.html")
head = prof[:prof.index('<div dir="rtl"')]
tail = prof[prof.index("</x-dc>"):]
nav = re.search(r'  <nav aria-label="تب‌ها".*?</nav>\n', prof, flags=re.S).group(0)
back = re.search(r'<a href="Inbox.dc.html" aria-label="برگشت".*?</a>', rd("Direct.dc.html"), flags=re.S).group(0).replace("Inbox.dc.html", "Profile.dc.html")

B = "/_blob/"
POETS = [("حافظ", "05993349bc76fc57449fc1f70208d3f4", "#2F35F5", 12), ("سعدی", "edaf69952e782a1782b62dd0cfff59d8", "#FF4D24", 8),
         ("مولانا", "2a4c917d315ec35f181197f163478728", "#FF3D8B", 7), ("خیام", "9d8e9b659748d432ee291ddec65a3909", "#14112B", 5),
         ("فروغ", "44edbbc3105b023278f424a6f8a15f7e", "#1C20B8", 3), ("سهراب", "f75bd8401ea05cc70c966c1c693634c7", "#FF4D24", 3)]
def face(blob, bg, size):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: 2px solid #FFFFFF; overflow: hidden;"><img src="{B}{blob}" alt="" style="width: 100%; height: 100%; display: block;"></span>'

SEARCH = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4660" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></svg>'
LOCK = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>'
SAVED = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#2F35F5" stroke="#2F35F5" stroke-width="2" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>'

seg_items = [("شاعر", True), ("موضوع", False), ("تازه‌ترین", False)]
seg = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex: 1; text-decoration: none; text-align: center; padding: 7px 0; border-radius: 12px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#2F35F5" if on else "transparent"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>' for t, on in seg_items)

chips = ['<a href="#" aria-pressed="true" style="flex-shrink: 0; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; height: 40px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; background: #14112B; color: #FFFFFF; font-size: 13px; font-weight: 700;">همه <span style="opacity: 0.7;">۳۸</span></a>']
for n, blob, bg, c in POETS:
    chips.append(f'<a href="#" aria-pressed="false" style="flex-shrink: 0; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; height: 40px; box-sizing: border-box; padding: 0 12px 0 4px; border-radius: 999px; background: #FFFFFF; color: #14112B; font-size: 13px; font-weight: 500; box-shadow: 0 2px 6px rgba(20,17,43,0.06);">{face(blob, bg, 32)}{n} <span style="color: #8A8698;">{"۰۱۲۳۴۵۶۷۸۹"[c] if c < 10 else "۱" + "۰۱۲۳۴۵۶۷۸۹"[c - 10]}</span></a>')

def card(a, b, meta):
    return f'''      <a href="Poem.dc.html" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 6px; background: #FFFFFF; border-radius: 20px; padding: 12px 16px 10px; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">
        <span style="display: flex; flex-direction: column; font-family: 'Parastoo', serif; font-size: 16px; line-height: 1.8;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></span>
        <span style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #8A8698;"><span>{meta}</span>{SAVED}</span>
      </a>
'''
def section(name, blob, bg, count, cards):
    return f'''    <section aria-label="{name}" style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">{face(blob, bg, 30)}<span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1; padding-top: 3px;">{name}</span><span style="font-size: 12px; color: #4A4660;">{count} بیت</span><a href="#" style="margin-inline-start: auto; font-size: 13px; font-weight: 700; text-decoration: none;">همه</a></div>
{cards}    </section>
'''
hafez = section("حافظ", POETS[0][1], POETS[0][2], "۱۲",
    card("بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را", "غزل ۳ · دیروز") +
    card("الا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول ولی افتاد مشکل‌ها", "غزل ۱ · هفته‌ی پیش"))
saadi = section("سعدی", POETS[1][1], POETS[1][2], "۸",
    card("ای ساربان آهسته رو کآرام جانم می‌رود", "وان دل که با خود داشتم با دلستانم می‌رود", "غزل ۲۰۷ · امروز"))

body = f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 50px 18px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
  <div style="display: flex; align-items: center; gap: 12px;">
    {back}
    <div style="display: flex; align-items: baseline; gap: 8px; flex-grow: 1;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1;">دیوانِ من</span><span style="font-size: 13px; color: #4A4660;">۳۸ بیت</span></div>
    <a href="Privacy.dc.html" style="text-decoration: none; display: inline-flex; align-items: center; gap: 5px; height: 32px; box-sizing: border-box; padding: 0 11px; border-radius: 999px; background: #FFFFFF; color: #4A4660; font-size: 12px; font-weight: 700;">{LOCK}فقط خودم</a>
  </div>
  <label style="display: flex; align-items: center; gap: 10px; height: 48px; box-sizing: border-box; padding: 0 16px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.06);">{SEARCH}<span style="font-size: 14px; color: #8A8698;">توی دیوانت بگرد: یه کلمه، یه شاعر…</span></label>
  <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 13px; font-weight: 700; color: #4A4660; flex-shrink: 0;">دسته‌بندی:</span><div role="group" aria-label="دسته‌بندی" style="flex-grow: 1; display: flex; gap: 4px; background: #E6E3EC; border-radius: 14px; padding: 4px;">{seg}</div></div>
  <div style="display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px; padding: 0 18px 2px;">{"".join(chips)}</div>
  <div style="display: flex; flex-direction: column; gap: 18px; -webkit-mask-image: linear-gradient(180deg, #000 80%, transparent 100%); mask-image: linear-gradient(180deg, #000 80%, transparent 100%);">
{hafez}{saadi}  </div>
{nav}</div>
'''
wr("Divan.dc.html", re.sub(r"<title>[^<]*</title>", "<title>دیوان من</title>", head, count=1) + body + tail)

# profile: «دیوانِ من» heading and its count open the page
p2 = prof.replace('<span style="font-size: 15px; font-weight: 700;">دیوانِ من</span><a href="#" style="font-size: 13px; font-weight: 700; text-decoration: none;">۳۸ بیت</a>',
                  '<a href="Divan.dc.html" style="font-size: 15px; font-weight: 700; color: #14112B; text-decoration: none;">دیوانِ من</a><a href="Divan.dc.html" style="font-size: 13px; font-weight: 700; text-decoration: none;">همه‌ی ۳۸ بیت</a>')
assert p2 != prof or "Divan.dc.html" in prof
wr("Profile.dc.html", p2)
print("divan")
