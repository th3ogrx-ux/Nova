"""Crée un décor flou (dégradé doux + lumières floues « bokeh ») : fonds/fond-genere.jpg

Usage : python fond_genere.py [sortie.jpg] [--graine 7]
Change --graine pour obtenir un autre décor.
"""
import argparse
from pathlib import Path
import cv2
import numpy as np

p = argparse.ArgumentParser()
p.add_argument("sortie", nargs="?", default=str(Path(__file__).resolve().parent.parent / "fonds" / "fond-genere.jpg"))
p.add_argument("--graine", type=int, default=7)
a = p.parse_args()

W, H = 1080, 1920
rng = np.random.default_rng(a.graine)

# dégradé vertical doux (gris-bleu clair en haut, plus profond en bas) — BGR
haut, bas = np.array([226, 214, 200], np.float32), np.array([168, 150, 134], np.float32)
t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
img = haut * (1 - t) + bas * t
img = np.repeat(img, W, axis=1)

# lumières floues : des disques clairs / légèrement rosés, puis un fort flou
lumieres = np.zeros((H, W, 3), np.float32)
couleurs = [(255, 255, 255), (235, 240, 255), (205, 215, 255), (250, 235, 225)]  # blanc, rosé, chaud
for _ in range(34):
    x, y = int(rng.uniform(0, W)), int(rng.uniform(0, H))
    r = int(rng.uniform(40, 170))
    c = couleurs[int(rng.integers(len(couleurs)))]
    k = float(rng.uniform(0.10, 0.28))
    cercle = np.zeros((H, W), np.float32)
    cv2.circle(cercle, (x, y), r, 1.0, -1, cv2.LINE_AA)
    cercle = cv2.GaussianBlur(cercle, (0, 0), r * 0.25)
    lumieres += cercle[:, :, None] * np.array(c, np.float32) * k
img = np.clip(img + lumieres, 0, 255)
img = cv2.GaussianBlur(img, (0, 0), 22)

# très léger grain pour éviter les bandes de couleur
img += rng.normal(0, 1.6, img.shape).astype(np.float32)
Path(a.sortie).parent.mkdir(parents=True, exist_ok=True)
cv2.imwrite(a.sortie, np.clip(img, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
print("décor créé :", a.sortie)
