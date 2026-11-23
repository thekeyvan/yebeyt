"""One icon per game. Solo games: one colour each. Games with friends: two colours split on the diagonal.
Used by gen_games, gen_invite, gen_play and gen_icons (exec this file into their namespace)."""

GAME = {
    # key: (name, background, glyph colour, accent colour, group)
    "daily":  ("معمای امروز", "#2F35F5", "#FFFFFF", "#FFB703", "روزانه"),
    "jigsaw": ("جورچین بیت", "#FF4D24", "#FFFFFF", "#FFB703", "تکی"),
    "poet":   ("حدس شاعر", "#FFB703", "#14112B", "#2F35F5", "تکی"),
    "misra":  ("مصراع دوم", "#6CCB3A", "#14112B", "#FFFFFF", "تکی"),
    "book":   ("از کدوم کتاب؟", "#FF3D8B", "#FFFFFF", "#FFB703", "تکی"),
    "match":  ("معنی‌یاب", "#1C20B8", "#FFFFFF", "#6CCB3A", "تکی"),
    "listen": ("گوش کن", "#14112B", "#FFFFFF", "#FF3D8B", "تکی"),
    "mosh":   ("مشاعره", ("#FFB703", "#2F35F5"), "#14112B", "#FFFFFF", "با دوست"),
    "duel":   ("بازی رودررو", ("#FF4D24", "#FF3D8B"), "#FFFFFF", "#FFB703", "با دوست"),
}

