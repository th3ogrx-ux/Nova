#!/usr/bin/env python3
"""Bande-son de la vidéo commerçants "commerces-01" : voix (Piper, fr_FR siwis, CC BY 4.0), musique, batterie et bruitages synthétisés.
Usage : python3 composer-son.py <dossier_tts> <dossier_travail> <video.mp4> <sortie.mp4>"""
import sys, os, subprocess, wave, json
import numpy as np

MODE, TTS, TMP = sys.argv[1:4]; VIDEO = sys.argv[4] if len(sys.argv) > 4 else None; SORTIE = sys.argv[5] if len(sys.argv) > 5 else None
os.makedirs(TMP, exist_ok=True)
SR = 44100; DUR = 22.0; N = int(SR * DUR)
rng = np.random.default_rng(11)

def t_(d): return np.arange(int(d * SR)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] *= np.linspace(0, 1, na) ** 1.5; e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def lowpass(x, fc):
    a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y
def lisse(x, f):
    k = int(f * SR); return np.convolve(x, np.ones(k)/k, mode='same')
def put(bus, sig, t0, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: bus[i:j] += sig[:j - i] * g
def noise(d): return rng.standard_normal(int(d*SR))
def bell(f, d=1.2):
    t = t_(d); return (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*7) + .2*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*12)) * np.exp(-t*3.6) * (1 - np.exp(-t*400))
def thump(f0=90, d=.35):
    t = t_(d); return np.sin(2*np.pi*(f0*np.exp(-t*9)*t)) * np.exp(-t*12)
def click():
    t = t_(.03); return noise(.03) * np.exp(-t*220)

musL = np.zeros(N); musR = np.zeros(N); sfx = np.zeros(N); voc = np.zeros(N); drm = np.zeros(N)

def pad(notes, t0, t1, g=.10, br=1.0, rel=1.0):
    d = (t1 - t0) + rel; n = int(d * SR); t = t_(d)
    for ch, bus in ((0, musL), (1, musR)):
        sig = np.zeros(n)
        for k, m in enumerate(notes):
            f = midi(m) * (1 + (0.0014 if (k + ch) % 2 else -0.0014))
            sig += np.sin(2*np.pi*f*t) + .30*br*np.sin(2*np.pi*2*f*t) + .12*br*np.sin(2*np.pi*3*f*t)
        sig *= (1 + .12*np.sin(2*np.pi*.23*t + ch)) / len(notes)
        put(bus, sig * env_ar(n, min(1.4, (t1-t0)*.45), rel), t0, g)
def kick(t0, g=.55):
    t = t_(.38); ph = 2*np.pi*np.cumsum(48 + 120*np.exp(-t*26))/SR
    put(drm, np.sin(ph) * np.exp(-t*8.5) * (1 - np.exp(-t*900)), t0, g)
def snare(t0, g=.40):
    t = t_(.26); n = np.diff(noise(.26), prepend=0)
    put(drm, n*.55*np.exp(-t*20) + np.sin(2*np.pi*190*t)*.5*np.exp(-t*28), t0, g)
def hat(t0, g=.09, d=.06):
    t = t_(d); n = np.diff(noise(d), 2, prepend=[0, 0]); put(drm, n * np.exp(-t*(70 if d < .1 else 25)), t0, g)
def crash(t0, g=.16):
    t = t_(1.6); n = np.diff(noise(1.6), 2, prepend=[0, 0]); put(drm, n * np.exp(-t*3.2), t0, g)
def pluck(f, t0, g=.07):
    t = t_(.28); put(sfx, (np.sin(2*np.pi*f*t) + .4*np.sin(2*np.pi*2*f*t) + .2*np.sin(2*np.pi*3*f*t)) * np.exp(-t*14) * (1 - np.exp(-t*600)), t0, g)
def whoosh(t_fin, d=.32, g=.16):
    t = t_(d); n = np.diff(noise(d), prepend=0); put(sfx, n * (t/d)**2 * env_ar(len(t), .01, .02), t_fin - d, g)
