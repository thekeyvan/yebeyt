"""Long poet and book names on Explore: fixed-width poet labels with a 2-line clamp, plus long real examples.
Run after gen_divan, before apply_fonts."""
import os, re, sys
P = sys.argv[1]
f = os.path.join(P, "Explore.dc.html")
s = open(f, encoding="utf-8").read()

ITEM = 'flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; font-weight: 700;">'
s = s.replace(ITEM, 'flex-shrink: 0; width: 76px; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; font-weight: 700;">')
CLAMP = "width: 100%; text-align: center; line-height: 1.5; padding-bottom: 2px;"  # no clamp: display names are short by rule, and both lines must show in full
s = re.sub(r'(</span>\n        )([^<\n]+?)(\n      </a>)', lambda m: f'{m.group(1)}<span style="{CLAMP}">{m.group(2).strip()}</span>{m.group(3)}', s)

# the circle never shrinks; a second line only grows the label downward
s = s.replace('<div style="display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 4px;">', '<div style="display: flex; align-items: flex-start; gap: 10px; overflow-x: auto; padding: 2px 2px 12px;">', 1)
s = s.replace('<span style="width: 70px; height: 70px; box-sizing: border-box; border-radius: 50%;', '<span style="width: 70px; height: 70px; flex: 0 0 70px; aspect-ratio: 1; box-sizing: border-box; border-radius: 50%;')
# a long poet name: Akhavan instead of Ferdowsi in the visible row
s = s.replace('<img src="/_blob/abb1f80c2ef9f9788c4c129e6f528eab"', '<img src="/_blob/bd8239e86ef2aee0db7cfd5ceeb5a7eb"', 1)
s = s.replace(f'<span style="{CLAMP}">فردوسی</span>', f'<span style="{CLAMP}">مهدی اخوان ثالث</span>', 1)
# a long book title
s = s.replace(">مثنوی معنوی</span>", ' title="غزلیات شمس تبریزی (دیوان کبیر)">غزلیات شمس تبریزی (دیوان کبیر)</span>', 1)
assert "مهدی اخوان ثالث" in s and "دیوان کبیر" in s
open(f, "w", encoding="utf-8").write(s)
print("names")
