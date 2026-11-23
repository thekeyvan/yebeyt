"""Turning Ganjoor's verses and descriptions into the app's couplets and short bios."""
import re

# Verses on the second line of a couplet. Right, CenteredVerse1, Single and Paragraph
# (GanjoorService's VersePosition) all go in the first. Comment verses are editor notes, not
# poem lines (and have no CoupletIndex), so they are dropped.
SECOND_HALF = {"Left", "CenteredVerse2"}
NOT_POETRY = {"Comment"}
# Ganjoor marks the meanings it had written by an AI with this prefix. It is stripped from the text and
# the couplet gets `ai: true`.
AI_LABEL = "هوش مصنوعی:"


def clean(text):
    return text.replace("\r", "")


def split_ai(note):
    """A couplet note -> (text without the AI label, whether it had one)."""
    note = clean(note)
    if note.startswith(AI_LABEL):
        return note[len(AI_LABEL):].strip(), True
    return note, False


def group_couplets(verses):
    """Verses -> [{m1, m2, meaning?, ai?}], grouped by CoupletIndex, in verse order."""
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
            meaning, ai = split_ai(v["CoupletSummary"])
            if meaning:
                couplet["meaning"] = meaning
                if ai:
                    couplet["ai"] = True
    return couplets


def short_bio(description):
    sentences = re.split(r"(?<=[.!؟?])\s+", description.strip())
    return " ".join(sentences[:2])
