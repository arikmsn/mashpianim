"""Regenerate every PWA / browser icon from public/logo.png (the brand file the owner maintains).

Run from app/ after replacing public/logo.png:   python scripts/gen-icons.py
Needs Python 3 with Pillow and numpy. Then bump CACHE_NAME / STATIC_CACHE in public/sw.js so installed apps
drop their cached copies.

Outputs (in public/):
  icon-192.png, icon-512.png             purpose "any": the rounded-square logo edge to edge, transparent corners
  icon-192-maskable.png, icon-512-maskable.png
                                         purpose "maskable": the logo's gradient bleeds past the canvas (no white or
                                         empty corners under Android's circle/squircle masks) and the white artwork
                                         (phone, M, sparks) sits inside the 40 % safe zone
  apple-icon.png (180x180)               iOS home-screen icon: full-bleed gradient, artwork at the regular size
  favicon.ico (16/32/48)                 real ICO built from the transparent version
Optional: a second argument = directory for a preview sheet (icon-preview.png) and the gradient-only layer.

How it works: the logo is a rounded gradient square with white artwork. The artwork is lifted off by its
whiteness, the gradient under it is inpainted (normalised blur), the clean gradient is scaled so its straight
edges pass outside the canvas, and the artwork is composited back at the size each platform's mask allows.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "public")
OUT_PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None

src = Image.open(os.path.join(PUBLIC, "logo.png")).convert("RGBA")
L, T, R, B = src.getchannel("A").getbbox()
crop = src.crop((L, T, R, B))
w, h = crop.size
side = max(w, h)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(crop, ((side - w) // 2, (side - h) // 2))

# Corner radius ≈ where the straight top edge begins
top_row = [x for x in range(w) if crop.getpixel((x, 0))[3] > 128]
radius = top_row[0]
inset = radius * (1 - 1 / math.sqrt(2))  # per side, to be fully covered by the rounded square

# --- Separate the white artwork from the gradient -------------------------------------------------
arr = np.asarray(sq).astype(np.float32)
rgb, alpha = arr[..., :3], arr[..., 3]
whiteness = np.clip((rgb.min(axis=2) - 150.0) / (235.0 - 150.0), 0.0, 1.0) * (alpha / 255.0)
art_alpha = Image.fromarray((whiteness * 255).astype(np.uint8), "L")
art_layer = Image.new("RGBA", (side, side), (255, 255, 255, 0))
art_layer.putalpha(art_alpha)

# Pixels to inpaint: the artwork, the phone's glossy highlight (a faint white tint) and a halo for anti-aliased edges
tinted = Image.fromarray(((rgb.min(axis=2) > 120) & (alpha > 250)).astype(np.uint8) * 255, "L")
hole = np.asarray(tinted.filter(ImageFilter.MaxFilter(17))) > 0
inside = alpha > 250
valid = inside & ~hole

fill = np.where(valid[..., None], rgb, 0.0).astype(np.float32)
weights = valid.astype(np.float32)


def _box(a, r, axis):
    # mean over a (2r+1) window along one axis, zero padded (cumulative sums; Pillow can't blur float images)
    pad = [(0, 0), (0, 0)]
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad), axis=axis)
    n = 2 * r + 1
    return (c[n:, :] - c[:-n, :]) / n if axis == 0 else (c[:, n:] - c[:, :-n]) / n


def blur(a, r):
    # three box passes ≈ a Gaussian; applied identically to values and weights, so the ratio stays normalised
    a = a.astype(np.float64)
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a.astype(np.float32)


for r in (3, 6, 12, 24, 48, 96, 192):
    den = blur(weights, r)
    can = (den > 1e-3) & ~valid & inside
    if not can.any():
        continue
    for c in range(3):
        num = blur(fill[..., c] * weights, r)
        fill[..., c][can] = num[can] / den[can]
    valid = valid | can
    weights = valid.astype(np.float32)

clean = np.dstack([np.where(inside[..., None], np.where(hole[..., None], fill, rgb), 0.0), alpha[..., None]])
clean_sq = Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8), "RGBA")  # gradient only, no artwork

# Artwork extent from the centre (for the safe-zone maths)
ys, xs = np.nonzero(whiteness > 0.5)
art_radius = float(np.hypot(xs - side / 2, ys - side / 2).max())
print(f"logo crop {w}x{h}, square {side}, corner radius {radius}px ({radius/side:.1%}), "
      f"artwork reaches {art_radius:.0f}px from the centre ({art_radius/side:.1%} of the side)")


def any_icon(size):
    return sq.resize((size, size), Image.LANCZOS)


def bleed_gradient(size):
    # Scale the clean gradient so the rounded square's straight edges pass outside the canvas
    scale = size / (side - 2 * inset) * 1.03
    big_side = int(math.ceil(side * scale))
    big = clean_sq.resize((big_side, big_side), Image.LANCZOS)
    off = (big_side - size) // 2
    out = big.crop((off, off, off + size, off + size))
    min_alpha = int(np.asarray(out.getchannel("A")).min())
    if min_alpha < 240:
        raise SystemExit(f"gradient {size}: corners not covered (min alpha {min_alpha})")
    return out.convert("RGB")


def composed_icon(size, art_fraction):
    """Full-bleed gradient + the white artwork scaled so its farthest point sits at art_fraction of the width."""
    bg = bleed_gradient(size).convert("RGBA")
    art_scale = art_fraction * size / art_radius
    art_side = int(round(side * art_scale))
    art = art_layer.resize((art_side, art_side), Image.LANCZOS)
    off = (size - art_side) // 2
    bg.alpha_composite(art, (off, off))
    print(f"{size}px: artwork reaches {art_fraction:.0%} of the width from the centre "
          f"(safe zone 40%, circle mask 50%, iOS corner cut ~61% on the diagonal)")
    return bg.convert("RGB")


for size in (192, 512):
    any_icon(size).save(os.path.join(PUBLIC, f"icon-{size}.png"), optimize=True)

maskable_512 = composed_icon(512, 0.43)
maskable_512.save(os.path.join(PUBLIC, "icon-512-maskable.png"), optimize=True)
maskable_512.resize((192, 192), Image.LANCZOS).save(os.path.join(PUBLIC, "icon-192-maskable.png"), optimize=True)

# iOS: the artwork keeps the size it has in the regular icon (its radius there is art_radius/side of the width)
composed_icon(180, art_radius / side).save(os.path.join(PUBLIC, "apple-icon.png"), optimize=True)

any_icon(256).save(os.path.join(PUBLIC, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# --- Previews (optional) --------------------------------------------------------------------------
if OUT_PREVIEW:
    m = Image.open(os.path.join(PUBLIC, "icon-512-maskable.png")).convert("RGBA")
    a = Image.open(os.path.join(PUBLIC, "icon-512.png")).convert("RGBA")
    ap = Image.open(os.path.join(PUBLIC, "apple-icon.png")).convert("RGBA").resize((512, 512), Image.LANCZOS)
    circle = Image.new("L", (512, 512), 0); ImageDraw.Draw(circle).ellipse((0, 0, 511, 511), fill=255)
    squircle = Image.new("L", (512, 512), 0); ImageDraw.Draw(squircle).rounded_rectangle((0, 0, 511, 511), radius=140, fill=255)
    ios = Image.new("L", (512, 512), 0); ImageDraw.Draw(ios).rounded_rectangle((0, 0, 511, 511), radius=115, fill=255)
    tiles = []
    for im, mask in ((m, circle), (m, squircle), (ap, ios)):
        t = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); t.paste(im, (0, 0), mask); tiles.append(t)
    on_white = Image.new("RGBA", (512, 512), (255, 255, 255, 255)); on_white.alpha_composite(a); tiles.append(on_white)
    on_dark = Image.new("RGBA", (512, 512), (11, 5, 29, 255)); on_dark.alpha_composite(a); tiles.append(on_dark)
    prev = Image.new("RGBA", (512 * len(tiles) + 50 * (len(tiles) + 1), 512 + 100), (120, 120, 120, 255))
    for i, t in enumerate(tiles):
        prev.alpha_composite(t, (50 + i * (512 + 50), 50))
    prev.convert("RGB").save(os.path.join(OUT_PREVIEW, "icon-preview.png"))
    clean_sq.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT_PREVIEW, "gradient-only.png"))

for name in ("icon-192.png", "icon-512.png", "icon-192-maskable.png", "icon-512-maskable.png", "apple-icon.png", "favicon.ico"):
    im = Image.open(os.path.join(PUBLIC, name))
    print(f"{name:24s} {im.format} {im.size} {im.mode} {os.path.getsize(os.path.join(PUBLIC, name))//1024} KB")
