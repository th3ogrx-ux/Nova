#!/usr/bin/env python3
"""Bande-son de l'épisode 2 "Ne m'oublie pas" : voix (Piper : siwis pour Noé et le Gris, MLS pour Lina et la boulangère, CC BY 4.0), musique, batterie et bruitages synthétisés.
Usage : python3 composer-son.py <dossier_tts> <dossier_travail> <video.mp4> <sortie.mp4>"""
import sys, os, subprocess, wave, json
import numpy as np

TTS, TMP, VIDEO, SORTIE = sys.argv[1:5]
os.makedirs(TMP, exist_ok=True)
SR = 44100; DUR = 53.0; N = int(SR * DUR)
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

# ---------------------------------------------------------------- MUSIQUE : nappes
pad([45, 52, 57, 60], 0.0, 12.0, .10, .6)                      # P1-P4 : nuit, tension
pad([45, 51, 57, 64], 15.0, 19.0, .13, .5)                     # P5 : le Gris, froid
pad([48, 55, 60, 64, 67], 19.2, 25.0, .13, 1.0)                # P6 : Lina, la lumière revient
pad([48, 55, 59, 64], 25.0, 27.0, .12, 1.0); pad([41, 48, 53, 57], 27.0, 29.0, .12, 1.0); pad([43, 50, 55, 59], 29.0, 31.0, .12, 1.0)   # P7 : espoir
pad([38, 45, 53, 57], 31.0, 36.0, .15, .5, rel=.05)            # P8 : la colère, coupée net à 36,0 s
pad([45, 52, 59, 64], 37.2, 41.0, .08, 1.2)                    # P9 : message lointain
pad([45, 52, 57, 60], 41.0, 43.2, .09, 1.0); pad([45, 52, 56, 60], 43.2, 49.0, .13, .5, rel=.05)   # P10-P11
pad([48, 55, 60, 64, 67], 51.0, 53.0, .15, 1.2, rel=.3)       # P13 : fin
# boîte à musique de la boulangerie (reprise de l'épisode 1) : plan 10, avec écho
mel = [76, 79, 81, 79, 76, 74, 76]
for i, m in enumerate(mel):
    put(sfx, bell(midi(m), 1.6), 41.1 + i*.45, .14); put(sfx, bell(midi(m), 1.6), 41.1 + i*.45 + .22, .06)

# ---------------------------------------------------------------- RYTHME (120 bpm)
# P1 : battement de coeur qui s'accélère, puis alarme sur le compteur "47"
for t0 in (0.0, .8, 1.5): coeur(t0, .45)
riser(0.0, 1.2, .22)
for t0 in np.arange(1.2, 3.0, .5): kick(t0, .55)
for t0 in np.arange(1.2, 3.0, .25): hat(t0, .06)
# P2 : flash-backs, pouls grave
for t0 in (3.0, 4.0, 5.0): kick(t0, .55)
# P3 : la carte défile : tension qui monte
for t0 in np.arange(6.0, 10.0, .5): kick(t0, .40 + .02*(t0-6))
for t0 in np.arange(8.0, 10.0, .25): hat(t0, .06)
# P4 : la course vers la librairie (action), puis le vide
crash(10.0, .16)
for t0 in np.arange(10.0, 12.0, .5): kick(t0, .60)
for t0 in np.arange(10.5, 12.0, 1.0): snare(t0, .38)
for t0 in np.arange(10.0, 12.0, .25): hat(t0, .07)
# P6 : Lina : rythme léger et décontracté
crash(19.3, .18)
for t0 in np.arange(19.5, 25.0, 1.0): kick(t0, .48)
for t0 in np.arange(20.0, 25.0, 1.0): snare(t0, .30)
for t0 in np.arange(19.5, 25.0, .5): hat(t0 + .25, .06)
arpL = [72, 76, 79, 84, 79, 76, 74, 79]
for i, t0 in enumerate(np.arange(19.5, 25.0, .25)): pluck(midi(arpL[i % 8] - 12), t0, .05)
# P7 : les autres Gardiens : groove complet, de plus en plus plein
crash(25.0, .18)
for t0 in np.arange(25.0, 31.0, .5): kick(t0, .55)
for t0 in np.arange(25.5, 31.0, 1.0): snare(t0, .36)
for t0 in np.arange(25.0, 31.0, .25): hat(t0, .07)
arpG = [76, 79, 84, 88, 84, 79, 81, 84]
for i, t0 in enumerate(np.arange(25.0, 31.0, .25)): pluck(midi(arpG[i % 8] - 12), t0, .055)
# P8 : la colère du Gris, grosse caisse lourde et roulement
crash(31.0, .26); put(sfx, thump(40, 1.4), 31.0, .9)
for t0 in np.arange(31.0, 36.0, .5): kick(t0, .70)
for t0 in np.arange(31.5, 36.0, 1.0): snare(t0, .42)
for i, t0 in enumerate(np.arange(34.5, 36.0, .125)): snare(t0, .12 + .02*i)
# P11 : "Viens me chercher" : le coeur puis tout monte jusqu'à la coupure
for t0 in np.arange(46.0, 47.6, .5): coeur(t0, .40)
for i, t0 in enumerate(np.arange(47.6, 49.0, .25)): kick(t0, .50 + .04*i)
for i, t0 in enumerate(np.arange(47.6, 49.0, .0625)): snare(t0, .10 + .005*i)
riser(46.0, 49.0, .32)
# P13 : fin
kick(51.0, .7); crash(51.0, .22)

