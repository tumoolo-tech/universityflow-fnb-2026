"""Makes static Outfit TTFs (Regular 400, Bold 700) from the web app's self-hosted variable font.

PowerPoint handles static TTFs better than a variable font, and the deck's PDF embeds them.
Outfit is under the SIL Open Font License 1.1, so these instances may be shared.
Run: python pitch/scripts/make_fonts.py
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "apps", "web", "app", "fonts", "Outfit-latin.woff2")
OUT = os.path.join(HERE, "..", "fonts")
os.makedirs(OUT, exist_ok=True)


def set_names(font, style, weight_class):
    name = font["name"]
    family = "Outfit"
    full = family if style == "Regular" else f"{family} {style}"
    ps = f"{family}-{style}"
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        name.setName(family, 1, pid, eid, lid)
        name.setName(style, 2, pid, eid, lid)
        name.setName(f"{full}; static instance", 3, pid, eid, lid)
        name.setName(full, 4, pid, eid, lid)
        name.setName(ps, 6, pid, eid, lid)
    os2 = font["OS/2"]
    os2.usWeightClass = weight_class
    bold = style == "Bold"
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b100000 if bold else 0b1000000)
    font["head"].macStyle = 1 if bold else 0


for style, wght in (("Regular", 400), ("Bold", 700)):
    vf = TTFont(SRC)
    inst = instancer.instantiateVariableFont(vf, {"wght": wght})
    set_names(inst, style, wght)
    inst.flavor = None
    path = os.path.join(OUT, f"Outfit-{style}.ttf")
    inst.save(path)
    print("wrote", path)
