"""Crée la silhouette seule, transparente (WebM VP9 avec canal alpha), pour la superposer à un décor.

Si tes épaules sont coupées par les bords de la vidéo, on les prolonge : la ligne d'épaule continue vers
l'extérieur avec la même pente, la même couleur de peau / de haut, et un léger arrondi.

Usage : python personne_alpha.py <video> <masque.mkv> <personne.webm> <mesures.json> [--epaules 150]
"""
import argparse, json, subprocess, sys
import cv2
import numpy as np


def lisse(a, bas=0.10, haut=0.90):
    x = np.clip((a - bas) / (haut - bas), 0, 1)
    return x * x * (3 - 2 * x)


p = argparse.ArgumentParser()
p.add_argument("video"); p.add_argument("masque"); p.add_argument("sortie"); p.add_argument("mesures")
p.add_argument("--epaules", type=int, default=150, help="largeur ajoutée de chaque côté, en pixels (0 = rien)")
a = p.parse_args()

P = max(0, a.epaules)


def alpha_image(img, m):
    al = lisse(m[:, :, 0].astype(np.float32) / 255)
    return cv2.GaussianBlur(cv2.erode(al, np.ones((3, 3), np.uint8)), (0, 0), 0.8)


def mesure_cote(al, cote):
    """Où l'épaule touche le bord de la vidéo ? Renvoie (ligne de contact, pente) ou None.
    pente = de combien l'épaule descend par pixel quand on s'éloigne du centre."""
    h, w = al.shape
    col = al[:, :6].mean(axis=1) if cote == "g" else al[:, -6:].mean(axis=1)
    bas = col[int(h * 0.97):]
    if bas.mean() < 0.5:  # le corps ne touche pas ce bord
        return None
    ys = np.where(col > 0.5)[0]
    r0 = int(ys[0])
    # on suit la ligne du haut de l'épaule sur ~60 px vers l'intérieur
    pts = []
    for x in range(0, 61, 6):
        xx = x if cote == "g" else w - 1 - x
        lig = np.where(al[max(0, r0 - 120):, xx] > 0.5)[0]
        if len(lig):
            pts.append((x, max(0, r0 - 120) + int(lig[0])))
    if len(pts) < 4:
        return r0, 0.55
    xs, yv = np.array(pts, np.float32).T
    pente = float(np.polyfit(xs, yv, 1)[0])  # y augmente vers l'intérieur si l'épaule monte vers l'extérieur
    return r0, float(np.clip(-pente, 0.25, 1.2))


# --- passe 1 : où sont les épaules, image par image (puis lissé dans le temps) ---
cap, capm = cv2.VideoCapture(a.video), cv2.VideoCapture(a.masque)
w, h = int(cap.get(3)), int(cap.get(4)); fps = cap.get(5) or 30
params = {"g": [], "d": []}
if P:
    while True:
        ok, img = cap.read(); okm, m = capm.read()
        if not ok or not okm:
            break
        al = alpha_image(img, m)
        params["g"].append(mesure_cote(al, "g")); params["d"].append(mesure_cote(al, "d"))
    cap.release(); capm.release()
    cap, capm = cv2.VideoCapture(a.video), cv2.VideoCapture(a.masque)


def lisse_temps(liste, fen=9):
    """Moyenne glissante : l'épaule ne tremble pas d'une image à l'autre."""
    out = []
    for i in range(len(liste)):
        vois = [v for v in liste[max(0, i - fen // 2): i + fen // 2 + 1] if v is not None]
        out.append(None if len(vois) < (fen // 2) + 1 else (float(np.mean([v[0] for v in vois])), float(np.mean([v[1] for v in vois]))))
    return out


if P:
    params = {k: lisse_temps(v) for k, v in params.items()}


def prolonge(img, al, cote, prm):
    """Ajoute P colonnes (image + alpha) du côté `cote`, qui prolongent l'épaule."""
    r0, pente = prm
    h = img.shape[0]
    d = np.arange(1, P + 1, dtype=np.float32)[None, :]            # distance au bord, vers l'extérieur
    y = np.arange(h, dtype=np.float32)[:, None]
    haut = r0 + pente * d + 0.0035 * d * d                       # ligne d'épaule : descend et s'arrondit
    ext = np.clip((y - haut) / 5.0 + 0.5, 0, 1)                  # 1 sous la ligne d'épaule, bord adouci
    ext *= np.clip((P - d + 1) / 14.0, 0, 1)                     # extrémité qui s'efface
    bord = img[:, 2:5].mean(axis=1) if cote == "g" else img[:, -5:-2].mean(axis=1)
    bord = cv2.GaussianBlur(bord.reshape(h, 1, 3), (0, 0), 14).reshape(h, 3)  # couleur lissée (sans détails)
    teinte = (1.0 - 0.22 * d / P)[:, :, None]                    # un peu plus sombre en s'éloignant : volume
    col = np.repeat(bord[:, None, :], P, axis=1) * teinte
    return col.astype(np.uint8), ext


ff = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{w + 2 * P}x{h}", "-r", str(fps), "-i", "-",
     "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "22", "-auto-alt-ref", "0",
     "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", a.sortie], stdin=subprocess.PIPE)
hauts, n = [], 0
while True:
    ok, img = cap.read(); okm, m = capm.read()
    if not ok or not okm:
        break
    al = alpha_image(img, m)
    lignes = np.where((al > 0.5).sum(axis=1) > 6)[0]
    if len(lignes):
        hauts.append(int(lignes[0]))
    if P:
        pg, pd = params["g"][n], params["d"][n]
        cg, eg = prolonge(img, al, "g", pg) if pg else (np.zeros((h, P, 3), np.uint8), np.zeros((h, P), np.float32))
        cd, ed = prolonge(img, al, "d", pd) if pd else (np.zeros((h, P, 3), np.uint8), np.zeros((h, P), np.float32))
        eg = eg[:, ::-1]                      # à gauche, la distance au bord croît vers la gauche
        cg = cg[:, ::-1]
        image = np.hstack([cg, img, cd])
        alpha = np.hstack([eg, al, ed])
    else:
        image, alpha = img, al
    bgra = np.dstack([image, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    ff.stdin.write(bgra.tobytes())
    n += 1
    if n % 30 == 0:
        print(f"  {n} images…", file=sys.stderr, flush=True)
ff.stdin.close(); ff.wait()
haut_tete = float(np.percentile(hauts, 10)) / h if hauts else 0.3
json.dump({"hautTete": round(haut_tete, 4), "largeur": w + 2 * P, "hauteur": h, "epaules": P}, open(a.mesures, "w"))
print(f"{n} images -> {a.sortie} (haut de la tête à {haut_tete*100:.0f} % de la hauteur, épaules prolongées de {P} px de chaque côté)")
