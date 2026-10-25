"""Draws the deck's charts from the cited numbers in pitch/charts/data.csv-style tables below.

Every number here is copied from an official source listed in pitch/README.md; nothing is
estimated. Charts are transparent PNGs in the UniversityFlow brand (packages/tokens).
Run: python pitch/scripts/charts.py
"""
import os
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "charts"))
FONTS = os.path.abspath(os.path.join(HERE, "..", "fonts"))
os.makedirs(OUT, exist_ok=True)
for f in ("Outfit-Regular.ttf", "Outfit-Bold.ttf"):
    font_manager.fontManager.addfont(os.path.join(FONTS, f))

# packages/tokens
INK = "#F4F2F5"
MUTED = "#B9B4BC"
LINE = "#2E2C32"
CONTEXT = "#6E6875"  # neutral for context bars (between line and lineStrong)
BRAND = "#C99BB8"
ACCENT = "#E9B8D4"
DANGER = "#FF8A80"
SUCCESS = "#4ADE80"

plt.rcParams.update({
    "font.family": "Outfit",
    "font.size": 15,
    "text.color": INK,
    "axes.labelcolor": MUTED,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "axes.edgecolor": LINE,
    "savefig.transparent": True,
})


def clean(ax, grid=True):
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(LINE)
    ax.tick_params(length=0)
    if grid:
        ax.yaxis.grid(True, color=LINE, linewidth=1)
        ax.set_axisbelow(True)


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=200)
    plt.close(fig)
    print("wrote", path)


# 1. NSC: wrote vs bachelor passes, full-time candidates (DBE NSC Examination Reports 2021, 2024, 2025)
years = [2019, 2020, 2021, 2022, 2023, 2024, 2025]
wrote = [504303, 578468, 704021, 725146, 691160, 705291, 746110]
bachelor = [186058, 210820, 256031, 278814, 282894, 337158, 345857]
bach_pct = [36.9, 36.4, 36.4, 38.4, 40.9, 47.8, 46.4]
fig, ax = plt.subplots(figsize=(7.4, 4.3))
x = range(len(years))
w = 0.38
ax.bar([i - w / 2 - 0.01 for i in x], [v / 1000 for v in wrote], w, color=CONTEXT, label="Wrote", zorder=2)
ax.bar([i + w / 2 + 0.01 for i in x], [v / 1000 for v in bachelor], w, color=BRAND, label="Bachelor pass", zorder=2)
for i, p in enumerate(bach_pct):
    ax.text(i + w / 2 + 0.01, bachelor[i] / 1000 + 14, f"{p:.1f}%", ha="center", va="bottom", fontsize=12.5, color=INK, fontweight="bold")
ax.set_xticks(list(x))
ax.set_xticklabels([str(y) for y in years])
ax.set_ylim(0, 820)
ax.set_yticks([0, 200, 400, 600, 800])
ax.set_yticklabels(["0", "200k", "400k", "600k", "800k"])
clean(ax)
leg = ax.legend(loc="upper left", frameon=False, ncol=2, fontsize=13, handlelength=1, handleheight=1)
for t in leg.get_texts():
    t.set_color(MUTED)
fig.tight_layout()
save(fig, "nsc-bachelor-passes.png")

# 2. Mathematics, NSC 2025 (DBE 2025 NSC Examination Report, Tables 1, 2.1, 3, 6.3.8)
labels = ["Wrote the NSC", "Wrote Mathematics", "Maths 30% or more", "Maths 50% or more", "Maths 60% or more"]
vals = [746110, 254415, 162947, 63813, 34243]
colors = [CONTEXT, CONTEXT, CONTEXT, BRAND, BRAND]
fig, ax = plt.subplots(figsize=(7.2, 2.75))
y = list(range(len(vals)))[::-1]
ax.barh(y, [v / 1000 for v in vals], 0.62, color=colors, zorder=2)
for yi, v, lab in zip(y, vals, labels):
    ax.text(v / 1000 + 10, yi, f"{v:,}".replace(",", " "), va="center", fontsize=14, color=INK, fontweight="bold")
