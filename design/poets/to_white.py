import sys, os
from PIL import Image, ImageOps
src, dst, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
for f in sorted(os.listdir(src)):
    if not f.lower().endswith((".png", ".jpg")): continue
    im = Image.open(os.path.join(src, f)).convert("L").resize((size, size), Image.LANCZOS)
    a = ImageOps.invert(im)                     # dark lines -> high alpha
    a = a.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.6)))
    out = Image.new("RGBA", im.size, (255, 255, 255, 0)); out.putalpha(a)
    name = os.path.splitext(f)[0].replace("poet-", "") + ".png"
    out.save(os.path.join(dst, name), optimize=True)
    print(name, os.path.getsize(os.path.join(dst, name)))
