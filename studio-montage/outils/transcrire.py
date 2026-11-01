"""Transcrit la voix avec les temps de chaque mot (faster-whisper, modèle « small », sur processeur).

Usage : python transcrire.py <video> <mots.json> [--langue fr]
"""
import argparse, json, subprocess, time
import numpy as np
from pathlib import Path
from faster_whisper import WhisperModel

MODELE = Path(__file__).resolve().parent.parent / "modeles" / "whisper-small"

p = argparse.ArgumentParser()
p.add_argument("video"); p.add_argument("sortie")
p.add_argument("--langue", default="fr")
p.add_argument("--script", default="", help="texte exact de la vidéo : corrige les mots mal reconnus en gardant les temps")
p.add_argument("--vocabulaire", default="", help="mots à bien reconnaître, séparés par des virgules")
a = p.parse_args()

t0 = time.time()
# On décode l'audio nous-mêmes avec ffmpeg (16 kHz, mono) : plus fiable que la lecture intégrée.
brut = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vn", "-ac", "1", "-ar", "16000",
                       "-f", "f32le", "-"], capture_output=True, check=True).stdout
audio = np.frombuffer(brut, dtype=np.float32)
modele = WhisperModel(str(MODELE), device="cpu", compute_type="int8")
segments, info = modele.transcribe(audio, language=a.langue, word_timestamps=True,
                                   vad_filter=True, beam_size=5,
                                   initial_prompt=(a.vocabulaire or None))
mots = []
for seg in segments:
    for w in seg.words:
        txt = w.word.strip()
        if not txt:
            continue
        if mots and txt[0] in "'’" :  # « qu » + « 'à » -> « qu'à » (pas d'espace)
            mots[-1]["text"] += txt
            mots[-1]["endMs"] = round(w.end * 1000)
            mots[-1]["timestampMs"] = (mots[-1]["startMs"] + mots[-1]["endMs"]) // 2
            continue
        mots.append({
            "text": ("" if not mots else " ") + txt,
            "startMs": round(w.start * 1000), "endMs": round(w.end * 1000),
            "timestampMs": round((w.start + w.end) * 500),
            "confidence": round(w.probability, 3),
        })


def jeton(t):
    import re, unicodedata
    t = unicodedata.normalize("NFD", t.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in t if unicodedata.category(c) != "Mn"))


def corriger(mots, texte):
    """Aligne les mots entendus sur le texte exact : on garde les temps de Whisper, mais les mots du texte.
    Les mots mal reconnus sont remplacés ; ceux qui manquent se partagent le temps de leurs voisins."""
    import difflib
    cible = texte.split()
    sm = difflib.SequenceMatcher(a=[jeton(m["text"]) for m in mots], b=[jeton(c) for c in cible], autojunk=False)
    sortie = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                m = dict(mots[i1 + k]); m["text"] = cible[j1 + k]; sortie.append(m)
        elif op in ("replace", "insert"):
            if i2 > i1:
                debut, fin = mots[i1]["startMs"], mots[i2 - 1]["endMs"]
            else:  # mots du texte sans équivalent entendu : on prend un court instant avant le mot suivant
                suivant = mots[i1]["startMs"] if i1 < len(mots) else (mots[-1]["endMs"] if mots else 0)
                debut, fin = max(0, suivant - 120 * (j2 - j1)), suivant
            poids = [max(1, len(jeton(c))) for c in cible[j1:j2]]
            t = debut
            for c, w in zip(cible[j1:j2], poids):
                d = (fin - debut) * w / sum(poids)
                sortie.append({"text": c, "startMs": round(t), "endMs": round(t + d), "timestampMs": round(t + d / 2), "confidence": None})
                t += d
        # "delete" : mots entendus mais absents du texte : on les ignore
    for i, m in enumerate(sortie):
        m["text"] = ("" if i == 0 else " ") + m["text"].strip()
    return sortie


if a.script:
    mots = corriger(mots, Path(a.script).read_text(encoding="utf-8"))
json.dump(mots, open(a.sortie, "w"), ensure_ascii=False, indent=1)
print(f"{len(mots)} mots en {time.time()-t0:.1f}s (langue : {info.language})")
