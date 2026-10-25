"""Copies, crops and compresses the deck's pictures into pitch/images/.

Sources are read only: the owner's Unsplash photos in the main checkout's photos/ (git-ignored), the owner's front-door
pictures in Downloads (also in apps/web/public), and the raw screenshots from screenshots.js.
Every photo is a JPEG, long side <= 1920 px and <= ~400 KB; screenshots stay full-size PNGs.
Run: python pitch/scripts/prep_images.py
"""
import os
import sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "images"))
RAW = os.path.join(HERE, "raw")
PHOTOS = r"C:\Users\tumom\Tumoolo-Tech\UniversityFlow\photos"
DOWNLOADS = r"C:\Users\tumom\Downloads"
CANVAS = (14, 13, 16)  # tokens canvas #0E0D10
MAX_BYTES = 400 * 1024
os.makedirs(OUT, exist_ok=True)

PANEL_RATIO = 4.6 / 7.5  # the deck's full-height photo panel


def save_jpeg(im, name, quality=86):
    im = im.convert("RGB")
    im.thumbnail((1920, 1920), Image.LANCZOS)
    path = os.path.join(OUT, name)
    q = quality
    while True:
        im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= MAX_BYTES or q <= 50:
            break
        q -= 6
    print(f"{name}: {im.size[0]}x{im.size[1]}, {os.path.getsize(path) // 1024} KB, q{q}")


def panel(src, name, fx=0.5, fy=0.5, ratio=PANEL_RATIO, height=1600):
    im = ImageOps.exif_transpose(Image.open(src))
    w, h = im.size
    if w / h > ratio:  # too wide: crop width
        cw, ch = int(h * ratio), h
    else:
        cw, ch = w, int(w / ratio)
    x = min(max(int(w * fx - cw / 2), 0), w - cw)
    y = min(max(int(h * fy - ch / 2), 0), h - ch)
    im = im.crop((x, y, x + cw, y + ch)).resize((int(height * ratio), height), Image.LANCZOS)
    save_jpeg(im, name)


def cutout(src, name, width=1300):
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, CANVAS + (255,))
    bg.alpha_composite(im)
    bg.thumbnail((width, width), Image.LANCZOS)
    save_jpeg(bg, name, 88)


P = lambda f: os.path.join(PHOTOS, "pitch", f)
D = lambda f: os.path.join(DOWNLOADS, f)

if "photos" in sys.argv or len(sys.argv) == 1:
    panel(P("classroom-taylor-flowe-4nKOEAQaTgA-unsplash.jpg"), "p-classroom.jpg", fx=0.42)
    panel(os.path.join(PHOTOS, "course-cards", "engineering-mahmoud-amer-Ia7I7oMnvcA-unsplash.jpg"), "p-calculator.jpg", fx=0.5, fy=0.5)
    panel(P("graduate-hood-dwayne-joe-F-Y_gU26Ww8-unsplash.jpg"), "p-graduate-hood.jpg", fx=0.5, fy=0.42)
    panel(P("window-tymofii-tarasov-iIKCCmxGRLw-unsplash.jpg"), "p-window.jpg", fx=0.5)
    panel(P("library-eliott-reyna-kcT-7cirBEw-unsplash.jpg"), "p-library.jpg", fx=0.62)
    panel(P("laptops-x-IgUR1iX0mqM-unsplash.jpg"), "p-laptops.jpg", fx=0.5)
    panel(P("cap-albert-vincent-wu-m7yOJx0ALME-unsplash.jpg"), "p-cap.jpg", fx=0.5, fy=0.45)
    cutout(D("grade 10 pair (transparent).png"), "journey-grade10.jpg")
    cutout(D("university pair (transparent).png"), "journey-university.jpg")
    cutout(D("graduation pair (transparent).png"), "journey-graduation.jpg")

if "art" in sys.argv or len(sys.argv) == 1:
    # A soft mauve glow (tokens brand #C99BB8) for the dark slides' top-right corner.
    import math

    gw, gh = 1000, 720
    glow = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    px = glow.load()
    for yy in range(gh):
        for xx in range(gw):
            a = max(0.0, 1 - math.hypot(xx - gw, yy) / 820) ** 2.2
            px[xx, yy] = (201, 155, 184, int(95 * a))
    glow.save(os.path.join(OUT, "glow.png"), optimize=True)
    print("glow.png", os.path.getsize(os.path.join(OUT, "glow.png")) // 1024, "KB")
    # QR code for the judge demo (tokens ink on canvas).
    import qrcode

    qr = qrcode.QRCode(border=2, box_size=16, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data("https://universityflow.tumoolo.tech/demo")
    qr.make_image(fill_color=(244, 242, 245), back_color=CANVAS).convert("RGB").save(os.path.join(OUT, "qr-demo.png"))
    print("qr-demo.png")

if "shots" in sys.argv or len(sys.argv) == 1:
    # Screenshots stay PNG at their captured size (laptop 2880x1800, phone 1170x2532): never
    # resized, never JPEG. Over ~1.5 MB, a high-quality 256-colour palette keeps them crisp.
    KEEP = [
        "naledi-results-laptop", "naledi-home-laptop", "thabo-subjects-phone",
        "amahle-applications-phone", "amahle-funding-phone", "amahle-help-phone",
        "lerato-first-week-laptop", "sipho-cv-laptop", "sipho-modules-laptop",
        "public-landing-laptop", "public-landing-phone", "public-demo-laptop",
    ]
    for name in KEEP:
        src = os.path.join(RAW, name + ".png")
        if not os.path.exists(src):
            print("missing", name)
            continue
        im = Image.open(src).convert("RGB")
        path = os.path.join(OUT, "app-" + name + ".png")
        im.save(path, "PNG", optimize=True)
        if os.path.getsize(path) > 1536 * 1024:
            im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, "PNG", optimize=True)
        print(f"app-{name}.png: {im.size[0]}x{im.size[1]}, {os.path.getsize(path) // 1024} KB")
