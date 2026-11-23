"""Tidy pass: buttons that should open a screen now do, so the canvas can be clicked through end to end.
Run after gen_icons, before apply_fonts. Idempotent."""
import os, re, sys
P = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gameicons.py"), encoding="utf-8").read())
rd = lambda k: open(os.path.join(P, k), encoding="utf-8").read()
wr = lambda k, s: open(os.path.join(P, k), "w", encoding="utf-8").write(s)

def link(s, text, target, nth=1):
    """Point the nearest <a href="#"> before the nth occurrence of `text` at `target`."""
    pos = -1
    for _ in range(nth):
        pos = s.index(text, pos + 1)
    a = s.rindex("<a ", 0, pos)
    if s.find("</a>", a, pos) != -1:   # the text isn't inside that link
        return s
    tag_end = s.index(">", a)
    tag = s[a:tag_end]
    if 'href="#"' not in tag:
        return s
    return s[:a] + tag.replace('href="#"', f'href="{target}"', 1) + s[tag_end:]

WIRES = {
    "GamesE.dc.html": [(">بزن بریم<", "PlayDaily.dc.html"), (">با «یه بیت»<", "PlayMosh.dc.html")],
    "JigsawResult.dc.html": [("کل شعر</", "PoemScroll.dc.html")],
    "Direct.dc.html": [("جواب بده<", "PlayMosh.dc.html"), ("معمای امروز</a>", "PlayDaily.dc.html")],
    "Calm.dc.html": [("پیدا کردن دوست<", "InviteFriends.dc.html")],
    "Profile.dc.html": [("ای ساربان آهسته رو", "Poem.dc.html"), ("بشنو این نی چون شکایت", "Poem.dc.html")],
    "Inbox.dc.html": [(">آرین<", "PlayDuel.dc.html"), (">کیان<", "Direct.dc.html"), (">مهسا<", "Direct.dc.html"), (">بردیا<", "Direct.dc.html")],
    "Explore.dc.html": [(">سعدی<", "Poet.dc.html"), (">مولانا<", "Poet.dc.html"), (">مهدی اخوان ثالث<", "Poet.dc.html"), (">خیام<", "Poet.dc.html")],
    "Poet.dc.html": [(">رباعیات<", "BookSection.dc.html"), (">قطعات<", "BookSection.dc.html"), (">مثنویات<", "BookSection.dc.html")],
    "Book.dc.html": [(">قصاید<", "BookSection.dc.html"), (">رباعیات<", "BookSection.dc.html")],
    "PoemScroll.dc.html": [("بخون برام</a>", "Poem.dc.html")],
    "PoemScrollHold.dc.html": [("بخون برام</a>", "Poem.dc.html")],
    "PlaySecond.dc.html": [(">همینه!<", "PlayBook.dc.html")],
    "PlayBook.dc.html": [(">سؤال بعدی<", "PlayMatch.dc.html")],
    "PlayListen.dc.html": [(">همینه!<", "ChallengeSend.dc.html")],
    "PlayDaily.dc.html": [(">بچسبون!<", "ChallengeSend.dc.html")],
    "PlayMosh.dc.html": [(">کم آوردم<", "GamesE.dc.html")],
    "FeedbackGame.dc.html": [(">بفرست<", "Poem.dc.html")],
    "FeedbackBug.dc.html": [(">بفرست<", "Poem.dc.html")],
}
done = 0
for k, wires in WIRES.items():
    s = rd(k)
    o = s
    for text, target in wires:
        if text in s:
            s = link(s, text, target)
    if s != o:
        wr(k, s)
        done += 1

# games tab: the مشاعره block wears its icon instead of the two loose bubbles
ge = rd("GamesE.dc.html")
m = re.search(r'<span aria-hidden="true" style="position: absolute; top: -12px; left: 16px; display: flex; gap: 4px; pointer-events: none;">\s*<span style="width: 40px; height: 28px;[^"]*"></span>\s*<span style="width: 40px; height: 28px;[^"]*"></span>\s*</span>', ge)
if m and "mosh-icon" not in ge:
    ge = ge[:m.start()] + f'<span data-mosh-icon style="position: absolute; top: -16px; left: 12px; display: flex;">{game_icon("mosh", 50)}</span>' + ge[m.end():]
    wr("GamesE.dc.html", ge)
# the daily card in the games tab: same rules as the game (3 tries)
ge = rd("GamesE.dc.html")
if "معمای امروز · ۶ فرصت" in ge:
    wr("GamesE.dc.html", ge.replace("معمای امروز · ۶ فرصت", "معمای امروز · ۳ فرصت"))
print("links", done, "mosh-icon" in rd("GamesE.dc.html") or "data-mosh-icon" in rd("GamesE.dc.html"))
