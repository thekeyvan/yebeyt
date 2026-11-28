"""Shared pieces for the empty-state and fal boards: the sticker illustrations and the empty block.
exec'd by gen_empty.py and gen_fal.py (like gameicons.py)."""

INK, LAPIS, FIRE, AMBER, GREEN, MAGENTA, DEEP = "#14112B", "#2F35F5", "#FF4D24", "#FFB703", "#6CCB3A", "#FF3D8B", "#1C20B8"
GREY, DASH = "#8A8698", "#C9C5D3"
SH = "box-shadow: 0 3px 10px rgba(20,17,43,0.18);"
SH_UP = "box-shadow: 0 12px 20px rgba(20,17,43,0.26);"

def at(x, y, inner, rot=0, z=1):
    """Place a piece in an art box (x from the left, y from the top)."""
    return f'<span aria-hidden="true" style="position: absolute; left: {x}px; top: {y}px; z-index: {z}; display: flex; transform: rotate({rot}deg);">{inner}</span>'

def disc(size, bg, inner="", border=4, shadow=SH):
    return f'<span style="width: {size}px; height: {size}px; box-sizing: border-box; border-radius: 50%; background: {bg}; border: {border}px solid #FFFFFF; {shadow} display: flex; align-items: center; justify-content: center;">{inner}</span>'

def tile(w, h, bg, inner="", r=16, border=4, shadow=SH):
    return f'<span style="width: {w}px; height: {h}px; box-sizing: border-box; border-radius: {r}px; background: {bg}; border: {border}px solid #FFFFFF; {shadow} display: flex; align-items: center; justify-content: center;">{inner}</span>'

def slot(w, h, r=14, inner="", color=DASH):
    """An empty place on the sticker sheet: where a sticker will go."""
    return f'<span style="width: {w}px; height: {h}px; box-sizing: border-box; border-radius: {r}px; border: 3px dashed {color}; display: flex; align-items: center; justify-content: center; color: {color}; font-family: \'Lalezar\', sans-serif; font-size: {max(14, h // 2)}px; padding-top: 3px;">{inner}</span>'

def word(t, bg=LAPIS, fg="#FFFFFF", size=20, shadow=SH):
    return f'<span style="background: {bg}; color: {fg}; border: 4px solid #FFFFFF; border-radius: 12px; padding: 0 12px 3px; font-family: \'ParastooB\', serif; font-size: {size}px; white-space: nowrap; {shadow}">{t}</span>'

def pill(t, bg=AMBER, fg=INK, size=13):
    return f'<span style="background: {bg}; color: {fg}; border: 3px solid #FFFFFF; border-radius: 999px; padding: 3px 11px; font-weight: 700; font-size: {size}px; white-space: nowrap; {SH}">{t}</span>'

def sv(path, size=26, color="#FFFFFF", sw=2.4, fill="none"):
    return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'

# line icons (24-unit paths)
I = {
    "bookmark": '<path d="M6 3.5h12v17l-6-4-6 4z"></path>',
    "search": '<circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path>',
    "plane": '<path d="M21 3L10 14"></path><path d="M21 3l-7 18-4-7-7-4z"></path>',
    "plus": '<path d="M12 5v14M5 12h14"></path>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
    "clock": '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
    "cloudoff": '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z"></path><path d="M3 3l18 18"></path>',
    "down": '<path d="M12 4v11"></path><path d="M7 10.5l5 5 5-5"></path><path d="M5 20h14"></path>',
    "mute": '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"></path><path d="M16 9.5l5 5M21 9.5l-5 5"></path>',
    "heart": '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"></path>',
    "users": '<circle cx="9" cy="8.5" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.6a3.5 3.5 0 0 1 0 7.8M18.5 14.4A6.5 6.5 0 0 1 21.5 20"></path>',
    "star": '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"></path>',
    "flame": '<path d="M12 22c-4.4 0-7.5-3-7.5-7.1 0-3.7 2.8-5.8 4.1-9.1 1.7 1.5 2.4 3.2 2.4 5 1.5-.9 2.6-2.6 2.8-5 2.8 2.2 5.7 5.4 5.7 9.1 0 4.1-3.1 7.1-7.5 7.1z"></path>',
    "pad": '<rect x="2.5" y="7" width="19" height="11" rx="5.5"></rect><path d="M7.5 10.5v4M5.5 12.5h4"></path><circle cx="15.5" cy="11.5" r="1"></circle><circle cx="17.5" cy="13.5" r="1"></circle>',
    "refresh": '<path d="M20 11a8 8 0 1 0-2.3 5.7"></path><path d="M20 4.5V11h-6.5"></path>',
    "wave": '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10m0-5.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7L4 14.5a1.6 1.6 0 0 1 2.6-1.8L7 13"></path>',
    "lock": '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
    "medal": '<circle cx="12" cy="15" r="5.5"></circle><path d="M8.5 10.5L6 3h4l2 5 2-5h4l-2.5 7.5"></path>',
    "book": '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"></path><path d="M12 6.5v13"></path>',
    "sparkle": '<path d="M12 3v5M12 16v5M3 12h5M16 12h5"></path>',
    "envelope": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"></rect><path d="M3.5 7l8.5 6 8.5-6"></path>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="2.8"></circle>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"></path>',
}

