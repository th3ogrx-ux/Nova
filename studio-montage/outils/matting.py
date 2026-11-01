"""Découpe de la silhouette : produit une vidéo « masque » en niveaux de gris (blanc = vous).

Usage : python matting.py <video> <masque.mkv> [--moteur rvm|mediapipe] [--max N]
"""
import argparse, subprocess, sys, time
from pathlib import Path
import cv2
import numpy as np

RACINE = Path(__file__).resolve().parent.parent
MODELES = RACINE / "modeles"


class MoteurRVM:
    """Robust Video Matting (ONNX, processeur). Garde la mémoire d'une image à l'autre :
    le contour reste stable et les cheveux ne scintillent pas."""

    def __init__(self, ratio):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 0
        self.s = ort.InferenceSession(str(MODELES / "rvm_mobilenetv3_fp32.onnx"), opts,
                                      providers=["CPUExecutionProvider"])
        self.etat = [np.zeros((1, 1, 1, 1), np.float32) for _ in range(4)]
        self.ratio = np.array([ratio], np.float32)

    def __call__(self, bgr):
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        src = rgb.transpose(2, 0, 1)[None]
        fgr, pha, *self.etat = self.s.run(None, {
            "src": src, "r1i": self.etat[0], "r2i": self.etat[1],
            "r3i": self.etat[2], "r4i": self.etat[3], "downsample_ratio": self.ratio})
        return pha[0, 0]


class MoteurMediaPipe:
    """Segmentation MediaPipe (image par image, sans mémoire)."""

    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks import python as mpp
        from mediapipe.tasks.python import vision
        self.mp = mp
        opts = vision.ImageSegmenterOptions(
            base_options=mpp.BaseOptions(model_asset_path=str(MODELES / "selfie_multiclass_256x256.tflite")),
            output_confidence_masks=True, output_category_mask=False)
        self.seg = vision.ImageSegmenter.create_from_options(opts)

    def __call__(self, bgr):
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        img = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb)
        res = self.seg.segment(img)
        fond = res.confidence_masks[0].numpy_view()
        return (1.0 - fond).astype(np.float32)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video"); p.add_argument("sortie")
    p.add_argument("--moteur", default="rvm", choices=["rvm", "mediapipe"])
    p.add_argument("--ratio", type=float, default=0.5, help="qualité RVM (0.25 rapide … 0.6 fin)")
    p.add_argument("--max", type=int, default=0, help="nombre d'images max (test)")
    a = p.parse_args()

    cap = cv2.VideoCapture(a.video)
    w, h = int(cap.get(3)), int(cap.get(4)); fps = cap.get(5) or 30
    moteur = MoteurRVM(a.ratio) if a.moteur == "rvm" else MoteurMediaPipe()
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray",
                           "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "ffv1", a.sortie],
                          stdin=subprocess.PIPE)
    n, t0 = 0, time.time()
    while True:
        ok, img = cap.read()
        if not ok or (a.max and n >= a.max):
            break
        m = moteur(img)
        if m.shape != (h, w):
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
        ff.stdin.write((np.clip(m, 0, 1) * 255).astype(np.uint8).tobytes())
        n += 1
        if n % 15 == 0:
            print(f"  {n} images…", file=sys.stderr, flush=True)
    ff.stdin.close(); ff.wait()
    dt = time.time() - t0
    print(f"{a.moteur}: {n} images en {dt:.1f}s ({dt/max(n,1)*1000:.0f} ms/image, "
          f"{dt/max(n,1)*fps:.1f}s de calcul par seconde de vidéo)")


if __name__ == "__main__":
    main()
