"""Crée la silhouette seule, transparente (WebM VP9 avec canal alpha), pour la superposer à un décor.

Usage : python personne_alpha.py <video> <masque.mkv> <personne.webm> <mesures.json>
"""
import argparse, json, subprocess, sys
import cv2
import numpy as np


def lisse(a, bas=0.10, haut=0.90):
    x = np.clip((a - bas) / (haut - bas), 0, 1)
    return x * x * (3 - 2 * x)


p = argparse.ArgumentParser()
p.add_argument("video"); p.add_argument("masque"); p.add_argument("sortie"); p.add_argument("mesures")
a = p.parse_args()

cap, capm = cv2.VideoCapture(a.video), cv2.VideoCapture(a.masque)
w, h = int(cap.get(3)), int(cap.get(4)); fps = cap.get(5) or 30
ff = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
     "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "22", "-auto-alt-ref", "0",
     "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", a.sortie], stdin=subprocess.PIPE)
noyau = np.ones((3, 3), np.uint8)
hauts, n = [], 0
while True:
    ok, img = cap.read(); okm, m = capm.read()
    if not ok or not okm:
        break
    al = lisse(m[:, :, 0].astype(np.float32) / 255)
    al = cv2.GaussianBlur(cv2.erode(al, noyau), (0, 0), 0.8)  # rogne le liseré de l'ancien décor
    lignes = np.where((al > 0.5).sum(axis=1) > 6)[0]
    if len(lignes):
        hauts.append(int(lignes[0]))
    bgra = np.dstack([img, (al * 255).astype(np.uint8)])
    ff.stdin.write(bgra.tobytes())
    n += 1
    if n % 30 == 0:
        print(f"  {n} images…", file=sys.stderr, flush=True)
ff.stdin.close(); ff.wait()
haut_tete = float(np.percentile(hauts, 10)) / h if hauts else 0.3
json.dump({"hautTete": round(haut_tete, 4), "largeur": w, "hauteur": h}, open(a.mesures, "w"))
print(f"{n} images -> {a.sortie} (haut de la tête à {haut_tete*100:.0f} % de la hauteur)")
