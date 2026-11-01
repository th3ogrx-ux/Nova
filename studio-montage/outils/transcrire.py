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
json.dump(mots, open(a.sortie, "w"), ensure_ascii=False, indent=1)
print(f"{len(mots)} mots en {time.time()-t0:.1f}s (langue : {info.language})")
