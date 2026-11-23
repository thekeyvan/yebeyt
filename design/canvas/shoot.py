import sys, re, os, subprocess
S, out = sys.argv[1], sys.argv[2]  # S: folder that holds project/, out: where previews and PNGs go
HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "..", "..", "Yebeyt", "Resources", "Fonts") + "/"
D = os.path.join(HERE, "fonts") + "/"
BLOB = {"9fe3b1905f2e20db67b7d7711a8c69d0": F+"Parastoo.ttf", "68a06d356b96bd36f8f9011a12ab1244": F+"Gandom.ttf",
        "b64bda18f46572bff3417fa47d760023": F+"Sahel.ttf", "657f6f793803047173f39b46bb9f84cc": F+"Shabnam.ttf",
        "91276f4d8a8d6bca78223fd68eadf8aa": D+"Lalezar-Regular.ttf", "6a49fbd82ab892566ec799ad491bb03f": D+"Vazirmatn.ttf",
        "93f844cb9ac5efbed9a28e44eba1b6ef": D+"missing", "38616ee262f2ab2be6fa1de0c5b78eb7": D+"Mirza-SemiBold.ttf",
        "c1d812388e5b506decf856c1e4eef8b8": D+"Mirza-Bold.ttf", "7909ed4a33ffd0ad24343f4fc4e9ec1e": D+"Mirza-Regular.ttf", "921115a7e03fe49c1c727d992d9fc8f3": D+"Lateef-Regular.ttf", "0dbcbc2dce942c27cec3e8081a5f8525": D+"Lateef-SemiBold.ttf", "d0ae57b8f840aa1be3f36102b4f58205": D+"Lateef-Bold.ttf", "b8c89c8a901aeea2448c9d9e611dcc90": D+"Lateef-ExtraBold.ttf", "d01029bfededb1746e99ad15b6bce937": D+"Parastoo-Bold.ttf"}
C = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for name in sys.argv[3:]:
    s = open(f"{S}/canvas/project/{name}", encoding="utf-8").read()
    helm = s[s.index("<helmet>")+8:s.index("</helmet>")]
    body = s[s.index("</helmet>")+9:s.index("</x-dc>")]
    w, h = re.search(r'"width":(\d+),"height":(\d+)', s).groups()
    html = f'<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">{helm}</head><body style="direction:ltr;width:{w}px;margin:0">{body}</body></html>'
    html = re.sub(r"/_blob/([0-9a-f]{32})", lambda m: "file://" + BLOB.get(m.group(1), "missing"), html)
    html = re.sub(r'<link href="https://fonts.googleapis.com[^>]+>', "", html)  # prove self-hosting works offline
    p = f"{out}/prev_{name}.html"; open(p, "w", encoding="utf-8").write(html)
    subprocess.run([C, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=6000",
                    f"--window-size={w},{h}", f"--screenshot={out}/shot_{name}.png", "file://" + p], capture_output=True, timeout=60)
    print(name)
