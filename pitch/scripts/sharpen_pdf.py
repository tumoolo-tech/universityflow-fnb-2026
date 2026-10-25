"""Puts the full-resolution app screenshots back into the exported PDF.

PowerPoint's PDF export downsamples pictures to about 200 ppi, even for print, which makes the
screenshots' small text soft. This finds each screenshot in the PDF (by comparing every large
picture with the originals in ../images) and replaces it with the original lossless PNG, in the
same place and size on the page. Run after export_pdf.ps1:
    python pitch/scripts/sharpen_pdf.py
"""
import glob
import os

import pymupdf
from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
PITCH = os.path.abspath(os.path.join(HERE, ".."))
PDF = os.path.join(PITCH, "UniversityFlow_FNB_Hackathon_2026.pdf")
SHOTS = sorted(glob.glob(os.path.join(PITCH, "images", "app-*.png")))
originals = {p: Image.open(p).convert("RGB") for p in SHOTS}


def best_match(pix):
    """The original screenshot this downsampled picture came from, or None."""
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    best, score = None, 1e9
    for path, orig in originals.items():
        if abs(orig.width / orig.height - im.width / im.height) > 0.02:
            continue
        small = orig.resize(im.size, Image.LANCZOS)
        err = sum(ImageStat.Stat(ImageChops.difference(small, im)).mean) / 3
        if err < score:
            best, score = path, err
    return best if score < 12 else None


doc = pymupdf.open(PDF)
replaced = 0
done = {}
for page in doc:
    for info in page.get_images(full=True):
        xref, w, h = info[0], info[2], info[3]
        if w < 300 or xref in done:
            continue
        pix = pymupdf.Pixmap(doc, xref)
        if pix.alpha or pix.n != 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        match = best_match(pix)
        if not match:
            continue
        page.replace_image(xref, filename=match)
        done[xref] = match
        replaced += 1
        print(f"page {page.number + 1}: {w}x{h} -> {os.path.basename(match)} {originals[match].size}")
tmp = PDF + ".tmp"
doc.save(tmp, garbage=3, deflate=True)
doc.close()
os.replace(tmp, PDF)
print("replaced", replaced, "pictures;", os.path.getsize(PDF) // 1024, "KB")
