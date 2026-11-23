"""Shared divan between two friends: its page, an entry in the chat header, and a row on «دیوان من».
Run after gen_names, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

direct = rd("Direct.dc.html")
head = re.sub(r"<title>[^<]*</title>", "<title>دیوان مشترک</title>", direct[:direct.index('<div dir="rtl"')], count=1)
tail = direct[direct.index("</x-dc>"):]
back = re.search(r'<a href="Inbox.dc.html" aria-label="برگشت".*?</a>', direct, flags=re.S).group(0).replace("Inbox.dc.html", "Direct.dc.html")

sara_svg = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
me_svg = re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', rd("Avatar.dc.html"), flags=re.S).group(0)
me_svg = re.sub(r'role="img" aria-label="[^"]*"', 'aria-hidden="true"', me_svg, count=1)
me_svg = re.sub(r'width="\d+" height="\d+"', 'width="100%" height="100%"', me_svg, count=1)
def uniq(svg, tag):
    ids = set(re.findall(r'id="([^"]+)"', svg))
    for i in ids:
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def face(svg, bg, size, tag, border=3):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; overflow: hidden; box-shadow: 0 2px 6px rgba(20,17,43,0.16);">{uniq(svg, tag)}</span>'
SARA_BG, ME_BG = "#FF3D8B", "#FFB703"

PLUS = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>'
LOCK = '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>'
HEART_ON = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#FF3D8B" stroke="#FF3D8B" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z"></path></svg>'
HEART_OFF = HEART_ON.replace('fill="#FF3D8B" stroke="#FF3D8B"', 'fill="none" stroke="#14112B"')
BOOK = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path></svg>'

chips = "".join(f'<a href="#" aria-pressed="{"true" if on else "false"}" style="flex-shrink: 0; text-decoration: none; height: 34px; box-sizing: border-box; display: inline-flex; align-items: center; padding: 0 13px; border-radius: 999px; font-size: 13px; font-weight: {700 if on else 500}; background: {"#14112B" if on else "#FFFFFF"}; color: {"#FFFFFF" if on else "#14112B"};">{t}</a>'
                for t, on in [("همه", True), ("از سارا", False), ("از من", False), ("حافظ", False), ("سعدی", False), ("مولانا", False)])

def entry(who_svg, who_bg, tag, who, when, a, b, poet, note=None, liked_by=None, liked_on=True):
    note_html = f'<div style="align-self: flex-start; max-width: 85%; background: #FFF1F6; color: #14112B; border-radius: 4px 16px 16px 16px; padding: 6px 12px; font-size: 13px; line-height: 1.6;">{note}</div>' if note else ""
    like = f'<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #4A4660;">{HEART_ON if liked_on else HEART_OFF}{liked_by}</span>' if liked_by else ""
    return f'''    <article style="display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; border-radius: 22px; padding: 12px 16px 12px; box-shadow: 0 2px 10px rgba(20,17,43,0.07);">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #4A4660;">{face(who_svg, who_bg, 26, tag, 2)}<span><b style="color: #14112B;">{who}</b> اضافه کرد · {when}</span></div>
      {note_html}
      <a href="Poem.dc.html" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; font-family: 'Parastoo', serif; font-size: 17px; line-height: 1.85;"><span style="align-self: flex-start;">{a}</span><span style="align-self: flex-end;">{b}</span></a>
      <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 12px; color: #8A8698;">{poet}</span>{like}</div>
    </article>
'''
entries = (entry(sara_svg, SARA_BG, "e1", "سارا", "دیروز", "بده ساقی می باقی که در جنت نخواهی یافت", "کنار آب رکن آباد و گلگشت مصلا را", "حافظ · غزل ۳", note="یاد سفر شیراز افتادم", liked_by="تو پسندیدی")
         + entry(me_svg, ME_BG, "e2", "تو", "۳ روز پیش", "بنی آدم اعضای یکدیگرند", "که در آفرینش ز یک گوهرند", "سعدی · گلستان", liked_by="سارا پسندید")
         + entry(sara_svg, SARA_BG, "e3", "سارا", "هفته‌ی پیش", "بشنو این نی چون شکایت می‌کند", "از جدایی‌ها حکایت می‌کند", "مولانا · مثنوی", liked_by="۰", liked_on=False))

body = f'''<div dir="rtl" style="position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 18px 0; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;">
  <div style="display: flex; align-items: center; gap: 10px;">
    {back}
    <span style="display: flex; flex-shrink: 0;">{face(me_svg, ME_BG, 42, "h1")}<span style="margin-right: -14px; display: flex;">{face(sara_svg, SARA_BG, 42, "h2")}</span></span>
    <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0; padding-right: 4px;">
      <span style="font-family: 'Lalezar', sans-serif; font-size: 22px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">دیوان من و سارا</span>
      <span style="font-size: 12px; color: #4A4660;">۲۴ بیت · سارا ۱۳، تو ۱۱</span>
    </div>
    <a href="#" aria-label="یه بیت اضافه کن" style="width: 46px; height: 46px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 4px solid #FFFFFF; box-shadow: 0 3px 10px rgba(47,53,245,0.3); display: flex; align-items: center; justify-content: center;">{PLUS}</a>
  </div>
  <div style="align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.8); border-radius: 999px; padding: 4px 12px; font-size: 12px; color: #4A4660;">{LOCK}فقط تو و سارا می‌بینید</div>
  <div style="display: flex; gap: 8px; overflow-x: auto; margin: 0 -18px; padding: 0 18px 2px;">{chips}</div>
  <div style="display: flex; flex-direction: column; gap: 12px; -webkit-mask-image: linear-gradient(180deg, #000 82%, transparent 100%); mask-image: linear-gradient(180deg, #000 82%, transparent 100%);">
{entries}  </div>
</div>
'''
wr("SharedDivan.dc.html", head + body + tail)

# chat header: a way into the shared divan
link = f'''    <a href="SharedDivan.dc.html" aria-label="دیوان مشترک با سارا" style="text-decoration: none; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 40px; box-sizing: border-box; padding: 0 12px; border-radius: 999px; background: #FFFFFF; color: #2F35F5; box-shadow: 0 2px 8px rgba(20,17,43,0.1); font-size: 12px; font-weight: 700;">{BOOK}دیوان مشترک</a>
'''
anchor = '<div style="font-size: 12px; color: #4A4660;">آنلاین · لیگ غزل‌باز</div>\n    </div>\n'
if "SharedDivan.dc.html" not in direct:
    assert anchor in direct
    direct = direct.replace(anchor, anchor + link, 1)
    wr("Direct.dc.html", direct)

# «دیوان من»: list the shared divans under the poet chips
dv = rd("Divan.dc.html")
if "SharedDivan.dc.html" not in dv:
    row = f'''  <div style="display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 13px; font-weight: 700; color: #4A4660; flex-shrink: 0;">مشترک:</span>
    <a href="SharedDivan.dc.html" style="text-decoration: none; color: #14112B; display: inline-flex; align-items: center; gap: 6px; height: 38px; box-sizing: border-box; padding: 0 12px 0 4px; border-radius: 999px; background: #FFFFFF; font-size: 13px; font-weight: 700; box-shadow: 0 2px 6px rgba(20,17,43,0.06);">{face(sara_svg, SARA_BG, 30, "d1", 2)}با سارا <span style="color: #8A8698; font-weight: 500;">۲۴</span></a>
    <a href="#" aria-label="یه دیوان مشترک تازه" style="text-decoration: none; width: 38px; height: 38px; box-sizing: border-box; border-radius: 50%; border: 2px dashed #B9B4C6; color: #4A4660; display: flex; align-items: center; justify-content: center; font-size: 20px; line-height: 1;">+</a>
  </div>
'''
    marker = '  <div style="display: flex; flex-direction: column; gap: 18px; -webkit-mask-image'
    assert marker in dv
    dv = dv.replace(marker, row + marker, 1)
    wr("Divan.dc.html", dv)
print("shared")