def riser(t0, t1, g=.18):
    d = t1 - t0; t = t_(d); n = np.diff(noise(d), prepend=0)
    sw = np.sin(2*np.pi*np.cumsum(180 + 1400*(t/d)**2)/SR) * .3
    put(sfx, (n*.7 + sw) * (t/d)**2.2, t0, g)
def beep(t0, f=1000, d=.09, g=.16):
    t = t_(d); s = np.sin(2*np.pi*f*t) + .35*np.sign(np.sin(2*np.pi*f*t)); put(sfx, s * env_ar(len(t), .004, .03), t0, g)
def buzz(t0, d, g=.12, f=100):
    t = t_(d); s = np.sign(np.sin(2*np.pi*f*t)) * .5 + noise(d) * .15
    s *= (np.sin(2*np.pi*23*t) > -.2) * env_ar(len(t), .02, .05); put(sfx, lowpass(s, 2500), t0, g)
def vibre(t0, t1, g=.30):
    for k in range(int((t1 - t0) / .12)):
        t = t_(.09); s = (np.sin(2*np.pi*72*t) + .5*np.sin(2*np.pi*144*t)) * env_ar(len(t), .008, .04); put(sfx, s, t0 + k*.12, g)
def souffle(t0, g=.22, d=.38):
    t = t_(d); n = lowpass(noise(d), 1800) - lowpass(noise(d), 300); put(sfx, n * np.sin(np.pi*np.clip(t/d, 0, 1))**1.5, t0, g)
def grondement(t0, t1, g=.5, fc=300):
    d = t1 - t0; t = t_(d); put(sfx, lowpass(noise(d), fc) * np.sin(np.pi*np.clip(t/d, 0, 1))**.8, t0, g)
def coeur(t0, g=.5):
    kick(t0, g); kick(t0 + .16, g*.7)


# ---------------------------------------------------------------- VOIX (siwis, comme dans les épisodes précédents)
def voix(nom, texte, ls=0.9):
    brut = f"{TMP}/{nom}-brut.wav"
    subprocess.run([f"{TTS}/venv/bin/python", "-m", "piper", "-m", f"{TTS}/fr_FR-siwis-medium.onnx", "-f", brut, "--length-scale", str(ls), "--sentence-silence", "0.05", "--", texte], check=True, capture_output=True)
    net = f"{TMP}/{nom}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse,aresample=44100,highpass=f=90", "-ac", "1", net], check=True)
    with wave.open(net) as w: return net, w.getnframes() / w.getframerate()
LIGNES = [("v1", "Commerçant ? Voici pourquoi on ne te trouve pas."), ("v2", "Aujourd'hui, tes clients cherchent sur leur téléphone."),
          ("c1", "Crée ta page."), ("c2", "Mets tes horaires à jour."), ("c3", "Ajoute tes photos."), ("c4", "Publie tes bons plans."), ("c5", "Et pose ton QR code en caisse."),
          ("v4", "Et tes clients te trouvent.")]
fich = {}; dur = {}
for nom, tx in LIGNES: fich[nom], dur[nom] = voix(nom, tx)
# horaires : les 5 phrases de la liste se suivent entre 6,4 s et 15,8 s ; chaque coche tombe au début de sa phrase
somme = sum(dur[f"c{i}"] for i in range(1, 6)); pause = max(0.2, ((15.8 - 6.4) - somme) / 4)
starts, t = [], 6.4
for i in range(1, 6): starts.append(round(t, 2)); t += dur[f"c{i}"] + pause
H = dict(v1=0.25, v2=3.2, coches=starts, v4=16.3, durees={k: round(v, 2) for k, v in dur.items()})
json.dump(H, open(f"{TMP}/horaires.json", "w")); print(json.dumps(H))
if MODE == 'horaires': sys.exit(0)
TC = H['coches']
if '--coches' in sys.argv: TC = [float(v) for v in sys.argv[sys.argv.index('--coches') + 1].split(',')]   # mêmes instants que le rendu 3D

