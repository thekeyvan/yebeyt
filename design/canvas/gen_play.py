"""The games themselves (row ۵): daily puzzle, guess the poet (+ answered), second misra, which book (wrong answer),
meaning match, listen, mosha'ere, live duel. Same chrome as جورچین بیت. Run after gen_invite, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "gameicons.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

jig = rd("JigsawE.dc.html")
def head(t):
    return re.sub(r"<title>[^<]*</title>", f"<title>{t}</title>", jig[:jig.index('<div dir="rtl"')], count=1)
tail = jig[jig.index("</x-dc>"):]
direct = rd("Direct.dc.html")
sara_svg = re.search(r'<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100".*?</svg>', direct, flags=re.S).group(0)
me_svg = re.search(r'<svg role="img" aria-label="چهره‌ی تو.*?</svg>', rd("Avatar.dc.html"), flags=re.S).group(0)
me_svg = re.sub(r'role="img" aria-label="[^"]*"', 'aria-hidden="true"', me_svg, count=1)
me_svg = re.sub(r'width="\d+" height="\d+"', 'width="100%" height="100%"', me_svg, count=1)
def uniq(svg, tag):
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{i}{tag}"').replace(f"url(#{i})", f"url(#{i}{tag})")
    return svg
def face(svg, bg, size, tag, border=3):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; overflow: hidden; box-shadow: 0 2px 6px rgba(20,17,43,0.16);">{uniq(svg, tag)}</span>'

B = "/_blob/"
POET = {"حافظ": ("05993349bc76fc57449fc1f70208d3f4", "#2F35F5"), "سعدی": ("edaf69952e782a1782b62dd0cfff59d8", "#FF4D24"),
        "مولانا": ("2a4c917d315ec35f181197f163478728", "#FF3D8B"), "عطار": ("580f1dbd75c8da96601fd6fc5c207644", "#14112B"),
        "خیام": ("9d8e9b659748d432ee291ddec65a3909", "#1C20B8")}
def portrait(name, size, border="3px solid #FFFFFF"):
    b, bg = POET[name]
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}; overflow: hidden; box-shadow: 0 2px 8px rgba(20,17,43,0.18);"><img src="{B}{b}" alt="" style="width: 100%; height: 100%; display: block;"></span>'

FA = "۰۱۲۳۴۵۶۷۸۹"
fa = lambda n: "".join(FA[int(d)] for d in str(n))
FRAME = "position: relative; width: 390px; height: 844px; box-sizing: border-box; padding: 56px 18px 26px; background-color: #F1EFEA; background-image: radial-gradient(#D9D5CE 1.2px, transparent 1.2px); background-size: 18px 18px; color: #14112B; font-family: 'Vazirmatn', sans-serif; display: flex; flex-direction: column; gap: 14px; overflow: hidden;"
X = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
CLOCK = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M9.5 2.5h5"></path></svg>'
POEM = "font-family: 'Parastoo', serif;"
def topbar(results, cur, total=10, timer="۰:۱۲", close="GamesE.dc.html", label=None):
    dots = ""
    for i in range(total):
        if i < len(results):
            dots += f'<span style="width: 14px; height: 14px; border-radius: 50%; background: {"#6CCB3A" if results[i] else "#FF4D24"};"></span>'
        elif i == cur:
            dots += '<span style="width: 18px; height: 18px; border-radius: 50%; background: #2F35F5; box-shadow: 0 0 0 3px #D6D8FF;"></span>'
        else:
            dots += '<span style="width: 14px; height: 14px; border-radius: 50%; background: #E6E3EC;"></span>'
    t = f'<span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; background: #FFFFFF; border-radius: 999px; padding: 6px 11px; font-weight: 700; font-size: 15px; box-shadow: 0 2px 8px rgba(20,17,43,0.14);">{CLOCK}{timer}</span>' if timer else ""
    return f'''  <div style="display: flex; align-items: center; gap: 12px;">
    <a href="{close}" aria-label="بستن" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center; color: #14112B;">{X}</a>
    <div role="img" aria-label="{label or f"سؤال {fa(cur + 1)} از {fa(total)}"}" style="flex-grow: 1; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-radius: 999px; padding: 7px 10px; box-shadow: 0 2px 8px rgba(20,17,43,0.12);">{dots}</div>
    {t}
  </div>
'''
def title(t, sub, pts=None, icon=None):
    p = f'<span style="flex-shrink: 0; background: #FFB703; color: #14112B; border: 4px solid #FFFFFF; border-radius: 999px; padding: 6px 14px 2px; font-family: \'Lalezar\', sans-serif; font-size: 22px; box-shadow: 0 3px 8px rgba(20,17,43,0.2); transform: rotate(-4deg);">{pts}</span>' if pts else ""
    return f'''  <div style="display: flex; align-items: center; gap: 12px;">
    {game_icon(icon, 50) if icon else ""}
    <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><span style="font-family: 'Lalezar', sans-serif; font-size: 30px; line-height: 1.1;">{t}</span><span style="font-size: 13px; color: #4A4660;">{sub}</span></div>
    {p}
  </div>
'''
def couplet_card(a, b, tag=None, tag_bg="#FF3D8B", size=20, extra=""):
    t = f'<span aria-hidden="true" style="position: absolute; top: -12px; left: 18px; background: {tag_bg}; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 2px 11px 0; font-family: \'Lalezar\', sans-serif; font-size: 14px; transform: rotate(-5deg); box-shadow: 0 2px 6px rgba(20,17,43,0.22); pointer-events: none;">{tag}</span>' if tag else ""
    return f'''  <div style="position: relative; display: flex; flex-direction: column; gap: 4px; background: #FFFFFF; border-radius: 26px; padding: 22px 20px 18px; box-shadow: 0 4px 14px rgba(20,17,43,0.10);">
    {t}<span style="align-self: flex-start; {POEM} font-size: {size}px; line-height: 1.9;">{a}</span><span style="align-self: flex-end; {POEM} font-size: {size}px; line-height: 1.9;">{b}</span>{extra}
  </div>
'''
BLANK = '<span style="display: inline-block; width: 150px; height: 30px; border-radius: 10px; border: 2px dashed #C9C5D3; vertical-align: middle;"></span>'
BULB = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"></path><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"></path></svg>'
SKIP = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6l-8 6 8 6zM6 6v12"></path></svg>'
def bottom(cta, href="#", hint="۵۰:۵۰", hint_cost="۲۰", skip=True):
    skip_btn = f'<a href="#" aria-label="رد کن" style="width: 58px; height: 58px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.14); display: flex; align-items: center; justify-content: center;">{SKIP}</a>' if skip else ""
    return f'''  <div style="margin-top: auto; display: flex; align-items: center; gap: 10px;">
    <a href="{href}" style="flex-grow: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; height: 58px; box-sizing: border-box; border-radius: 20px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 4px;">{cta}</a>
    {skip_btn}
    <a href="#" aria-label="راهنما: {hint}، {hint_cost} امتیاز" style="width: 58px; height: 58px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFB703; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #14112B; text-decoration: none;">{BULB}{hint}</a>
  </div>
'''
def page(key, t, body):
    wr(key, head(t) + f'<div dir="rtl" style="{FRAME}">\n' + body + "</div>\n" + tail)

# ---------------- ۵-۱ معمای امروز ----------------
def cell(ch, state, size=44):
    st = {"ok": ("#6CCB3A", "#14112B", "#6CCB3A"), "near": ("#FFB703", "#14112B", "#FFB703"), "no": ("#DAD6E2", "#4A4660", "#DAD6E2"),
          "fill": ("#FFFFFF", "#14112B", "#2F35F5"), "empty": ("#FFFFFF", "#14112B", "#DAD6E2"), "cur": ("#FFFFFF", "#14112B", "#2F35F5")}[state]
    bw = "3px" if state in ("fill", "cur", "empty") else "3px"
    glow = "box-shadow: 0 0 0 3px #D6D8FF;" if state == "cur" else ""
    return f'<span style="width: {size}px; height: {size + 6}px; box-sizing: border-box; border-radius: 12px; background: {st[0]}; color: {st[1]}; border: {bw} solid {st[2]}; {glow} display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700;">{ch}</span>'
def row(cells):
    return '<div style="display: flex; justify-content: center; gap: 8px;">' + "".join(cell(c, s) for c, s in cells) + "</div>"
def key(ch, state="", w=40):
    bg, fg, sh = {"": ("#FFFFFF", "#14112B", "0 2px 6px rgba(20,17,43,0.16)"), "used": ("#E6E3EC", "#B9B4C6", "none"),
                  "ok": ("#6CCB3A", "#14112B", "0 2px 6px rgba(20,17,43,0.16)"), "near": ("#FFB703", "#14112B", "0 2px 6px rgba(20,17,43,0.16)")}[state]
    return f'<a href="#" style="text-decoration: none; width: {w}px; height: 48px; box-sizing: border-box; border-radius: 12px; background: {bg}; color: {fg}; border: 3px solid {"#FFFFFF" if state != "used" else "#E6E3EC"}; box-shadow: {sh}; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700;">{ch}</a>'
FIRE = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M12 2c1 4 5 5.5 5 10.5A5 5 0 0 1 7 12.5c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 0-6 1-9z" fill="#FFFFFF"></path></svg>'
daily_body = f'''  <div style="display: flex; align-items: center; gap: 12px;">
    <a href="GamesE.dc.html" aria-label="بستن" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center; color: #14112B;">{X}</a>
    {game_icon("daily", 44)}
    <div style="flex-grow: 1; display: flex; flex-direction: column;"><span style="font-family: 'Lalezar', sans-serif; font-size: 24px; line-height: 1.1; padding-top: 3px;">معمای امروز</span><span style="font-size: 12px; color: #4A4660;">دوشنبه ۲ آذر · برای همه یکیه</span></div>
    <span style="display: inline-flex; align-items: center; gap: 4px; background: #FF4D24; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 4px 11px; font-weight: 700; font-size: 15px; box-shadow: 0 2px 8px rgba(20,17,43,0.18);">{FIRE}۷ روز</span>
  </div>
'''
daily_body += f'''  <div style="display: flex; flex-direction: column; gap: 6px; background: #2F35F5; color: #FFFFFF; border-radius: 26px; padding: 20px 20px 18px; box-shadow: 0 6px 16px rgba(47,53,245,0.28);">
    <span style="align-self: flex-start; {POEM} font-size: 20px; line-height: 1.9;">بده ساقی می باقی که در جنت نخواهی یافت</span>
    <span style="align-self: flex-end; {POEM} font-size: 20px; line-height: 1.9;">کنار آب رکن آباد و گلگشت <span style="display: inline-block; width: 64px; border-bottom: 3px dashed #FFB703;"></span> را</span>
    <span style="align-self: flex-start; font-size: 12px; color: #D6D8FF;">حافظ · یه کلمه‌ی ۴ حرفی</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    {row([("م", "ok"), ("ق", "no"), ("ا", "near"), ("م", "no")])}
    {row([("م", "fill"), ("ص", "fill"), ("", "cur"), ("", "empty")])}
    <div style="display: flex; justify-content: center; gap: 6px; font-size: 12px; color: #4A4660;"><span>فرصت:</span><span style="width: 10px; height: 10px; border-radius: 50%; background: #FF4D24; align-self: center;"></span><span style="width: 10px; height: 10px; border-radius: 50%; background: #2F35F5; align-self: center;"></span><span style="width: 10px; height: 10px; border-radius: 50%; background: #DAD6E2; align-self: center;"></span><span>سبز یعنی سر جاشه، زرد یعنی هست ولی جای دیگه</span></div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.6); border: 2px dashed #C9C5D3; border-radius: 22px; padding: 12px;">
    <div style="display: flex; justify-content: center; gap: 6px;">{key("ل")}{key("ا", "near")}{key("ر")}{key("ب")}{key("ق", "used")}{key("ن")}{key("ت")}</div>
    <div style="display: flex; justify-content: center; gap: 6px;">{key("م", "ok")}{key("ص")}{key("ز")}{key("ه")}{key("ش")}<a href="#" aria-label="پاک کن" style="text-decoration: none; width: 86px; height: 48px; box-sizing: border-box; border-radius: 12px; background: #FFFFFF; border: 3px solid #FFFFFF; box-shadow: 0 2px 6px rgba(20,17,43,0.16); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #FF4D24;">پاک کن</a></div>
  </div>
{bottom("بچسبون!", hint="یه حرف", hint_cost="۳۰", skip=False)}
'''
page("PlayDaily.dc.html", "معمای امروز", daily_body)

# ---------------- ۵-۲ حدس شاعر ----------------
def poet_opt(name, state=""):
    bd, bg, extra = {"": ("#FFFFFF", "#FFFFFF", ""), "sel": ("#2F35F5", "#FFFFFF", ""),
                     "ok": ("#6CCB3A", "#EEF9E7", '<span style="position: absolute; top: 8px; left: 8px; width: 24px; height: 24px; border-radius: 50%; background: #6CCB3A; border: 3px solid #FFFFFF; display: flex; align-items: center; justify-content: center;"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span>'),
                     "dim": ("#FFFFFF", "#FFFFFF", "")}[state]
    op = "opacity: 0.45;" if state == "dim" else ""
    return f'''<a href="#" aria-pressed="{"true" if state in ("sel", "ok") else "false"}" style="position: relative; text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 8px; background: {bg}; border: 4px solid {bd}; border-radius: 22px; padding: 14px 8px 10px; box-shadow: 0 3px 10px rgba(20,17,43,0.08); {op}">{portrait(name, 70)}<span style="font-size: 16px; font-weight: 700;">{name}</span>{extra}</a>'''
gp_q = couplet_card("بشنو این نی چون شکایت می‌کند", "از جدایی‌ها حکایت می‌کند")
gp_body = topbar([True, True, False], 3) + title("حدس شاعر", "شاعرِ این بیت کیه؟", "+۶۰", icon="poet") + gp_q + f'''  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
    {poet_opt("حافظ")}{poet_opt("سعدی")}{poet_opt("مولانا", "sel")}{poet_opt("عطار")}
  </div>
''' + bottom("همینه!", href="PlayPoetAnswer.dc.html")
page("PlayPoet.dc.html", "حدس شاعر", gp_body)

# ---------------- ۵-۳ حدس شاعر: جواب ----------------
BOOKI = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path></svg>'
SAVEI = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4-6 4z"></path></svg>'
SENDI = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"></path></svg>'
OK = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14112B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>'
NO = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
def sheet(ok, head_t, sub, label, meaning, src, cta="بعدی", href="#"):
    badge = (f'<span style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #6CCB3A; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.2); display: flex; align-items: center; justify-content: center;">{OK}</span>' if ok else
             f'<span style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FF4D24; border: 4px solid #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.2); display: flex; align-items: center; justify-content: center;">{NO}</span>')
    acts = "".join(f'<a href="{h}" style="flex: 1; text-decoration: none; color: #14112B; display: flex; flex-direction: column; align-items: center; gap: 4px; background: #F1EFEA; border-radius: 16px; padding: 10px 4px; font-size: 12px; font-weight: 700;">{i}{t}</a>' for t, i, h in [("کل شعر", BOOKI, "PoemScroll.dc.html"), ("نگه دار", SAVEI, "#"), ("بفرست", SENDI, "#")])
    return f'''  <div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,17,43,0.28);"></div>
  <section role="dialog" aria-label="{head_t}" style="position: absolute; right: 0; left: 0; bottom: 0; box-sizing: border-box; background: #FFFFFF; border-radius: 30px 30px 0 0; padding: 10px 20px 26px; box-shadow: 0 -6px 24px rgba(20,17,43,0.18); display: flex; flex-direction: column; gap: 12px;">
    <div aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #DAD6E2;"></div>
    <div style="display: flex; align-items: center; gap: 12px;">{badge}<div style="display: flex; flex-direction: column;"><span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1.15; padding-top: 3px;">{head_t}</span><span style="font-size: 12px; color: #4A4660;">{sub}</span></div></div>
    <div style="display: flex; flex-direction: column; gap: 6px; background: #F7F5F0; border-radius: 18px; padding: 12px 14px;"><span style="font-size: 12px; font-weight: 700; color: #2F35F5;">{label}</span><span style="font-size: 14px; line-height: 1.85;">{meaning}</span><span style="font-size: 12px; color: #4A4660;">{src}</span></div>
    <div style="display: flex; gap: 8px;">{acts}</div>
    <a href="{href}" style="text-decoration: none; display: flex; align-items: center; justify-content: center; height: 56px; box-sizing: border-box; border-radius: 20px; background: #2F35F5; color: #FFFFFF; border: 4px solid #FFFFFF; box-shadow: 0 6px 16px rgba(47,53,245,0.3); font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 4px;">{cta}</a>
  </section>
'''
ga_body = topbar([True, True, False, True], 4) + title("حدس شاعر", "شاعرِ این بیت کیه؟", "+۹۰", icon="poet") + gp_q + f'''  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
    {poet_opt("حافظ", "dim")}{poet_opt("سعدی", "dim")}{poet_opt("مولانا", "ok")}{poet_opt("عطار", "dim")}
  </div>
''' + sheet(True, "آره، مولانا!", "+۳۰ · ۷ ثانیه", "یعنی چی؟", "به صدای نی گوش کن که از جدا شدن از نیستانش شکایت می‌کنه؛ نی همون آدمیه که از اصلش دور افتاده.", "مولانا · مثنوی معنوی · دفتر اول، بیت ۱", "سؤال بعدی", "PlaySecond.dc.html")
page("PlayPoetAnswer.dc.html", "حدس شاعر: جواب", ga_body)

# ---------------- ۵-۴ مصراع دوم ----------------
def misra_opt(t, state=""):
    bd, bg, fg = {"": ("#FFFFFF", "#FFFFFF", "#14112B"), "sel": ("#2F35F5", "#2F35F5", "#FFFFFF")}[state]
    return f'<a href="#" aria-pressed="{"true" if state else "false"}" style="text-decoration: none; color: {fg}; display: flex; align-items: center; gap: 12px; background: {bg}; border: 3px solid {bd}; border-radius: 20px; padding: 14px 16px; box-shadow: 0 3px 10px rgba(20,17,43,0.08); {POEM} font-size: 18px; line-height: 1.6;">{t}</a>'
sec_body = topbar([True, True, False, True, True], 5, timer="۰:۰۹") + title("مصراع دوم", "ادامه‌ی این بیت کدومه؟", "+۱۵۰", icon="misra") + couplet_card("بنی آدم اعضای یکدیگرند", BLANK, "سعدی", "#FF3D8B") + f'''  <div style="display: flex; flex-direction: column; gap: 10px;">
    {misra_opt("که از جان و دل یار یکدیگرند")}
    {misra_opt("که در آفرینش ز یک گوهرند", "sel")}
    {misra_opt("که در هر دو گیتی برادرترند")}
  </div>
''' + bottom("همینه!")
page("PlaySecond.dc.html", "مصراع دوم", sec_body)

# ---------------- ۵-۵ از کدوم کتاب؟ (wrong answer) ----------------
def book_tile(t, cover, mark, state=""):
    ring = {"": "", "ok": "outline: 4px solid #6CCB3A; outline-offset: 4px;", "no": "outline: 4px solid #FF4D24; outline-offset: 4px;"}[state]
    lab = {"": "#14112B", "ok": "#3E9A1E", "no": "#FF4D24"}[state]
    return f'''<a href="#" style="flex: 1; min-width: 0; text-decoration: none; color: {lab}; display: flex; flex-direction: column; align-items: center; gap: 10px; {"transform: rotate(-3deg);" if state == "no" else ""}">
        <svg aria-hidden="true" width="86" viewBox="0 0 112 158" style="display: block; overflow: visible; border-radius: 6px; {ring}"><ellipse cx="58" cy="151" rx="50" ry="5" fill="rgba(20,17,43,0.16)"></ellipse><path d="M2 12 L14 5 L14 147 L2 141 Z" fill="#FBF8F1"></path><rect x="12" y="3" width="98" height="146" rx="4" fill="{cover}"></rect><rect x="94" y="3" width="16" height="146" rx="4" fill="rgba(0,0,0,0.2)"></rect><path d="M52 56 C64 66 64 86 52 96 C40 86 40 66 52 56 Z" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.4"></path><path d="M30 140 v16 l5 -4 l5 4 v-16z" fill="{mark}"></path></svg>
        <span style="font-family: 'Lalezar', sans-serif; font-size: 16px; line-height: 1.25; text-align: center;">{t}</span></a>'''
book_q = couplet_card("بشنو این نی چون شکایت می‌کند", "از جدایی‌ها حکایت می‌کند", extra=f'<span style="align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; background: #F1EFEA; border-radius: 999px; padding: 3px 12px 3px 4px; font-size: 13px; font-weight: 700; margin-top: 6px;">{portrait("مولانا", 26, "2px solid #FFFFFF")}مولانا</span>')
book_body = topbar([True, False, True], 3, timer="۰:۰۴") + title("از کدوم کتاب؟", "این بیت از کدوم کتابِ مولاناست؟", "+۹۰", icon="book") + book_q + f'''  <div style="display: flex; gap: 12px; padding: 4px 6px 0;">
      {book_tile("مثنوی معنوی", "#FFB703", "#2F35F5", "ok")}{book_tile("دیوان شمس", "#FF3D8B", "#FFB703", "no")}{book_tile("فیه ما فیه", "#1C20B8", "#6CCB3A")}
  </div>
''' + sheet(False, "نه، از مثنوی بود", "این یکی رو حساب نکردیم", "چطوری بفهمی؟", "مثنوی رو از مصراع‌هاش می‌شناسی: هر بیت قافیه‌ی خودش رو داره (می‌کند / می‌کند). دیوان شمس بیشتر غزله و همه‌ی بیت‌ها یه قافیه دارن.", "مولانا · مثنوی معنوی · دفتر اول، بیت ۱", "سؤال بعدی")
page("PlayBook.dc.html", "از کدوم کتاب؟", book_body)

# ---------------- ۵-۶ معنی‌یاب ----------------
def wchip(t, state="", poem=True):
    bg, fg, bd = {"": ("#FFFFFF", "#14112B", "#FFFFFF"), "sel": ("#2F35F5", "#FFFFFF", "#FFFFFF"), "ok": ("#EEF9E7", "#3E9A1E", "#6CCB3A")}[state]
    f = f"{POEM} font-size: 18px;" if poem else "font-size: 13px; font-weight: 500;"
    return f'<a href="#" style="text-decoration: none; display: flex; align-items: center; justify-content: center; min-height: 48px; box-sizing: border-box; padding: 6px 12px; border-radius: 16px; background: {bg}; color: {fg}; border: 3px solid {bd}; box-shadow: 0 2px 8px rgba(20,17,43,0.08); {f} text-align: center; line-height: 1.5;">{t}</a>'
match_body = topbar([True, True], 2, total=5, timer=None, label="جفت ۳ از ۵") + title("معنی‌یاب", "هر واژه رو به معنیش وصل کن", "+۴۰", icon="match") + f'''  <div style="display: flex; flex-direction: column; gap: 4px; background: #FFFFFF; border-radius: 22px; padding: 14px 18px; box-shadow: 0 3px 10px rgba(20,17,43,0.08);">
    <span style="align-self: flex-start; {POEM} font-size: 17px; line-height: 1.9;">بده <u style="text-decoration-style: dotted; text-decoration-color: #2F35F5; text-underline-offset: 6px;">ساقی</u> <u style="text-decoration-style: dotted; text-decoration-color: #2F35F5; text-underline-offset: 6px;">می باقی</u> که در <u style="text-decoration-style: dotted; text-decoration-color: #2F35F5; text-underline-offset: 6px;">جنت</u> نخواهی یافت</span>
    <span style="align-self: flex-end; {POEM} font-size: 17px; line-height: 1.9;">کنار آب رکن آباد و <u style="text-decoration-style: dotted; text-decoration-color: #2F35F5; text-underline-offset: 6px;">گلگشت</u> <u style="text-decoration-style: dotted; text-decoration-color: #2F35F5; text-underline-offset: 6px;">مصلا</u> را</span>
  </div>
  <div style="position: relative; display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px 40px;">
    <svg aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;" viewBox="0 0 354 290" preserveAspectRatio="none"><path d="M228 24 C206 24 210 140 188 140" stroke="#6CCB3A" stroke-width="3" fill="none" stroke-linecap="round"></path><path d="M228 82 L188 82" stroke="#6CCB3A" stroke-width="3" fill="none" stroke-linecap="round"></path></svg>
    {wchip("ساقی", "ok")}{wchip("گردشگاه", "", False)}
    {wchip("جنت", "ok")}{wchip("بهشت", "ok", False)}
    {wchip("می باقی", "")}{wchip("کسی که شراب می‌ریزه", "ok", False)}
    {wchip("گلگشت", "sel")}{wchip("جای نماز؛ اسم جایی در شیراز", "", False)}
    {wchip("مصلا", "")}{wchip("شرابی که مونده", "", False)}
  </div>
  <span style="text-align: center; font-size: 12px; color: #4A4660;">واژه رو بزن، بعد معنیش رو. اشتباه کنی، فقط تکون می‌خوره.</span>
'''
page("PlayMatch.dc.html", "معنی‌یاب", match_body)

# ---------------- ۵-۷ گوش کن ----------------
bars = "".join(f'<span style="width: 5px; height: {h}px; border-radius: 3px; background: {"#FFFFFF" if i < 14 else "rgba(255,255,255,0.35)"};"></span>' for i, h in enumerate([14,26,40,22,34,52,30,18,44,58,36,24,46,30,20,38,50,28,16,32,44,22,12,26]))
listen_body = topbar([True, True], 2, total=5, timer=None, label="سؤال ۳ از ۵") + title("گوش کن", "مصراع اول رو بشنو؛ دومی کدومه؟", "+۴۰", icon="listen") + f'''  <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; background: #14112B; color: #FFFFFF; border-radius: 28px; padding: 22px 18px 18px; box-shadow: 0 6px 18px rgba(20,17,43,0.28);">
    <a href="#" aria-label="مکث" style="width: 76px; height: 76px; box-sizing: border-box; border-radius: 50%; background: #2F35F5; border: 5px solid #FFFFFF; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 6px 16px rgba(47,53,245,0.4);"><span style="width: 7px; height: 26px; border-radius: 3px; background: #FFFFFF;"></span><span style="width: 7px; height: 26px; border-radius: 3px; background: #FFFFFF;"></span></a>
    <div aria-hidden="true" style="display: flex; align-items: center; gap: 4px; height: 60px;">{bars}</div>
    <div style="display: flex; align-items: center; gap: 10px; font-size: 12px; color: #B9B4C6;"><span>متن رو نمی‌بینی، فقط می‌شنوی</span><a href="#" style="text-decoration: none; color: #FFB703; font-weight: 700;">دوباره بشنو (۱)</a></div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 10px;">
    {misra_opt("کنار آب رکن آباد و گلگشت مصلا را")}
    {misra_opt("به خال هندویش بخشم سمرقند و بخارا را")}
    {misra_opt("چنان بردند صبر از دل که ترکان خوان یغما را")}
  </div>
  <span style="text-align: center; font-size: 12px; color: #4A4660;">سطح بعد: بعد از شنیدن، شاعرش رو بگو</span>
''' + bottom("همینه!", hint="یه کلمه", hint_cost="۲۰")
page("PlayListen.dc.html", "گوش کن", listen_body)

# ---------------- ۵-۸ مشاعره ----------------
def bub(a, b, who, mine, last_ch=None, poet=""):
    bg, fg, rad, al = ("#2F35F5", "#FFFFFF", "22px 6px 22px 22px", "flex-end") if mine else ("#FFFFFF", "#14112B", "6px 22px 22px 22px", "flex-start")
    if last_ch:
        b = b[:-1] + f'<b style="background: #FFB703; color: #14112B; border-radius: 6px; padding: 0 4px;">{b[-1]}</b>'
    return f'''    <div style="align-self: {al}; display: flex; flex-direction: column; gap: 4px; max-width: 84%;">
      <span style="font-size: 11px; color: #4A4660; align-self: {al};">{who}{(" · " + poet) if poet else ""}</span>
      <div style="display: flex; flex-direction: column; gap: 2px; background: {bg}; color: {fg}; border-radius: {rad}; padding: 10px 14px; box-shadow: 0 2px 8px rgba(20,17,43,0.10); {POEM} font-size: 15.5px; line-height: 1.8;"><span>{a}</span><span>{b}</span></div>
    </div>
'''
def cand(a, src, ok=True):
    return f'<a href="#" style="text-decoration: none; color: #14112B; display: flex; flex-direction: column; gap: 2px; background: #FFFFFF; border-radius: 16px; padding: 8px 12px; box-shadow: 0 2px 6px rgba(20,17,43,0.06);"><span style="{POEM} font-size: 15px; line-height: 1.6;"><b style="color: #2F35F5;">{a[0]}</b>{a[1:]}</span><span style="font-size: 11px; color: #8A8698;">{src}</span></a>'
mosh_body = f'''  <div style="display: flex; align-items: center; gap: 10px;">
    <a href="GamesE.dc.html" aria-label="بستن" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center; color: #14112B;">{X}</a>
    <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; gap: 10px; background: #FFFFFF; border-radius: 999px; padding: 4px 12px; box-shadow: 0 2px 8px rgba(20,17,43,0.12);">
      {face(me_svg, "#FFB703", 34, "m1", 2)}<span style="font-family: 'Lalezar', sans-serif; font-size: 20px; padding-top: 3px;">۴</span><span style="font-size: 11px; color: #8A8698;">در برابر</span><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; padding-top: 3px;">۳</span>{face(sara_svg, "#FF3D8B", 34, "m2", 2)}
    </div>
    <span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; background: #FFFFFF; border-radius: 999px; padding: 6px 11px; font-weight: 700; font-size: 13px; box-shadow: 0 2px 8px rgba(20,17,43,0.14);">{CLOCK}۲۱ ساعت</span>
  </div>
  <div style="display: flex; align-items: center; gap: 10px;">{game_icon("mosh", 44)}<span style="font-family: 'Lalezar', sans-serif; font-size: 26px; line-height: 1; padding-top: 3px;">مشاعره با سارا</span><span style="font-size: 12px; color: #4A4660;">دور ۸ · تا فردا</span></div>
  <div style="display: flex; flex-direction: column; gap: 10px; -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 40px); mask-image: linear-gradient(180deg, transparent 0, #000 40px); padding-top: 8px;">
{bub("الا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول ولی افتاد مشکل‌ها", "تو", True, poet="حافظ")}{bub("یاد باد آن که نهانت نظری با ما بود", "رقم مهر تو بر چهره‌ی ما پیدا بود", "سارا", False, True, "حافظ")}
  </div>
  <div style="display: flex; flex-direction: column; gap: 10px; margin-top: auto; background: rgba(255,255,255,0.7); border-radius: 26px 26px 0 0; padding: 14px 14px 0; margin-left: -18px; margin-right: -18px; margin-bottom: -26px; padding-bottom: 26px;">
    <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px; font-weight: 700;">نوبت توئه، با</span><span style="background: #FFB703; border: 3px solid #FFFFFF; border-radius: 10px; padding: 0 10px; font-family: 'Lalezar', sans-serif; font-size: 20px; padding-top: 3px; box-shadow: 0 2px 6px rgba(20,17,43,0.18);">د</span><span style="font-size: 14px; font-weight: 700;">شروع کن</span><a href="#" style="margin-inline-start: auto; text-decoration: none; font-size: 12px; font-weight: 700; color: #FF4D24;">کم آوردم</a></div>
    <label style="display: flex; align-items: center; gap: 10px; height: 46px; box-sizing: border-box; padding: 0 14px; border-radius: 14px; background: #FFFFFF; border: 2px solid #2F35F5;"><span style="{POEM} font-size: 16px;">دل</span><span style="width: 2px; height: 20px; background: #2F35F5;"></span><span style="font-size: 12px; color: #8A8698; margin-inline-start: auto;">بنویس یا از پیشنهادها بردار</span></label>
    <span style="font-size: 12px; font-weight: 700; color: #4A4660;">از دیوانت و کتابخونه</span>
    {cand("دل می‌رود ز دستم صاحب‌دلان خدا را", "حافظ · توی دیوانت")}
    {cand("دلا نزد کسی بنشین که او از دل خبر دارد", "مولانا")}
    <span style="font-size: 11.5px; color: #8A8698; text-align: center;">بیتی که خودت بنویسی رو با کتابخونه چک می‌کنیم؛ تکراری قبول نیست.</span>
  </div>
'''
page("PlayMosh.dc.html", "مشاعره", mosh_body)

# ---------------- ۵-۹ بازی رودررو ----------------
ROUNDS = [("ok", "me"), ("ok", "sara"), ("ok", "me"), ("cur", ""), ("", "")]
rdots = "".join(f'<span style="width: {30 if s == "cur" else 24}px; height: 8px; border-radius: 4px; background: {"#2F35F5" if s == "cur" else ("#FFB703" if w == "me" else ("#FF3D8B" if w == "sara" else "#E6E3EC"))};"></span>' for s, w in ROUNDS)
duel_body = f'''  <div style="display: flex; align-items: center; gap: 10px;">
    <a href="GamesE.dc.html" aria-label="بستن" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; background: #FFFFFF; box-shadow: 0 2px 8px rgba(20,17,43,0.18); display: flex; align-items: center; justify-content: center; color: #14112B;">{X}</a>
    {game_icon("duel", 40)}
    <span style="flex-grow: 1; font-family: 'Lalezar', sans-serif; font-size: 22px; padding-top: 3px;">بازی رودررو</span>
    <span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; background: #FF4D24; color: #FFFFFF; border: 3px solid #FFFFFF; border-radius: 999px; padding: 5px 12px; font-weight: 700; font-size: 15px; box-shadow: 0 2px 8px rgba(20,17,43,0.18);">۰:۰۸</span>
  </div>
  <div style="display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-radius: 26px; padding: 12px 16px; box-shadow: 0 3px 12px rgba(20,17,43,0.08);">
    <span style="display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; font-weight: 700;">{face(me_svg, "#FFB703", 54, "d1")}تو<span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1; color: #FFB703; -webkit-text-stroke: 1px #14112B;">۲</span></span>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><span style="font-family: 'Lalezar', sans-serif; font-size: 20px; line-height: 1; padding-top: 4px; color: #FF4D24;">در برابر</span><div style="display: flex; gap: 4px;">{rdots}</div><span style="font-size: 11px; color: #4A4660;">دور ۴ از ۵</span></div>
    <span style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; font-weight: 700;">{face(sara_svg, "#FF3D8B", 54, "d2")}سارا<span style="font-family: 'Lalezar', sans-serif; font-size: 28px; line-height: 1; color: #FF3D8B; -webkit-text-stroke: 1px #14112B;">۱</span><span style="position: absolute; top: -8px; right: -14px; background: #6CCB3A; color: #14112B; border: 3px solid #FFFFFF; border-radius: 999px; padding: 1px 8px; font-size: 10px; font-weight: 700; white-space: nowrap; transform: rotate(6deg);">جواب داد</span></span>
  </div>
  <span style="align-self: center; background: #14112B; color: #FFFFFF; border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 700;">این دور: مصراع دوم</span>
{couplet_card("توانا بود هر که دانا بود", BLANK, "فردوسی", "#14112B")}  <div style="display: flex; flex-direction: column; gap: 10px;">
    {misra_opt("ز دانش دل پیر برنا بود")}
    {misra_opt("به دانش دل مرد بینا بود")}
    {misra_opt("ز گفتار او جان شکیبا بود")}
  </div>
  <span style="text-align: center; font-size: 12px; color: #4A4660; margin-top: auto;">هر کی زودتر درست جواب بده، دور رو می‌بره. بعد از بازی، معنی همه‌ی بیت‌ها رو با هم می‌بینید.</span>
'''
page("PlayDuel.dc.html", "بازی رودررو", duel_body)
print("play")
