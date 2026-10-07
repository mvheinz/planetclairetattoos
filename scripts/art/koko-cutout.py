#!/usr/bin/env python3
"""Koko (P12.6, U-08): schneidet die Hündin aus Juttas Malerei frei und säubert sie.

Aufruf:  python3 scripts/art/koko-cutout.py            (Python 3 mit pillow, numpy, opencv-python)
Eingang: content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg (Foto, T-Shirt)
Ausgang: public/art/koko.v2.webp (RGBA, ohne Knochenkreuz/Schrift/Shirt) und src/art/koko/koko.json
         (Maße und Lage der Augen für die animierten Pupillen).

Schritte: 1) Maske aus Tusche (dunkel) + Orange, Löcher gefüllt (weiße Brust/Pfoten), Knochenkreuz abgeschnitten,
2) Shirt-Falten/Grauschleier in den weißen Flächen werden zu sauberem Warmweiß, Strich/Fell/Aquarell bleiben,
3) Kanten weich und der Tusche folgend (feine Haare bleiben), 4) die beiden Original-Pupillen werden übermalt
(Augen = Weiß), im Browser wandern frische Pupillen darüber, 5) auf ≈ 660 px Breite verkleinert, WebP mit Alpha.
"""
import json
import pathlib

import cv2
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / 'content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg'
OUT = ROOT / 'public/art/koko.v2.webp'
META = ROOT / 'src/art/koko/koko.json'
OUT_W = 700
QUALITY = 80

im = cv2.imread(str(SRC))
Hh, Ww = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
V = hsv[..., 2].astype(np.float32)
S = hsv[..., 1].astype(np.float32)
H = hsv[..., 0].astype(np.float32)
rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32)
yy, xx = np.mgrid[:Hh, :Ww]


def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def ell(k):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))


# ---------------------------------------------------------------- 1) Maske
dark = np.where(yy > 850, V < 100, V < 125)
orange = (S > 85) & (V > 90) & ((H < 30) | (H > 170))
m = dark | orange
m[yy < 322] = False  # Knochenkreuz (rechter Arm endet über der Kappenspitze)
m[(yy < 445) & (xx < 690)] = False  # Kreuz, senkrechter Knochen
bob_r = ((xx - 827) / 34.0) ** 2 + ((yy - 341) / 32.0) ** 2 <= 1
m |= bob_r & (V < 140)
m[(yy < 305) | (xx > 880) | (xx < 120) | (yy > 1420)] = False
m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, ell(9))


def fill_holes(b):
    pad = np.pad(b.astype(np.uint8), 1)
    mk = np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8)
    cv2.floodFill(pad, mk, (0, 0), 2)
    return pad[1:-1, 1:-1] != 2


F = fill_holes(m)
n, lab, st, _ = cv2.connectedComponentsWithStats(F.astype(np.uint8), connectivity=8)
keep = np.zeros_like(F)
for i in range(1, n):
    if st[i, 4] > 3000:
        keep |= lab == i
F = keep.astype(np.uint8)


def poly(pts, ox, oy, sc=2):
    return np.array([[ox + x / sc, oy + y / sc] for x, y in pts], np.int32)


# Mittlere Vorderpfote und Schwanzspitze: Umriss ist offen, daher von Hand geschlossen (Umrisslinie = Rand)
paw = poly([(335, 200), (390, 230), (450, 270), (500, 320), (525, 380), (528, 450), (500, 492), (452, 516),
            (420, 484), (395, 432), (360, 362), (330, 310)], 340, 1130)
tail = poly([(870, 110), (960, 140), (1040, 160), (1130, 150), (1190, 175), (1232, 215), (1190, 262),
             (1100, 272), (1010, 245), (940, 222), (890, 170)], 340, 1130)
for p in (paw, tail):
    cv2.fillPoly(F, [p], 1)

# Nur die Büste (Jutta, 07.10.): Kopf mit Narrenkappe, Bommeln und dem spitzen Fellkragen. Der Schnitt folgt den
# Kragenzacken (Koordinaten im Originalfoto), darunter kein Körper, keine Pfoten, kein Schwanz.
KEEP = np.array([(395, 815), (425, 792), (455, 770), (480, 772), (497, 800), (507, 826), (522, 828), (535, 800),
                 (548, 792), (562, 806), (578, 828), (600, 842), (618, 800), (628, 772), (645, 790), (665, 822),
                 (690, 852), (703, 868), (716, 830), (722, 790), (735, 776), (758, 768), (782, 757), (808, 758),
                 (838, 780), (900, 780), (900, 250), (100, 250), (100, 815)], np.int32)