# ---------------------------------------------------------------- MUSIQUE
pad([45, 52, 57, 60], 0.0, 3.0, .10, .6)                                   # plan 1 : la boutique grise, un peu de mystère
pad([48, 55, 60, 64], 3.0, 6.0, .11, .9)                                   # plan 2 : la carte
pad([48, 55, 60, 64, 67], 6.0, 10.0, .12, 1.0); pad([41, 48, 53, 57], 10.0, 14.0, .12, 1.0); pad([43, 50, 55, 59], 14.0, 16.0, .12, 1.0)   # plan 3 : la liste
pad([48, 55, 60, 64, 67], 16.0, 19.0, .13, 1.1)                            # plan 4 : les clients arrivent
pad([48, 55, 60, 64, 67], 19.0, 22.0, .14, 1.2, rel=.4)                    # plan 5 : fin
# ---------------------------------------------------------------- RYTHME (120 bpm, toutes les coupes tombent sur un multiple de 0,5 s)
for t0 in np.arange(0.0, 3.0, 1.0): kick(t0, .35)
riser(3.0, 6.0, .22)
for t0 in np.arange(4.5, 6.0, .5): kick(t0, .45)
crash(6.0, .18)
for t0 in np.arange(6.0, 19.0, .5): kick(t0, .55)
for t0 in np.arange(6.5, 19.0, 1.0): snare(t0, .34)
for t0 in np.arange(6.0, 19.0, .25): hat(t0, .06 + (0.03 if round((t0 - 6.0) / .25) % 2 else 0))
arp = [72, 76, 79, 84, 79, 76, 74, 79]
for i, t0 in enumerate(np.arange(6.0, 19.0, .25)): pluck(midi(arp[i % 8] - 12), t0, .05)
crash(16.0, .18); crash(19.0, .22); kick(19.0, .7)
# ---------------------------------------------------------------- BRUITAGES
whoosh(3.0, .35, .2); whoosh(6.0, .3, .22); whoosh(16.0, .3, .2); whoosh(19.0, .3, .2)
for i, tc in enumerate(TC):                                                # un petit son à chaque coche
    put(sfx, bell(midi([88, 91, 93, 96, 100][i]), 1.0), tc, .26); put(sfx, thump(130, .12), tc, .22)
    for k, m in enumerate((96, 100)): put(sfx, bell(midi(m), .6), tc + .06 + k*.07, .06)
t = t_(1.0); put(sfx, np.sin(2*np.pi*np.cumsum(300 + 900*(t/1.0))/SR) * np.exp(-t*3.5), TC[3], .08)     # ondes "bons plans"
put(sfx, thump(50, .9), TC[4], .45)                                         # QR code posé
for k in range(28): put(sfx, bell(midi([91, 93, 96, 98, 100][k % 5]), .5), 18.7 - (k % 6)*.08 - 0.0 + (k % 9)*0.0, .05)   # clients qui arrivent
put(sfx, bell(midi(84), 2.0), 19.1, .24); put(sfx, bell(midi(91), 1.8), 19.3, .17); put(sfx, bell(midi(100), 1.6), 19.5, .12)
# ---------------------------------------------------------------- placement des voix et mixage
for nom, t0 in (('v1', H['v1']), ('v2', H['v2']), ('c1', TC[0]), ('c2', TC[1]), ('c3', TC[2]), ('c4', TC[3]), ('c5', TC[4]), ('v4', H['v4'])):
    with wave.open(fich[nom]) as w: x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    put(voc, x, t0, .95)
env = lisse(np.abs(voc), .12); env = np.clip(env / (env.max()*.35 + 1e-9), 0, 1)
duck = 1 - .55*lisse(env, .25); duck2 = 1 - .35*lisse(env, .25)
gL = musL*duck + drm*duck2*.9 + sfx*.9 + voc*1.0; gR = musR*duck + drm*duck2*.9 + sfx*.9 + voc*1.0
for g in (gL, gR): fade = int(.4*SR); g[-fade:] *= np.linspace(1, 0, fade)
st = np.stack([gL, gR], 1); st = st / max(1e-9, np.abs(st).max()) * .9
with wave.open(f"{TMP}/mix.wav", 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{TMP}/mix.wav", "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-ar", "44100", f"{TMP}/audio.wav"], check=True)
print("audio ok", f"{TMP}/audio.wav")
