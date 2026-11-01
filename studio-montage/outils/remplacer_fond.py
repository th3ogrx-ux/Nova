"""Remplace le fond derrière vous, à la taille d'origine, en gardant le son.

Usage : python remplacer_fond.py <video> <masque.mkv> <sortie.mp4> --fond genere|flou|<image>
"""
import argparse, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

RACINE = Path(__file__).resolve().parent.parent


def lisse(a, bas=0.10, haut=0.90):
    """Enlève le halo (alpha très faible) et solidifie l'intérieur."""
    x = np.clip((a - bas) / (haut - bas), 0, 1)
    return x * x * (3 - 2 * x)


def couvrir(img, w, h):
    ih, iw = img.shape[:2]
    s = max(w / iw, h / ih)
    r = cv2.resize(img, (int(np.ceil(iw * s)), int(np.ceil(ih * s))), interpolation=cv2.INTER_AREA)
    y, x = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y:y + h, x:x + w]


def flou_fort(img, sigma):
    h, w = img.shape[:2]
    pt = cv2.resize(img, (max(8, w // 4), max(8, h // 4)), interpolation=cv2.INTER_AREA)
    pt = cv2.GaussianBlur(pt, (0, 0), sigma / 4)
    return cv2.resize(pt, (w, h), interpolation=cv2.INTER_LINEAR)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video"); p.add_argument("masque"); p.add_argument("sortie")
    p.add_argument("--fond", default="genere")
    a = p.parse_args()

    cap, capm = cv2.VideoCapture(a.video), cv2.VideoCapture(a.masque)
    w, h = int(cap.get(3)), int(cap.get(4)); fps = cap.get(5) or 30

    fixe = None
    if a.fond == "genere":
        chemin = RACINE / "fonds" / "fond-genere.jpg"
        if not chemin.exists():
            subprocess.run([sys.executable, str(RACINE / "outils" / "fond_genere.py"), str(chemin)], check=True)
        fixe = couvrir(cv2.imread(str(chemin)), w, h)
    elif a.fond != "flou":
        img = cv2.imread(a.fond)
        if img is None:
            sys.exit(f"Image de fond introuvable : {a.fond}")
        fixe = (flou_fort(couvrir(img, w, h), 24) * 0.85).astype(np.uint8)

    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps),
         "-i", "-", "-i", a.video, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", a.sortie],
        stdin=subprocess.PIPE)
    n = 0
    noyau = np.ones((3, 3), np.uint8)
    while True:
        ok, img = cap.read(); okm, m = capm.read()
        if not ok or not okm:
            break
        fond = fixe if fixe is not None else (flou_fort(img, 40) * 0.85).astype(np.uint8)
        al = lisse(m[:, :, 0].astype(np.float32) / 255)
        al = cv2.GaussianBlur(cv2.erode(al, noyau), (0, 0), 0.8)[:, :, None]  # rogne le liseré de l'ancien décor
        out = img.astype(np.float32) * al + fond.astype(np.float32) * (1 - al)
        ff.stdin.write(out.astype(np.uint8).tobytes())
        n += 1
        if n % 30 == 0:
            print(f"  {n} images…", file=sys.stderr, flush=True)
    ff.stdin.close(); ff.wait()
    print(f"{n} images écrites -> {a.sortie}")


if __name__ == "__main__":
    main()