# ---------------------------------------------------------------- BRUITAGES
# P1
put(sfx, thump(45, 1.0), 1.2, .6)
for k in range(8): beep(1.2 + k*.25, 1250, .08, .13)
# P2 : trois flashs (3,0 brume ; 4,0 00:01 ; 5,0 boucherie qui se rallume)
for tc in (3.0, 4.0, 5.0): whoosh(tc, .3, .22)
grondement(3.0, 4.0, .40, 300); beep(4.0, 700, .5, .15); put(sfx, thump(50, .8), 4.0, .5)
for k, m in enumerate((84, 88, 91, 96)): put(sfx, bell(midi(m), 1.4), 5.0 + k*.08, .15)
# P3 : défilement frénétique de la carte
t = 6.0
for i in range(26): beep(t, 800 + (i*97 % 500), .05, .07); t += max(.05, .26 - i*.01)
put(sfx, thump(45, 1.0), 8.0, .55); whoosh(8.0, .25, .2)
# P4 : course, la brume avale la librairie (11,6), la main traverse le gris (12,2), silence à 14,0
grondement(10.9, 12.2, .45, 320); put(sfx, thump(40, 1.5), 11.6, .75)
whoosh(12.2, .3, .22); grondement(12.2, 13.6, .40, 260)
put(sfx, np.sin(2*np.pi*np.cumsum(220 - 140*(t_(1.2)/1.2))/SR) * np.exp(-t_(1.2)*2.5), 12.6, .20)
# P5 : le Gris, drone
put(sfx, np.sin(2*np.pi*55*t_(3.8)) * env_ar(int(3.8*SR), .8, .5), 15.0, .30)
grondement(15.0, 18.9, .30, 240)
# P6 : la vitrine de la fleuriste s'allume (19,3), Lina sort
put(sfx, thump(55, .8), 19.3, .55)
for k, m in enumerate((84, 88, 91, 96, 100)): put(sfx, bell(midi(m), 1.4), 19.3 + k*.07, .16)
t = t_(.9); put(sfx, np.diff(noise(.9), prepend=0) * np.exp(-t*3), 19.3, .30)
whoosh(20.2, .25, .16); whoosh(21.4, .25, .16); whoosh(23.0, .25, .16)
put(sfx, bell(midi(96), .6), 20.5, .05)   # clochette de porte
# P7 : chaque point bleu qui arrive rallume une lumière
ARR = [0.4 + ((i*53) % 100) / 100 * 3.1 for i in range(47)]
for i, a in enumerate(ARR):
    put(sfx, bell(midi([84, 88, 91, 93, 96][i % 5]), .9), 27.0 + a, .07)
whoosh(27.0, .3, .2)
# P8 : la vague gronde, le Gris monte
grondement(31.0, 36.0, .55, 380); riser(31.0, 36.0, .2)
# P9 : le silence, le téléphone vibre doucement (36,3 -> 37,2), carillon lointain
vibre(36.3, 37.2, .22)
put(sfx, bell(midi(81), 2.5), 37.2, .12); put(sfx, bell(midi(88), 2.5), 37.35, .09)
# P10 : choc de Lina (43,2)
put(sfx, thump(50, 1.0), 43.2, .6); beep(43.2, 900, .3, .10)
# P11 : le message
put(sfx, bell(midi(88), 2.0), 46.1, .10)
# P12 : la coupure : silence de 49,0 à 51,0 s (rien n'est ajouté)
# P13 : fin
put(sfx, bell(midi(84), 2.0), 51.1, .22); put(sfx, bell(midi(91), 1.6), 51.45, .16)

# ---------------------------------------------------------------- VOIX
def piper(nom, texte, ls, modele, extra):
    brut = f"{TMP}/{nom}-brut.wav"
    cmd = [f"{TTS}/venv/bin/python", "-m", "piper", "-m", f"{TTS}/{modele}.onnx"] + extra + ["-f", brut, "--length-scale", str(ls), "--sentence-silence", "0.05", "--", texte]
    subprocess.run(cmd, check=True, capture_output=True); return brut
