#!/usr/bin/env python3
"""Koko (P12.6 U-08, P13.2 U-41): schneidet die Hündin aus Juttas Malerei frei und säubert sie.

Aufruf:  python3 scripts/art/koko-cutout.py            (Python 3 mit pillow, numpy, opencv-python)
Eingang: content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg (Foto, T-Shirt)
Ausgang: public/art/koko.v3.webp (RGBA, ohne Knochenkreuz/Schrift/Shirt) und src/art/koko/koko.json
         (Maße, Umriss der Augäpfel und Form/Lage der Pupillen für die Animation).

Schritte: 1) Maske aus Tusche (dunkel) + Orange, Löcher gefüllt (weiße Brust/Pfoten), Knochenkreuz abgeschnitten,
2) Shirt-Falten/Grauschleier in den weißen Flächen werden zu sauberem Warmweiß, Strich/Fell/Aquarell bleiben,
3) Kanten weich und der Tusche folgend (feine Haare bleiben),
4) Augen (U-41): Augapfel = das Weiß des Originals + die gemalte Pupille + der Übergang dazwischen (keine Hülle, keine
   Ellipse); nur die Pupille wird mit dem Augenweiß übermalt (Weiß zeilenweise gespiegelt, Schattierung und Stoffstruktur
   bleiben), Lidstrich und Umriss bleiben Juttas Tusche. Im Browser wandern frische Pupillen in Juttas Form darüber,
   beschnitten auf diesen Augapfel-Umriss,
5) Ausschnitt (U-41): Büste mit Kragenspitzen, Ansatz der orangen Brust und weißem Brustfleck; der untere Rand läuft
   wie ein trockener Pinselstrich weich ins Papier aus (leicht gewellt, kein gerader Schnitt),
6) auf 700 px Breite verkleinert, WebP mit Alpha.
"""
import json
import pathlib

import cv2
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / 'content/art/jutta-skizzen/koko-vorsitzende-goth-dogs-01.jpg'
OUT = ROOT / 'public/art/koko.v3.webp'
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


def fill_holes(b):
    pad = np.pad(b.astype(np.uint8), 1)
    mk = np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8)
    cv2.floodFill(pad, mk, (0, 0), 2)
    return pad[1:-1, 1:-1] != 2


def biggest(b):
    n, lab, st, _ = cv2.connectedComponentsWithStats(b.astype(np.uint8), connectivity=8)
    if n < 2:
        return np.zeros_like(b, np.uint8)
    return (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8)


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

# ---------------------------------------------------------------- 5) Ausschnitt (U-41)
# Büste: Kopf mit Narrenkappe und Bommeln, die spitzen Kragenzacken ganz, darunter der Ansatz der orangen Brust mit dem
# weißen Brustfleck (≈ ein Drittel der Kappenlänge unter dem Kragen). Unten schließt ein flacher Bogen wie bei einer
# gemalten Büste ab, gezogen als zittriger Tuschestrich in Juttas Art (ungleich dick, leicht wellig) – kein gerader
# Bildschnitt, kein Ausfransen.
CUT_MID = 944.0  # tiefster Punkt des Bogens (Originalfoto-Koordinaten); Kragen ≈ 780–850, Kappe ≈ 305–850
CUT_X = 610.0
CUT_K = 0.0019  # flacher Bogen: die Seiten (Körperrand x ≈ 420 / 810) liegen ≈ 70–80 px höher
xs_line = np.arange(300, 900, 1, dtype=np.float32)


def hand(n, sigma, amp, seed):
    """Zittern der Hand: geglättetes Rauschen (Breite `sigma` px, Ausschlag `amp` px)."""
    r = np.random.default_rng(seed).normal(0, 1, n + 8 * sigma)
    k = np.exp(-0.5 * (np.arange(-4 * sigma, 4 * sigma + 1) / sigma) ** 2)
    v = np.convolve(r, k / k.sum(), mode='same')[4 * sigma: 4 * sigma + n]
    return v / (v.std() + 1e-6) * amp


cut_of_x = (CUT_MID - CUT_K * (xs_line - CUT_X) ** 2 + hand(xs_line.size, 28, 2.6, 7)
            + hand(xs_line.size, 4, 0.7, 8))
cut_line = np.interp(xx, xs_line, cut_of_x).astype(np.float32)
F = (F & (yy < cut_line + 2)).astype(np.uint8)
n2, l2, s2, _ = cv2.connectedComponentsWithStats(F, connectivity=8)
F = np.zeros_like(F)
for i in range(1, n2):
    if s2[i, 4] > 3000:
        F[l2 == i] = 1
