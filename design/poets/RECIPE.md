# Poet portraits: the approved recipe

Approved by the founder on 2026-11-22 ("exactly this"). Use this recipe, unchanged, for every new poet so the set stays one family.

## What the result looks like
- Simple, bold line art: thick even stroke (~22 px at 1024 px), the fewest lines that keep the poet recognisable.
- Strong likeness to the poet's familiar image: famous traditional portraits for classical poets, best-known photos for modern poets.
- Every poet clearly different from the others (age, face shape, beard, headwear, pose).
- Classical poets wear the plain headwrap or cap of their familiar portrait. Never any emblem or religious symbol, no tall dervish hat, no halo, no calligraphy, no crescent or star.
- In the app: white lines on a coloured circle with a white sticker border (see the «۲ب · چهره‌ی شاعرها» board).

## Files
- `round2/brief.md`: the brief to copy. It holds the full style block and one likeness line per poet.
- `round2/prompt.txt`: the instruction given to Codex.
- `round2/prompts.md`: the final per-image prompts Codex used (good examples to copy for new poets).
- `round2/*.png`: the 16 approved originals (black on white, 1024×1024).
- `poet-*.png` (this folder, top level): the round-2 portraits converted with `to_white.py` (white on transparent, 1024×1024) — the files the server gets.
- `to_white.py`: turns the black-on-white originals into white lines on a transparent background.

## Add new poets
1. Make a new folder, for example `round3/`. Copy `round2/brief.md` into it **without touching the "Likeness", "Headwear" or "Style" sections**. Replace only the "Poets" list with the new poets, one line each: `file.png → name → what makes them recognisable in their famous image` (age, face shape, beard, glasses, hair, clothing).
2. Copy `round2/prompt.txt` into the folder. If there are not 16 poets, change only the count in it.
3. Run Codex from inside that folder:
   ```bash
   codex exec --enable image_generation --sandbox workspace-write --skip-git-repo-check - < prompt.txt > run.log 2>&1
   ```
4. Check every image by eye: likeness, no text, no religious symbol, thick lines, nothing near the edges. Put the new ones next to the existing 16 and make sure no two look alike.
5. Convert to white on transparent (needs Pillow, for example in a venv):
   ```bash
   python3 -I to_white.py round3 out_white 400
   ```
   Output: `out_white/<name>.png`, 400×400, about 12 KB each.
6. Show them on circles in the darker palette colours, so the white line stays readable: `#2F35F5`, `#E8431C`, `#14112B`, `#3E9A1E`, `#E0307A`. Never on amber or light green.
