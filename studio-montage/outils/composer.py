"""Place la silhouette découpée dans la moitié basse d'un écran 1080x1920 et remplace le fond.

Usage : python composer.py <video> <masque.mkv> <base.mp4> --fond blanc|flou|<image>
"""
import argparse, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

LARGE, HAUT = 1080, 1920
HAUTEUR_PERSONNE = 960  # la silhouette occupe la moitié basse


def lisse(a, bas=0.10, haut=0.90):
    """Nettoie le contour : enlève le halo (alpha très faible) et solidifie l'intérieur."""
    x = np.clip((a - bas) / (haut - bas), 0, 1)
    return x * x * (3 - 2 * x)


def couvrir(img, w, h):
    """Redimensionne en remplissant tout le cadre (comme « cover » en CSS)."""
    ih, iw = img.shape[:2]
    s = max(w / iw, h / ih)
    r = cv2.resize(img, (int(np.ceil(iw * s)), int(np.ceil(ih * s))), interpolation=cv2.INTER_AREA)
    y, x = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y:y + h, x:x + w]


def flou_rapide(img, sigma):
    """Flou fort calculé en petit format (rapide), puis agrandi."""
    pt = cv2.resize(img, (LARGE // 4, HAUT // 4), interpolation=cv2.INTER_AREA)
    pt = cv2.GaussianBlur(pt, (0, 0), sigma / 4)
    return cv2.resize(pt, (LARGE, HAUT), interpolation=cv2.INTER_LINEAR)


def haut_de_tete(masque_path):
    """Ligne du haut de la tête (cheveux compris), mesurée sur toute la vidéo."""
    cap = cv2.VideoCapture(masque_path)
    hauts = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        m = f[:, :, 0] > 128
        lignes = np.where(m.sum(axis=1) > 6)[0]
        if len(lignes):
            hauts.append(lignes[0])
    cap.release()
    return int(np.percentile(hauts, 10)) if hauts else 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video"); p.add_argument("masque"); p.add_argument("sortie")
    p.add_argument("--fond", default="blanc")
    a = p.parse_args()

    cap = cv2.VideoCapture(a.video)
    capm = cv2.VideoCapture(a.masque)
    w, h = int(cap.get(3)), int(cap.get(4)); fps = cap.get(5) or 30

    haut = haut_de_tete(a.masque)
    marge = int(0.03 * h)  # on garde un peu d'air au-dessus des boucles
    zone = h - max(0, haut - marge)
    s = HAUTEUR_PERSONNE / zone
    pw, ph = int(round(w * s)), int(round(h * s))
    x0, y0 = (LARGE - pw) // 2, HAUT - ph
    print(f"silhouette : échelle x{s:.2f}, taille {pw}x{ph}, position ({x0},{y0})", file=sys.stderr)

    fond_statique = None
    if a.fond == "blanc":
        fond_statique = np.full((HAUT, LARGE, 3), 255, np.uint8)
    elif a.fond not in ("flou",):
        img = cv2.imread(a.fond)
        if img is None:
            sys.exit(f"Image de fond introuvable : {a.fond}")
        fond_statique = flou_rapide(couvrir(img, LARGE, HAUT), 24)
        fond_statique = (fond_statique * 0.78).astype(np.uint8)  # léger voile sombre : texte lisible

    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{LARGE}x{HAUT}",
         "-r", str(fps), "-i", "-", "-i", a.video, "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", a.sortie],
        stdin=subprocess.PIPE)

    # morceau visible de la silhouette dans le cadre (si elle déborde sur les côtés)
    sx0, dx0 = max(0, -x0), max(0, x0)
    largeur = min(pw - sx0, LARGE - dx0)
    n = 0
    while True:
        ok, img = cap.read(); okm, m = capm.read()
        if not ok or not okm:
            break
        if fond_statique is not None:
            toile = fond_statique.copy()
        else:  # fond flou : la vidéo d'origine, très floutée et assombrie
            toile = (flou_rapide(couvrir(img, LARGE, HAUT), 40) * 0.8).astype(np.uint8)
        pers = cv2.resize(img, (pw, ph), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
        al = lisse(cv2.resize(m[:, :, 0], (pw, ph), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255)
        al = al[:, sx0:sx0 + largeur, None]
        pers = pers[:, sx0:sx0 + largeur].astype(np.float32)
        reg = toile[y0:HAUT, dx0:dx0 + largeur].astype(np.float32)
        toile[y0:HAUT, dx0:dx0 + largeur] = (pers * al + reg * (1 - al)).astype(np.uint8)
        ff.stdin.write(toile.tobytes())
        n += 1
        if n % 30 == 0:
            print(f"  {n} images composées…", file=sys.stderr, flush=True)
    ff.stdin.close(); ff.wait()
    print(f"{n} images écrites -> {a.sortie}")


if __name__ == "__main__":
    main()