def sparkle(x, y, color=AMBER, size=18, rot=0):
    return at(x, y, sv(I["sparkle"], size, color, 3), rot)

def nabat(h=120):
    """شاخ نبات: a stick of saffron rock candy, the fal's own sticker."""
    import random
    rnd = random.Random(7)
    cols = ["#FFD36B", "#F7B731", "#FFE49A", "#E89B0B", "#FFC94A"]
    bits = []
    y = 16
    while y < h - 30:
        for _ in range(3):
            s = rnd.randint(11, 19)
            x = rnd.randint(9, 37 - s // 2)
            bits.append(f'<span style="position: absolute; left: {x}px; top: {y + rnd.randint(-4, 4)}px; width: {s}px; height: {s}px; border-radius: 3px; '
                        f'background: {rnd.choice(cols)}; transform: rotate({rnd.randint(20, 70)}deg); box-shadow: inset -2px -2px 0 rgba(160,90,0,0.18), inset 2px 2px 0 rgba(255,255,255,0.55);"></span>')
        y += 11
    return (f'<span style="position: relative; width: 56px; height: {h}px; box-sizing: border-box; border-radius: 26px; background: #FFFFFF; {SH}">'
            f'<span style="position: absolute; left: 25px; top: 5px; width: 5px; height: {h - 10}px; border-radius: 3px; background: #B9803A;"></span>{"".join(bits)}</span>')

def ghazal_book(w=96, h=120, bg=LAPIS):
    """A closed divan, sticker style, with its ribbon."""
    return (f'<span style="position: relative; width: {w}px; height: {h}px; box-sizing: border-box; border-radius: 10px 18px 18px 10px; background: {bg}; '
            f'border: 5px solid #FFFFFF; {SH} display: flex; align-items: center; justify-content: center;">'
            f'<span style="display: flex; flex-direction: column; align-items: center; gap: {max(3, h // 30)}px; background: #FFFFFF; color: {bg}; border-radius: 10px; padding: {h // 24}px {w // 9}px {h // 30}px; box-shadow: 0 2px 4px rgba(20,17,43,0.18);">'
            f'<span style="font-family: \'Lalezar\', sans-serif; font-size: {max(12, w // 6)}px; line-height: 1; padding-top: 3px;">دیوان</span>'
            f'<span style="display: flex; gap: 3px;"><span style="width: {w // 8}px; height: 3px; border-radius: 2px; background: {bg};"></span><span style="width: {w // 8}px; height: 3px; border-radius: 2px; background: {bg}; opacity: 0.5;"></span></span></span>'
            f'<span style="position: absolute; bottom: -18px; left: {w // 3}px; width: 12px; height: 26px; background: {MAGENTA}; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);"></span></span>')

ART_W, ART_H = 300, 200
def art(*pieces, h=ART_H):
    return f'<div style="position: relative; width: {ART_W}px; height: {h}px; flex-shrink: 0;">{"".join(pieces)}</div>'

# ---------------- illustrations ----------------
def art_sheet():
    """Nothing here yet: an empty sticker sheet, one sticker on its way."""
    return art(at(40, 30, slot(100, 64, 16)), at(160, 30, slot(100, 64, 16)), at(40, 112, slot(100, 64, 16)),
               at(156, 104, tile(108, 72, LAPIS, sv(I["plus"], 30, "#FFFFFF", 3), 18, 5, SH_UP), 8, 2), sparkle(268, 92))

def art_divan():
    return art(at(54, 44, slot(190, 46, 14)), at(54, 104, slot(150, 46, 14)),
               at(196, 16, tile(64, 84, MAGENTA, sv(I["bookmark"], 32, "#FFFFFF", 0, "#FFFFFF"), 16, 5, SH_UP), 10, 2),
               at(24, 150, word("دل", FIRE, size=19), -8), at(92, 160, word("بیت", "#FFFFFF", INK, 18), 5), sparkle(250, 140, AMBER))

def art_search():
    return art(at(30, 70, slot(70, 46, 12)), at(110, 70, slot(70, 46, 12, "؟")), at(190, 70, slot(70, 46, 12)),
               at(170, 6, disc(96, LAPIS, sv(I["search"], 46, "#FFFFFF", 3), 6, SH_UP), -10, 2), sparkle(36, 30, MAGENTA), sparkle(150, 150, AMBER, 16))

def art_inbox():
    path = '<svg aria-hidden="true" width="220" height="120" viewBox="0 0 220 120" fill="none" stroke="#C9C5D3" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"><path d="M10 110 C 60 40, 120 120, 200 20"></path></svg>'
    return art(at(30, 70, path), at(180, 10, disc(86, MAGENTA, sv(I["plane"], 40, "#FFFFFF", 2.6), 6, SH_UP), -12, 2),
               at(24, 120, tile(78, 58, "#FFFFFF", sv(I["envelope"], 34, GREY, 2.2), 14, 4), 6), sparkle(130, 40, AMBER))

def art_friends(face_html=""):
    me = face_html or disc(84, AMBER, sv(I["users"], 38, INK, 2.4), 5)
    return art(at(108, 50, me, 0, 2), at(26, 70, slot(66, 66, 33, "+")), at(208, 70, slot(66, 66, 33, "+")),
               at(70, 146, pill("دوستات اینجا میان", "#FFFFFF", INK, 12), -3), sparkle(200, 26, MAGENTA))

def art_board():
    return art(at(40, 104, slot(64, 76, 12, "۲")), at(118, 74, slot(64, 106, 12, "۱")), at(196, 124, slot(64, 56, 12, "۳")),
               at(126, 6, disc(62, AMBER, sv(I["medal"], 30, INK, 2.4), 5, SH_UP), 10, 2), sparkle(60, 50, LAPIS), sparkle(236, 70, FIRE, 16))

def art_done():
    return art(at(100, 30, disc(110, GREEN, sv(I["check"], 56, "#FFFFFF", 3.4), 7, SH_UP), -6, 2),
               at(196, 120, pill("تا فردا", INK, "#FFFFFF", 14), 6), at(30, 120, pill("۱۰۰ امتیاز", AMBER, INK, 14), -8),
               sparkle(60, 40, MAGENTA), sparkle(232, 40, LAPIS), sparkle(150, 160, AMBER, 14))

def art_offline():
    return art(at(96, 26, tile(116, 92, "#FFFFFF", sv(I["cloudoff"], 52, GREY, 2.4), 26, 5, SH_UP), -4, 2),
               at(40, 132, slot(90, 40, 12)), at(170, 132, slot(90, 40, 12)), sparkle(232, 30, LAPIS, 16))

def art_poem_failed():
    return art(at(104, 22, tile(96, 120, FIRE, sv(I["book"], 46, "#FFFFFF", 2.4), 18, 5, SH_UP), 6, 2),
               at(196, 104, disc(52, "#FFFFFF", sv(I["refresh"], 24, INK, 2.6), 4), -8, 3),
               at(40, 150, slot(80, 34, 10)), sparkle(70, 50, AMBER))

def art_mute():
    return art(at(104, 30, disc(100, INK, sv(I["mute"], 46, "#FFFFFF", 2.4), 6, SH_UP), -6, 2),
               at(36, 140, word("بخون برام", "#FFFFFF", INK, 18), -6), at(196, 136, slot(70, 38, 12)), sparkle(232, 40, MAGENTA))

def art_badges():
    return art(at(30, 70, slot(68, 68, 34, "؟")), at(116, 40, disc(72, AMBER, sv(I["star"], 32, INK, 0, INK), 5, SH_UP), -8, 2),
               at(204, 70, slot(68, 68, 34, "؟")), at(70, 152, slot(68, 34, 17)), at(160, 152, slot(68, 34, 17)), sparkle(212, 30, LAPIS))

def art_requests():
    return art(at(110, 30, disc(96, AMBER, sv(I["wave"], 46, INK, 2.2), 6, SH_UP), 8, 2),
               at(30, 136, slot(110, 44, 14)), at(160, 136, slot(110, 44, 14)), sparkle(54, 40, MAGENTA))

def art_feed():
    return art(at(40, 20, slot(220, 52, 14)), at(40, 82, slot(220, 52, 14)),
               at(170, 112, disc(76, MAGENTA, sv(I["heart"], 34, "#FFFFFF", 0, "#FFFFFF"), 5, SH_UP), 10, 2), sparkle(44, 150, AMBER))

def art_games(icon_html):
    return art(at(36, 60, slot(70, 70, 35)), at(194, 60, slot(70, 70, 35)), at(110, 30, icon_html, -6, 2),
               at(98, 152, pill("نوبت هیچ‌کس نیست", "#FFFFFF", INK, 12), 3), sparkle(250, 30, AMBER))

def art_nabat_small():
    return art(at(128, 20, nabat(150), 14, 2), at(40, 70, slot(70, 46, 12)), at(200, 100, slot(60, 46, 12)), sparkle(60, 30, AMBER), sparkle(230, 50, MAGENTA))

# ---------------- the empty block ----------------
def cta_btn(t, href="#", bg=LAPIS, fg="#FFFFFF", icon=""):
    return (f'<a href="{href}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 54px; '
            f'box-sizing: border-box; padding: 0 26px; border-radius: 18px; background: {bg}; color: {fg}; border: 4px solid #FFFFFF; '
            f'box-shadow: 0 5px 14px rgba(47,53,245,0.28); font-family: \'Lalezar\', sans-serif; font-size: 20px; padding-top: 4px;">{icon}{t}</a>')

def ghost_btn(t, href="#"):
    return f'<a href="{href}" style="text-decoration: none; font-size: 14px; font-weight: 700; color: {LAPIS};">{t}</a>'

def empty_block(art_html, title, body, cta="", second="", extra="", grow=True):
    """Centre of an empty screen: picture, title, one or two lines, the way forward."""
    return (f'<div style="{"flex-grow: 1; " if grow else ""}display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 0 8px;">'
            f'{art_html}<span style="font-family: \'Lalezar\', sans-serif; font-size: 28px; line-height: 1.25; padding-top: 6px;">{title}</span>'
            f'<span style="font-size: 14px; color: #4A4660; line-height: 1.8; max-width: 300px;">{body}</span>'
            f'{extra}{f"<div style=\'padding-top: 6px;\'>{cta}</div>" if cta else ""}{second}</div>')

def empty_card(icon_disc, title, body, action="", href="#"):
    """A small empty state inside a section (one card, not the whole screen)."""
    act = f'<a href="{href}" style="text-decoration: none; flex-shrink: 0; height: 38px; box-sizing: border-box; padding: 0 14px; border-radius: 999px; background: {LAPIS}; color: #FFFFFF; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center;">{action}</a>' if action else ""
    return (f'<div style="display: flex; align-items: center; gap: 12px; background: #FFFFFF; border: 3px dashed {DASH}; border-radius: 22px; padding: 14px;">'
            f'{icon_disc}<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 15px; font-weight: 700;">{title}</span>'
            f'<span style="font-size: 12px; color: #4A4660; line-height: 1.6;">{body}</span></div>{act}</div>')