MLS = ["-c", f"{TTS}/mls-medium.onnx.json"]
VOIX = [  # (nom, texte, début, fin, timbre, vitesse, gain)
 ('p01', "47 commerces. Une seule nuit. Et je suis tout seul.", .30, 2.95, 'nar', .90, 1.0),
 ('p02', "Hier, pour sauver une seule boutique, il m'a fallu deux minutes.", 3.10, 5.95, 'nar', .85, 1.0),
 ('p03', "Je ne peux pas être partout à la fois.", 6.20, 8.60, 'nar', .90, 1.0),
 ('p04', "Non... non, non, non.", 12.20, 14.00, 'nar', 1.00, 1.0),
 ('p05', "Tu comprends, maintenant ? Un seul Gardien, ça ne suffit pas.", 15.40, 18.90, 'gris', 1.10, 1.0),
 ('p06a', "T'es nouveau, toi.", 20.15, 21.35, 'lina', .88, 1.0),
 ('p06b', "Tu... tu les vois aussi ?", 21.45, 23.10, 'nar', .90, 1.0),
 ('p06c', "Depuis un an. Et on n'est pas que deux.", 23.15, 25.00, 'lina', .86, 1.0),
 ('p07', "Chaque fois que quelqu'un pousse la porte d'un commerce, une lumière se rallume.", 25.30, 30.90, 'lina', .88, 1.0),
 ('p08', "Alors je vais les effacer... de vos souvenirs.", 31.45, 34.95, 'gris', .98, 1.45),
 ('p09a', "Noé. Ne m'oublie pas.", 37.40, 39.45, 'boulangere', .68, 1.0),
 ('p09b', "Qui êtes-vous ?", 39.60, 40.95, 'nar', 1.05, .8),
 ('p10', "C'est impossible. Personne ne revient de l'Oubli.", 43.40, 46.00, 'lina', .88, 1.0),
 ('p11', "Je suis toujours là. Viens me chercher.", 46.20, 48.95, 'boulangere', .68, 1.0),
 ('p13', "La carte existe vraiment.", 51.10, 52.90, 'nar', .90, 1.0),
]
MODELE = {'nar': ('fr_FR-siwis-medium', []), 'gris': ('fr_FR-siwis-medium', []), 'lina': ('fr_FR-upmc-medium', ['-s', '0']),
          'boulangere': ('mls-fr_FR-mls-medium', MLS + ['-s', '9'])}
FILTRES = {'nar': "", 'gris': "asetrate=22050*0.72,atempo=1.389,aecho=0.8:0.7:120|240:0.40|0.25,",
           'lina': "", 'boulangere': "asetrate=22050*0.97,aresample=22050,lowpass=f=3600,aecho=0.8:0.65:150|320|520:0.55|0.40|0.28,volume=0.9,"}
bilan = []
def lire(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
for nom, texte, t0, t1, timbre, ls, gain in VOIX:
    modele, extra = MODELE[timbre]
    brut0 = piper(nom, texte, ls, modele, extra)
    brut = f"{TMP}/{nom}-net.wav"   # on coupe les silences du début et de la fin
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut0, "-af",
                    "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse", brut], check=True)
    with wave.open(brut) as w: d = w.getnframes() / w.getframerate()
    tempo = min(1.45, max(1.0, d / (t1 - t0 - .03)))
    out = f"{TMP}/{nom}.wav"
    chaine = FILTRES[timbre] + f"atempo={tempo:.4f},aresample={SR},highpass=f=90"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", chaine, "-ac", "1", out], check=True)
    x = lire(out); fin = t0 + len(x)/SR
    parole = t0 + d / tempo   # fin de la parole elle-même (l'écho peut courir un peu plus longtemps)
    bilan.append((nom, round(t0, 2), round(parole, 2), round(t1, 2), 'OK' if parole <= t1 + .08 else 'DEPASSE'))
    put(voc, x, t0, .95 * gain)
print(json.dumps(bilan, ensure_ascii=False))

# ---------------------------------------------------------------- mixage
env = lisse(np.abs(voc), .12); env = np.clip(env / (env.max()*.35 + 1e-9), 0, 1)
duck = 1 - .55*lisse(env, .25); duck2 = 1 - .35*lisse(env, .25)
gL = musL*duck + drm*duck2*.9 + sfx*.9 + voc*1.0; gR = musR*duck + drm*duck2*.9 + sfx*.9 + voc*1.0
tt = np.arange(N) / SR
# silences : 14,0-15,0 (la brume a gagné), 36,0-37,0 (silence soudain), 49,0-51,0 (la coupure)
for a, b in ((14.0, 15.0), (36.0, 37.0), (49.0, 51.0)):
    m = (tt >= a) & (tt < b)
    for g in (gL, gR):
        k = int(.010*SR); i = int(a*SR); g[i-k:i] *= np.linspace(1, 0, k); g[m] = 0
for g in (gL, gR):
    fade = int(.35*SR); g[-fade:] *= np.linspace(1, 0, fade)
st = np.stack([gL, gR], 1); st = st / max(1e-9, np.abs(st).max()) * .9
wavp = f"{TMP}/mix.wav"
with wave.open(wavp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO, "-i", wavp, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", SORTIE], check=True)
print("ok", SORTIE)