# Tuschestrich entlang des Bogens wie Juttas Umrisslinien: von Körperrand zu Körperrand, rechts ein wenig darüber hinaus
# (offene Kontur), Breite schwankt 1,8–4,6 px, Anfang und Ende laufen spitz aus; in der Mitte ein kurzer zweiter Zug
# (nachgezogen), leicht versetzt.
SS = 4
stroke_hi = np.zeros((Hh * SS, Ww * SS), np.uint8)
inside_x = [x for x, y in zip(xs_line, cut_of_x) if F[int(y) - 4, int(x)] > 0]
lx, rx_ = min(inside_x), max(inside_x)


def draw(seg, wid):
    n_ = len(seg)
    taper = np.minimum(1, np.minimum(np.arange(n_), np.arange(n_)[::-1]) / 16.0)
    for i in range(n_ - 1):
        (xa, ya), (xb, yb) = seg[i], seg[i + 1]
        wv = max(0.8, wid[i] * (0.35 + 0.65 * taper[i]))
        cv2.line(stroke_hi, (int(xa * SS), int(ya * SS)), (int(xb * SS), int(yb * SS)), 255,
                 max(1, int(round(wv * SS))), cv2.LINE_AA)


main = [(x, y) for x, y in zip(xs_line, cut_of_x) if lx + 3 <= x <= rx_ + 7]
draw(main, 3.2 + hand(len(main), 22, 0.9, 9))
mid = [(x, y + 1.6 + 0.6 * np.sin(x / 9.0)) for x, y in main if 520 <= x <= 650]
draw(mid, 1.6 + hand(len(mid), 10, 0.4, 10))
stroke = cv2.resize(stroke_hi, (Ww, Hh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
bust = sstep(cut_line - yy, -0.5, 1.0)  # 1 über dem Bogen, 0 darunter (1,5 px Kantenglättung)

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
# Weiß (Brustfleck, Glanzlichter): Grauschleier des Shirts weg, ein Hauch der gemalten Struktur bleibt (kein Flachweiß)
ref_w = np.percentile(rgb[860:930, 540:680].reshape(-1, 3), 90, axis=0)
white_t = np.clip(WHITE - (WHITE - np.clip(rgb * (WHITE / ref_w), 0, 255)) * 0.3, 0, 255)
clean = adj * (1 - tw[..., None]) + white_t * tw[..., None]

# ---------------------------------------------------------------- 4) Augen (U-41)
# Fenster je Auge (Originalfoto-Koordinaten) und ein großzügiges Vieleck, das die gemalte Pupille vom schwarzen Fell
# darüber trennt (beim rechten Auge geht die Pupille oben ins Kappenfell über).
EYES = {
    'l': dict(win=(472, 535, 600, 618), pupil_zone=[(482, 548), (530, 548), (530, 612), (482, 612)]),
    'r': dict(win=(645, 535, 760, 615), pupil_zone=[(655, 549), (700, 547), (712, 600), (655, 600)]),
}
Vb = cv2.GaussianBlur(V, (0, 0), 2.0)


def lid_curve(cols_a, edge_a, cols_b, edge_b, xs_eval):
    """Lidkante über der (unter der) Pupille: Parabel durch die Kante des Weiß und die Kante der gemalten Pupille – der Bogen
    läuft vom Weiß stetig zur Pupille, ohne Stufe und ohne Ecke."""
    c = np.polyfit(np.concatenate([cols_a, cols_b]), np.concatenate([edge_a, edge_b]), 2)
    return np.polyval(c, xs_eval)


eye_data = {}
eye_any = np.zeros((Hh, Ww), np.uint8)
for k, e in EYES.items():
    x0, y0, x1, y1 = e['win']
    win = np.zeros((Hh, Ww), np.uint8)
    win[y0:y1, x0:x1] = 1
    # Augenweiß: helle Fläche im Fenster (größtes Stück), Kanten wie gemalt
    white = biggest((Vb > 140) & (win > 0))
    # Pupille: sehr dunkle, geschlossene Fläche in der Pupillen-Zone, die an das Weiß grenzt
    zone = np.zeros((Hh, Ww), np.uint8)
    cv2.fillPoly(zone, [np.array(e['pupil_zone'], np.int32)], 1)
    pupil = biggest((Vb < 22) & (zone > 0))
    pupil = cv2.morphologyEx(pupil, cv2.MORPH_OPEN, ell(5))
    pupil = fill_holes(pupil).astype(np.uint8)
    # Übergang Pupille ↔ Weiß: je Zeile die Lücke zwischen rechtem Pupillenrand und linkem Rand des Weiß
    bridge = np.zeros((Hh, Ww), np.uint8)
    for y in range(y0, y1):
        px = np.nonzero(pupil[y, x0:x1])[0]
        wx = np.nonzero(white[y, x0:x1])[0]
        if len(px) and len(wx):
            a, b = x0 + px.max(), x0 + wx.min()
            if b > a:
                bridge[y, a:b + 1] = 1
    ball = (white | pupil | bridge).astype(np.uint8)
    # Wo die gemalte Pupille über den Lidstrich reicht (oben/unten), endet der Augapfel an der fortgesetzten Lidkante des
    # Weiß – sonst bliebe nach dem Übermalen ein Höcker. Der linke Rand bleibt der gemalte Pupillenrand (dort liegt
    # Juttas grauer Augenring).
    heights = np.array([np.count_nonzero(white[:, x]) for x in range(x0, x1)])
    full = [x0 + i for i, h_ in enumerate(heights) if h_ >= 0.6 * heights.max()]
    wcols = np.array([x for x in range(full[0], full[-1] + 1)])
    wtop = np.array([np.nonzero(white[:, x])[0].min() for x in wcols], np.float32)
    wbot = np.array([np.nonzero(white[:, x])[0].max() for x in wcols], np.float32)
    left_cols = np.arange(x0, full[0])
    if len(left_cols):
        pcols = np.array([x for x in left_cols if pupil[:, x].any()])
        # mittlere Pupillenspalten (Ränder links fallen steil ab und gehören zum Augenring)
        pc = pcols[len(pcols) // 3:]
        ptop = np.array([np.nonzero(pupil[:, x])[0].min() for x in pc], np.float32)
        pbot = np.array([np.nonzero(pupil[:, x])[0].max() for x in pc], np.float32)
        top = lid_curve(wcols[:24], wtop[:24], pc, ptop, left_cols)
        bot = lid_curve(wcols[:24], wbot[:24], pc, pbot, left_cols)
        # je Zeile von der linken Pupillenkante an gefüllt, oben/unten an den Lidbögen begrenzt
        lefts = {y: x0 + np.nonzero(pupil[y, x0:x1])[0].min() for y in range(y0, y1) if pupil[y, x0:x1].any()}
        for x, t, bt in zip(left_cols, top, bot):
            col_ = np.nonzero(ball[:, x])[0]
            low = max(bt, col_.max()) if len(col_) else bt  # unten: nichts vom Gemalten abschneiden
            ball[:, x] = 0
            for y in range(int(np.ceil(t)), int(np.floor(low)) + 1):
                if y in lefts and x >= lefts[y]:
                    ball[y, x] = 1
        ball |= white  # das Weiß des Originals bleibt immer ganz
    # nur kleine Kerben/Stufen schließen (≤ 5 px), der Umriss bleibt gemalt
    ball = cv2.morphologyEx(ball, cv2.MORPH_CLOSE, ell(5))
    ball = fill_holes(biggest(ball)).astype(np.uint8)
    eye_any |= ball
    eye_data[k] = dict(white=white, pupil=pupil, ball=ball, win=e['win'])

# Augenweiß: das Weiß des Originals bleibt (Schattierung unter dem Oberlid, Stoffstruktur), nur aufgehellt; die Pupille und
# der Übergang werden zeilenweise mit dem Weiß derselben Zeile übermalt (Median, feines Korn aus dem Weiß daneben).
for k, d in eye_data.items():
    white, ball = d['white'], d['ball']
    x0, y0, x1, y1 = d['win']
    core = cv2.erode(white, ell(7))
    ref = np.percentile(rgb[core > 0], 90, axis=0)
    toned = np.clip(rgb * (WHITE / ref)[None, None, :], 0, 255)
    toned = np.clip(WHITE - (WHITE - toned) * 0.5, 0, 255)
    grain = toned - cv2.GaussianBlur(toned, (0, 0), 2.0)
    fill = ((ball > 0) & (core == 0)).astype(np.uint8)
    rows = [y for y in range(y0, y1) if np.count_nonzero(core[y, x0:x1]) >= 4]
    src = toned.copy()
    for y in range(y0, y1):
        fx = x0 + np.nonzero(fill[y, x0:x1])[0]
        if not len(fx):
            continue
        ry = min(rows, key=lambda r: abs(r - y))
        wx = x0 + np.nonzero(core[ry, x0:x1])[0]
        base = np.median(toned[ry, wx], axis=0)
        for x in fx:
            g = grain[ry, wx[(x * 7 + y * 3) % len(wx)]]
            src[y, x] = base + 0.6 * g
    # Übergang gegen das stehende Weiß glätten (keine Naht), Ränder 0,8 px weich gegen Juttas Tusche
    fw = cv2.GaussianBlur(fill.astype(np.float32), (0, 0), 1.5)
    src = toned * (1 - fw[..., None]) + src * fw[..., None]
    soft = cv2.GaussianBlur(ball.astype(np.float32), (0, 0), 0.8)
    ballw = np.clip(np.where(ball > 0, np.maximum(soft, 0.5), soft), 0, 1)
    clean = clean * (1 - ballw[..., None]) + np.clip(src, 0, 255) * ballw[..., None]

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
col = np.where(eye_any[..., None] > 0, clean, col)
# Abschluss unten (Büste): unter dem Bogen nichts, darauf Juttas Tuschestrich
a = a * bust
INK = np.array([22, 20, 24], np.float32)
col = col * (1 - stroke[..., None]) + INK * stroke[..., None]
a = np.maximum(a, stroke)

# ---------------------------------------------------------------- 6) Zuschnitt, Skalierung, Export
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


def outline(mask, eps):
    """Umriss einer Maske in Ausgabe-Koordinaten (Vieleck, gemalte Unregelmäßigkeit bleibt)."""
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    c = ((c + 0.5 - np.array([x0, y0], np.float32)) * s).astype(np.float32)
    c = cv2.approxPolyDP(c.reshape(-1, 1, 2), eps, True)[:, 0, :]
    return [[round(float(px), 1), round(float(py), 1)] for px, py in c]


def inside(poly, x, y):
    return cv2.pointPolygonTest(np.array(poly, np.float32).reshape(-1, 1, 2), (float(x), float(y)), False) >= 0


def pupil_shape(ax, ay, seed):
    """Pupille wie mit dem Pinsel getupft: Oval in Größe und Lage der gemalten Pupille (etwas größer, damit sie in Ruhe
    bis an Juttas Lidstrich reicht – der Augapfel-Umriss schneidet den Rest ab), Rand leicht unregelmäßig."""
    r_ = np.random.default_rng(seed)
    ph = r_.uniform(0, 2 * np.pi, 3)
    th = np.linspace(0, 2 * np.pi, 40, endpoint=False)
    f = 1 + 0.035 * np.sin(2 * th + ph[0]) + 0.025 * np.sin(3 * th + ph[1]) + 0.015 * np.sin(5 * th + ph[2])
    return [[round(float(ax * f[i] * np.cos(t)), 1), round(float(ay * f[i] * np.sin(t)), 1)] for i, t in enumerate(th)]


meta = {'w': OUT_W, 'h': out_h, 'eyes': {}}
for k, d in eye_data.items():
    # Beschnitt der Pupille: der gemalte Augapfel, um ≈ 1 px in den Lidstrich erweitert (keine helle Naht an der Kante) und
    # ohne winzige Ausbuchtungen (Glanzpunkt am rechten Lid), damit die wandernde Pupille dort keinen Höcker bekommt
    clip = cv2.dilate(cv2.morphologyEx(d['ball'], cv2.MORPH_OPEN, ell(15)), ell(3))
    ball = outline(clip, 0.45)
    pup = outline(d['pupil'], 0.45)
    pa = np.array(pup)
    cx, cy = (pa[:, 0].min() + pa[:, 0].max()) / 2, (pa[:, 1].min() + pa[:, 1].max()) / 2
    rx, ry = (pa[:, 0].max() - pa[:, 0].min()) / 2, (pa[:, 1].max() - pa[:, 1].min()) / 2
    # Weg nach rechts: bis die Pupillenmitte ≈ rx vor dem rechten Augenrand (auf Höhe der Mitte) steht
    def right_edge(yv):
        r = cx
        while inside(ball, r + 1, yv):
            r += 1
        return r

    right = min(right_edge(cy + f * ry) for f in (-0.3, 0, 0.3))
    travel = round(right - rx * 0.6 - cx, 1)  # rechts darf der Lidwinkel die Pupille etwas anschneiden
    meta['eyes'][k] = dict(
        cx=round(cx, 1), cy=round(cy, 1), rx=round(rx, 1), ry=round(ry, 1), travel=travel,
        ball=ball,
        # Pupille (relativ zur Mitte, für ein <polygon> mit transform)
        pupil=pupil_shape(rx + 2.0, ry + 1.0, 7 if k == 'l' else 11),
    )
META.parent.mkdir(parents=True, exist_ok=True)
META.write_text(json.dumps(meta, separators=(',', ':')) + '\n')
print(OUT, OUT.stat().st_size, 'bytes', OUT_W, 'x', out_h)
for k, e in meta['eyes'].items():
    print(k, 'pupil', e['cx'], e['cy'], e['rx'], e['ry'], 'travel', e['travel'], 'ball pts', len(e['ball']),
          'pupil pts', len(e['pupil']))
