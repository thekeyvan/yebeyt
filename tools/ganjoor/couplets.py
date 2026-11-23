"""Turning Ganjoor's verses and descriptions into the app's couplets and short bios."""
import re

# Verses on the second line of a couplet. Right, CenteredVerse1, Single and Paragraph
# (GanjoorService's VersePosition) all go in the first. Comment verses are editor notes, not
# poem lines (and have no CoupletIndex), so they are dropped.
SECOND_HALF = {"Left", "CenteredVerse2"}
NOT_POETRY = {"Comment"}


def clean(text):
    return text.replace("\r", "")


def group_couplets(verses):
    """Verses -> [{m1, m2, meaning?}], grouped by CoupletIndex, in verse order."""
    couplets, index, filled = [], None, set()
    for v in sorted(verses, key=lambda v: v["VOrder"]):
        if v["Position"] in NOT_POETRY:
            continue
        slot = "m2" if v["Position"] in SECOND_HALF else "m1"
        if not couplets or v.get("CoupletIndex") != index or slot in filled:
            couplets.append({"m1": "", "m2": ""})
            index, filled = v.get("CoupletIndex"), set()
        couplet = couplets[-1]
        couplet[slot] = clean(v["Text"])
        filled.add(slot)
        if v.get("CoupletSummary") and "meaning" not in couplet:
            couplet["meaning"] = clean(v["CoupletSummary"])
    return couplets


def short_bio(description):
    sentences = re.split(r"(?<=[.!؟?])\s+", description.strip())
    return " ".join(sentences[:2])