def _glyph(k, fg, ac, bg):
    s = f'fill="none" stroke="{fg}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"'
    a = f'fill="none" stroke="{ac}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"'
    edge = bg if isinstance(bg, str) else bg[0]
    return {
     "daily": f'<rect x="4" y="5.5" width="16" height="14.5" rx="3" {s}></rect><path d="M8.5 3.5v4M15.5 3.5v4" {s}></path>'
              f'<rect x="7" y="11.2" width="4.4" height="5.6" rx="1.2" fill="{ac}"></rect>'
              f'<rect x="12.6" y="11.2" width="4.4" height="5.6" rx="1.2" fill="none" stroke="{fg}" stroke-width="1.5" stroke-dasharray="1.6 1.3"></rect>',
     "jigsaw": f'<g transform="rotate(-10 7.5 12)"><rect x="3.2" y="6.2" width="8.6" height="11.6" rx="2.3" fill="{fg}"></rect><path d="M5.6 12h3.8" stroke="{edge}" stroke-width="1.8" stroke-linecap="round"></path></g>'
               f'<g transform="rotate(9 16.5 12.5)"><rect x="12.2" y="6.7" width="8.6" height="11.6" rx="2.3" fill="{ac}"></rect><path d="M14.6 12.5h3.8" stroke="{edge}" stroke-width="1.8" stroke-linecap="round"></path></g>',
     "poet": f'<circle cx="10.5" cy="10" r="4.1" {s}></circle><path d="M3.2 21c1.2-4 4-6 7.3-6s6.1 2 7.3 6" {s}></path>'
             f'<circle cx="18.6" cy="5.6" r="4" fill="{ac}"></circle><path d="M17.3 4.7a1.4 1.4 0 1 1 2 1.3c-.5.2-.7.5-.7 1" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"></path><circle cx="18.6" cy="8.1" r=".7" fill="#FFFFFF"></circle>',
     "misra": f'<path d="M20 7.5H6" {s} stroke-width="2.6"></path><path d="M20 13H11" {s} stroke-dasharray="2.4 2.6"></path>'
              f'<path d="M9 18.5H3.8M6.3 16l-2.5 2.5L6.3 21" {a}></path>',
     "book": f'<path d="M3.5 6.8c2.8-1.4 5.6-1.1 8.5.8v12c-2.9-1.9-5.7-2.2-8.5-.8z" fill="{fg}"></path><path d="M20.5 6.8c-2.8-1.4-5.6-1.1-8.5.8v12c2.9-1.9 5.7-2.2 8.5-.8z" fill="{fg}" opacity="0.78"></path>'
             f'<circle cx="12" cy="4.6" r="3.4" fill="{ac}" stroke="{edge}" stroke-width="1.4"></circle><path d="M11 3.9a1.1 1.1 0 1 1 1.5 1c-.4.2-.5.4-.5.8" fill="none" stroke="#14112B" stroke-width="1.2" stroke-linecap="round"></path><circle cx="12" cy="6.6" r=".55" fill="#14112B"></circle>',
     "match": f'<rect x="13.5" y="4" width="7.5" height="5.2" rx="2" fill="{fg}"></rect><rect x="3" y="14.8" width="7.5" height="5.2" rx="2" fill="{fg}"></rect>'
              f'<rect x="3" y="4" width="7.5" height="5.2" rx="2" fill="none" stroke="{fg}" stroke-width="1.6" opacity="0.6"></rect><rect x="13.5" y="14.8" width="7.5" height="5.2" rx="2" fill="none" stroke="{fg}" stroke-width="1.6" opacity="0.6"></rect>'
              f'<path d="M13.5 6.6c-4 0-0.5 10.8-3 10.8" {a}></path>',
     "listen": f'<path d="M4.2 15v-3a7.8 7.8 0 0 1 15.6 0v3" {s}></path><rect x="3" y="14" width="4.6" height="6.6" rx="1.9" fill="{fg}"></rect><rect x="16.4" y="14" width="4.6" height="6.6" rx="1.9" fill="{fg}"></rect>'
               f'<path d="M8.6 17.2c.9-2.2 1.8 2.2 2.7 0s1.8 2.2 2.7 0 1.8 2.2 2.7 0" {a} stroke-width="1.9"></path>',
     "mosh": f'<path d="M4 4.5h9.5a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H8.3l-3.1 2.7v-2.7H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" fill="{fg}"></path>'
             f'<path d="M11 11.6h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.6v2.7l-3.1-2.7H11a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="{ac}" stroke="#14112B" stroke-width="1.2"></path>'
             f'<path d="M13.2 15.6h5" stroke="#2F35F5" stroke-width="1.8" stroke-linecap="round"></path><path d="M6 8.6h5" stroke="{edge}" stroke-width="1.8" stroke-linecap="round"></path>',
     "duel": f'<circle cx="5.8" cy="9.4" r="2.8" fill="{fg}"></circle><path d="M1.8 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z" fill="{fg}"></path>'
             f'<circle cx="18.2" cy="9.4" r="2.8" fill="{fg}"></circle><path d="M14.2 19.5c.6-3 2.1-4.6 4-4.6s3.4 1.6 4 4.6z" fill="{fg}"></path>'
             f'<path d="M13.2 2.8L9.4 11.2h3.1l-1.2 7 4.4-9.4h-3.2z" fill="{ac}" stroke="#14112B" stroke-width="1.1" stroke-linejoin="round"></path>',
    }[k]

def bg_css(bg):
    return f"background: {bg};" if isinstance(bg, str) else f"background: linear-gradient(135deg, {bg[0]} 50%, {bg[1]} 50%);"

def game_icon(k, size=48, border=None, label=None):
    """The game's sticker: coloured circle, white border, glyph."""
    name, bg, fg, ac, _ = GAME[k]
    b = border if border is not None else max(2, round(size / 12))
    g = round(size * 0.56)
    al = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return (f'<span {al} style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; border-radius: 50%; {bg_css(bg)} '
            f'border: {b}px solid #FFFFFF; box-shadow: 0 2px {max(4, size // 8)}px rgba(20,17,43,0.2); display: flex; align-items: center; justify-content: center;">'
            f'<svg aria-hidden="true" width="{g}" height="{g}" viewBox="0 0 24 24">{_glyph(k, fg, ac, bg)}</svg></span>')