ax.set_yticks(y)
ax.set_yticklabels(labels, fontsize=14, color=INK)
ax.set_xlim(0, 900)
ax.set_xticks([])
for s in ("top", "right", "bottom"):
    ax.spines[s].set_visible(False)
ax.spines["left"].set_color(LINE)
ax.tick_params(length=0)
fig.tight_layout()
save(fig, "maths-2025.png")

# 3. Of 100 who start a 3-year degree (2015 first-time entering cohort, contact and distance,
#    DHET 2000 to 2019 cohort study, Table 28). Squares are rounded; labels are exact.
parts = [
    (28.6, "Graduated in 3 years", SUCCESS),
    (38.4, "Graduated in years 4 to 6", BRAND),
    (20.2, "Dropped out by year 6", DANGER),
    (12.8, "Neither, by year 6", CONTEXT),
]
counts = [29, 38, 20, 13]
fig, ax = plt.subplots(figsize=(4.6, 4.6))
k = 0
cells = []
for (pct, lab, col), n in zip(parts, counts):
    cells += [col] * n
for idx, col in enumerate(cells):
    r, c = divmod(idx, 10)
    ax.add_patch(plt.Rectangle((c, 9 - r), 0.84, 0.84, color=col, linewidth=0))
ax.set_xlim(-0.1, 10)
ax.set_ylim(-0.1, 10)
ax.set_aspect("equal")
ax.axis("off")
fig.tight_layout(pad=0.1)
save(fig, "degree-100.png")

# 4. Graduated within 3 years vs by year 6, 3-year degrees, by intake (DHET cohort study, Table 28)
cohorts = ["2011", "2013", "2014", "2015"]
in3 = [20.9, 26.8, 28.3, 28.6]
by6 = [54.6, 63.9, 66.0, 67.0]
fig, ax = plt.subplots(figsize=(5.6, 3.6))
x = range(len(cohorts))
ax.bar([i - w / 2 - 0.01 for i in x], in3, w, color=SUCCESS, label="Graduated in 3 years", zorder=2)
ax.bar([i + w / 2 + 0.01 for i in x], by6, w, color=BRAND, label="Graduated by year 6", zorder=2)
for i in x:
    ax.text(i - w / 2 - 0.01, in3[i] + 1.5, f"{in3[i]:.1f}", ha="center", fontsize=12, color=INK)
    ax.text(i + w / 2 + 0.01, by6[i] + 1.5, f"{by6[i]:.1f}", ha="center", fontsize=12, color=INK)
ax.set_xticks(list(x))
ax.set_xticklabels([f"{c} intake" for c in cohorts], fontsize=12.5)
ax.set_ylim(0, 85)
ax.set_yticks([0, 25, 50, 75])
ax.set_yticklabels(["0%", "25%", "50%", "75%"])
clean(ax)
leg = ax.legend(loc="upper left", frameon=False, ncol=2, fontsize=12, handlelength=1, handleheight=1)
for t in leg.get_texts():
    t.set_color(MUTED)
fig.tight_layout()
save(fig, "degree-cohorts.png")

# 5. NSFAS-funded university students (Minister's reply to Parliament NW874, 2026, via PMG)
nyears = ["2023", "2024", "2025"]
nvals = [509978, 561130, 593543]
fig, ax = plt.subplots(figsize=(5.2, 1.75))
ax.barh(range(3)[::-1], [v / 1000 for v in nvals], 0.6, color=[CONTEXT, CONTEXT, BRAND], zorder=2)
for yi, v in zip(range(3)[::-1], nvals):
    ax.text(v / 1000 + 8, yi, f"{v:,}".replace(",", " "), va="center", fontsize=12, color=INK)
ax.set_yticks(range(3)[::-1])
ax.set_yticklabels(nyears, fontsize=12, color=MUTED)
ax.set_xlim(0, 760)
ax.set_xticks([])
for sp in ("top", "right", "bottom"):
    ax.spines[sp].set_visible(False)
ax.spines["left"].set_color(LINE)
ax.tick_params(length=0)
fig.tight_layout(pad=0.3)
save(fig, "nsfas-students.png")