keep_mask = np.zeros((Hh, Ww), np.uint8)
cv2.fillPoly(keep_mask, [KEEP], 1)
F = (F & keep_mask).astype(np.uint8)
n2, l2, s2, _ = cv2.connectedComponentsWithStats(F, connectivity=8)
F = np.zeros_like(F)
for i in range(1, n2):
    if s2[i, 4] > 3000:
        F[l2 == i] = 1

# ---------------------------------------------------------------- 2) Farben säubern
warm = rgb[..., 0] - rgb[..., 2]
Fd = cv2.dilate(F, ell(31))
w = (1 - Fd).astype(np.float32)
norm = np.maximum(cv2.GaussianBlur(w, (0, 0), 30), 1e-3)
bg = np.stack([cv2.GaussianBlur(rgb[..., c] * w, (0, 0), 30) / norm for c in range(3)], -1)
bgV = cv2.GaussianBlur(V * w, (0, 0), 30) / norm
satw = sstep(warm, 25, 80)  # Orange/Creme (warm) gegen bläuliches Shirt
tw = np.where(yy > 850, sstep(V, 78, 122), sstep(V, 100, 150)) * (1 - satw)
WHITE = np.array([253, 250, 243], np.float32)
adj = rgb * (1 - 0.25 * ((1 - satw) * (1 - sstep(V, 60, 150)))[..., None])
# Aquarell: leicht kräftiger (Foto ist flau)
lum = adj.mean(-1, keepdims=True)
adj = np.clip(lum + (adj - lum) * (1 + 0.18 * satw[..., None]), 0, 255)
adj = np.clip(adj * (1 + 0.06 * satw[..., None]), 0, 255)
clean = adj * (1 - tw[..., None]) + WHITE * tw[..., None]

# Kragenrand: orange/weiße Reste direkt am Schnitt (≤ 30 px vom Rand) entfernen, nur das schwarze Fell bleibt
dist = cv2.distanceTransform(F, cv2.DIST_L2, 5)
bad = (((satw > 0.25) | (tw > 0.35)) & (F > 0) & (dist <= 30) & (yy > 745)).astype(np.uint8)
free = ((F == 0) | (bad > 0)).astype(np.uint8)
nb, lb, _, _ = cv2.connectedComponentsWithStats(free, connectivity=8)
F = np.where((bad > 0) & (lb == lb[0, 0]), 0, F).astype(np.uint8)
F = cv2.morphologyEx(F, cv2.MORPH_OPEN, ell(3))

# ---------------------------------------------------------------- 4) Augen: Original-Pupillen übermalen
# Pupille (Originalfoto-Koordinaten): Mitte, Halbachsen. Augapfel = konvexe Hülle aus Weiß und Pupille.
EYES = {
    'l': dict(roi=(515, 548, 602, 616), c=(508, 581), r=(21, 25)),
    'r': dict(roi=(695, 540, 762, 614), c=(680, 575), r=(24, 25)),
}
eye_mask = np.zeros((Hh, Ww), np.uint8)
hulls = {}
for k, e in EYES.items():
    x0, y0, x1, y1 = e['roi']
    white = ((tw > 0.9) & (F > 0)).astype(np.uint8)
    roi = np.zeros_like(white)
    roi[y0:y1, x0:x1] = white[y0:y1, x0:x1]
    nn, lb, stt, _ = cv2.connectedComponentsWithStats(roi, connectivity=8)
    big = 1 + int(np.argmax(stt[1:, 4]))
    blob = (lb == big).astype(np.uint8)
    pup = np.zeros_like(blob)
    cv2.ellipse(pup, e['c'], e['r'], 0, 0, 360, 1, -1)
    pts = cv2.findNonZero(blob | pup)
    hull = cv2.convexHull(pts)[:, 0, :]
    hulls[k] = hull
    cv2.fillPoly(eye_mask, [hull.astype(np.int32)], 1)
eye_soft = cv2.GaussianBlur(eye_mask.astype(np.float32), (0, 0), 1.0)
clean = clean * (1 - eye_soft[..., None]) + WHITE * eye_soft[..., None]
# feiner Tuscherand (Lidstrich) um jedes Auge, wie im Original unter dem Weiß
rim = np.zeros((Hh, Ww), np.uint8)
for hull in hulls.values():
    cv2.polylines(rim, [hull.astype(np.int32)], True, 1, 4, cv2.LINE_AA)
rim = cv2.GaussianBlur(rim.astype(np.float32), (0, 0), 1.0)
INK = np.array([22, 20, 24], np.float32)
clean = clean * (1 - rim[..., None]) + INK * rim[..., None]

# ---------------------------------------------------------------- 3) Alpha (Kanten folgen der Tusche)
Fsoft = sstep(cv2.GaussianBlur(F.astype(np.float32), (0, 0), 1.3), 0.35, 0.65)
core = cv2.erode(F, ell(7)).astype(np.float32)
near = cv2.dilate(F, ell(9)).astype(np.float32)
cov = np.clip((bgV - 14 - V) / (bgV - 14 - 70), 0, 1) * near
a = np.maximum(Fsoft, cov)
a = np.where(core > 0, 1.0, a)
# rosa Aquarell-Hof unter dem rechten Bommel weglassen: dort nur die Kugel selbst
bob_soft = sstep(1.18 - np.sqrt(((xx - 827) / 34.0) ** 2 + ((yy - 341) / 32.0) ** 2), 0.0, 0.2)
a = np.where((xx > 800) & (yy < 372), a * bob_soft, a)
dec = np.clip((rgb - (1 - a[..., None]) * bg) / np.maximum(a, 0.08)[..., None], 0, 255)
dec = np.minimum(dec, clean)
col = np.where((core[..., None] > 0) | (Fsoft[..., None] > 0.99), clean, dec)

# Kragenrand: letzte Orange-/Weißreste in den Randpixeln werden Tusche
dist2 = cv2.distanceTransform((a > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
edge = (dist2 <= 9) & (yy > 745) & ((satw > 0.12) | (tw > 0.2) | (V > 120))
col = np.where(edge[..., None], INK * 1.0, col)
a = np.where((yy > 745) & (dist2 <= 9) & edge & (a < 0.6), 0, a)

# ---------------------------------------------------------------- 5) Zuschnitt, Skalierung, Export
ys, xs = np.where(a > 0.05)
pad = 6
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, Ww)
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, Hh)
s = OUT_W / (x1 - x0)
out_h = int(round((y1 - y0) * s))
pm = np.dstack([col * a[..., None], a * 255])[y0:y1, x0:x1].astype(np.float32)
pm = cv2.resize(pm, (OUT_W, out_h), interpolation=cv2.INTER_AREA)
al = pm[..., 3:4] / 255.0
res = np.dstack([np.where(al > 0.004, pm[..., :3] / np.maximum(al, 0.004), 0), pm[..., 3]])
res = np.clip(res, 0, 255).astype(np.uint8)
Image.fromarray(res, 'RGBA').save(OUT, 'WEBP', quality=QUALITY, method=6, alpha_quality=90, exact=False)

meta = {'w': OUT_W, 'h': out_h, 'eyes': {}}
for k, e in EYES.items():
    tx = lambda x: round((x - x0) * s, 1)
    ty = lambda y: round((y - y0) * s, 1)
    hp = np.array([[(px - x0) * s, (py - y0) * s] for px, py in hulls[k]], np.float32)
    hp = cv2.approxPolyDP(hp.reshape(-1, 1, 2), 0.7, True)[:, 0, :]
    hull = [[round(float(px), 1), round(float(py), 1)] for px, py in hp]
    # Pupille: Mittelpunkt links; Weg bis zum rechten Ende des Augapfels
    cx, cy = tx(e['c'][0]), ty(e['c'][1])
    rx, ry = round(e['r'][0] * s, 1), round(e['r'][1] * s, 1)
    right = max(p[0] for p in hull)
    travel = round(right - rx - 2 - cx, 1)
    meta['eyes'][k] = dict(cx=cx, cy=cy, rx=rx, ry=ry, travel=travel, hull=hull)
META.parent.mkdir(parents=True, exist_ok=True)
META.write_text(json.dumps(meta, separators=(',', ':')) + '\n')
print(OUT, OUT.stat().st_size, 'bytes', OUT_W, 'x', out_h)
