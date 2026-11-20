#!/usr/bin/env python3
"""Bande-son de "Il reste 2 minutes" : voix (Piper, fr_FR siwis, CC BY 4.0), musique, batterie et bruitages synthétisés.
Usage : python3 composer-son.py <dossier_tts> <dossier_travail> <video.mp4> <sortie.mp4>"""
import sys, os, subprocess, wave, json
import numpy as np

TTS, TMP, VIDEO, SORTIE = sys.argv[1:5]
os.makedirs(TMP, exist_ok=True)
SR = 44100; DUR = 55.0; N = int(SR * DUR)
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
pad([45, 52, 57, 60], 0, 3.0, .10, .6)                      # P1 : course
pad([38, 45, 53, 57], 4.0, 9.0, .10, .7)                    # P3 : le mur, malaise
pad([45, 52, 57, 59], 9.0, 13.0, .11, .7)                   # P4 : le téléphone
pad([45, 52, 57, 60], 13.0, 15.0, .11, .8)
pad([45, 52, 57, 60], 15.0, 19.0, .10, .8); pad([41, 48, 53, 57], 19.0, 21.0, .10, .8); pad([43, 50, 55, 59], 21.0, 23.0, .10, .8)   # P6 : course
pad([45, 51, 57, 64], 23.5, 27.0, .13, .5)                  # P7 : le Gris, froid
pad([45, 52, 57, 60], 27.0, 28.0, .11, .8)
pad([38, 50, 57, 62], 28.0, 33.0, .12, .7)                  # P8
pad([45, 52, 57, 60], 33.0, 36.4, .11, .6, rel=.05)         # P9 : tension
pad([48, 55, 60, 64, 67], 36.5, 39.0, .17, 1.2)             # P9 : la lumière revient, accord de Do majeur
pad([48, 55, 59, 64], 39.0, 43.0, .11, 1.0)                 # P10 : soulagement
pad([45, 52, 56, 60], 43.0, 49.0, .13, .5)                  # P11 : retournement
pad([45, 52, 57, 60], 49.0, 51.0, .15, .5, rel=.05)         # P12 : montée, coupée net
pad([48, 55, 60, 64, 67], 53.0, 55.0, .15, 1.2, rel=.3)     # P14 : fin

# ---------------------------------------------------------------- RYTHME (120 bpm : toutes les coupes tombent sur un multiple de 0,5 s)
# P1 : l'accroche, la batterie démarre tout de suite
for t0 in np.arange(0, 3.0, .5): kick(t0, .60)
for t0 in np.arange(1.0, 3.0, 1.0): snare(t0 + 0, .35)
for t0 in np.arange(0, 3.0, .25): hat(t0, .07)
for i, t0 in enumerate(np.arange(0, 3.0, .25)): pluck(midi([69, 72, 76, 79, 76, 72, 71, 74][i % 8] - 12), t0, .05)
crash(0.0, .20); put(sfx, thump(45, 1.0), 0.0, .6)
# P2 : rembobinage (pas de batterie, le son "freine")
# P3 : calme inquiet, un cœur toutes les 2 s
for t0 in np.arange(4.5, 9.0, 2.0): coeur(t0, .35)
# P4 : montée de tension, pulsation à partir de 11 s
for t0 in np.arange(11.0, 13.0, .5): kick(t0, .40)
# P5 : le compte à rebours, puis le départ
for t0 in np.arange(14.0, 15.0, .25): kick(t0, .45); 
riser(13.0, 15.0, .22)
# P6 : la course, groove complet
crash(15.0, .18)
for t0 in np.arange(15.0, 23.0, .5): kick(t0, .60)
for t0 in np.arange(15.5, 23.0, 1.0): snare(t0, .40)
for t0 in np.arange(15.0, 23.0, .25): hat(t0, .06 + (0.03 if round((t0-15)/.25) % 2 else 0))
arpA = [69, 72, 76, 79, 76, 72, 74, 77]
for i, t0 in enumerate(np.arange(15.0, 23.0, .25)): pluck(midi(arpA[i % 8] - 12), t0, .055)
for t0 in np.arange(15.0, 23.0, .5): put(sfx, np.sin(2*np.pi*midi(33 if t0 < 19 else (29 if t0 < 21 else 31))*t_(.3)) * np.exp(-t_(.3)*9), t0 + .25, .20)   # basse
# P7 : le Gris : silence de batterie, cœur lent, puis la reprise
for t0 in np.arange(24.0, 26.9, 1.0): coeur(t0, .30)
for i, t0 in enumerate(np.arange(26.9, 28.0, .125)): snare(t0, .10 + .02*i)
riser(26.9, 28.0, .22)
# P8 : de nouveau l'action, compte à rebours
crash(28.0, .18)
for t0 in np.arange(28.0, 33.0, .5): kick(t0, .55)
for t0 in np.arange(28.5, 33.0, 1.0): snare(t0, .36)
for t0 in np.arange(28.0, 33.0, .25): hat(t0, .07)
for i, t0 in enumerate(np.arange(31.5, 33.0, .125)): snare(t0, .10 + .01*i)
# P9 : tension, puis le point d'orgue (35.9 -> 36.5), puis l'explosion de lumière
for t0 in np.arange(33.0, 35.0, .5): kick(t0, .45)
for t0 in np.arange(36.5, 39.0, .5): kick(t0, .62)
crash(36.5, .24); snare(36.5, .5); put(sfx, thump(38, 1.4), 36.5, .8)
for t0 in np.arange(37.0, 39.0, 1.0): snare(t0, .38)
for t0 in np.arange(36.5, 39.0, .25): hat(t0, .07)
arpC = [72, 76, 79, 84, 79, 76, 74, 79]
for i, t0 in enumerate(np.arange(36.5, 39.0, .25)): pluck(midi(arpC[i % 8] - 12), t0, .06)
# P10 : soulagement : pas de batterie
# P11 : le retournement : cœur qui s'accélère, roulement
for t0 in np.arange(45.5, 49.0, .5): kick(t0, .50)
for t0 in np.arange(46.0, 49.0, 1.0): snare(t0, .32)
for i, t0 in enumerate(np.arange(47.5, 49.0, .125)): snare(t0, .12 + .015*i)
# P12 : les yeux, tout monte jusqu'à la coupure à 51,0 s
for i, t0 in enumerate(np.arange(49.0, 51.0, .25 - 0.0)): kick(t0, .50 + .03*i)
for i, t0 in enumerate(np.arange(49.0, 51.0, .0625)): snare(t0, .10 + .004*i)
riser(49.0, 51.0, .34)
# P14 : fin
kick(53.0, .7); crash(53.0, .22)

# ---------------------------------------------------------------- BRUITAGES
# P1 : essoufflé, la brume gronde, les vitrines claquent une à une
grondement(0.0, 3.0, .45, 320)
for tt in (.6, 1.1, 1.6, 2.1, 2.6): put(sfx, click(), tt, .5); buzz(tt - .15, .15, .10, 140)
souffle(.05, .20); souffle(1.4, .16); souffle(2.7, .22)
# P2 : le rembobinage (3,3 -> 4,0)
put(sfx, thump(60, .5), 3.0, .5)
for k in range(14): put(sfx, click(), 3.3 + k*.05, .45)
sw = np.sin(2*np.pi*np.cumsum(1500*np.exp(-t_(.7)*4.5) + 70)/SR) * np.exp(-t_(.7)*2) ; put(sfx, sw, 3.3, .28)
put(sfx, np.diff(noise(.7), prepend=0) * np.linspace(1, 0, int(.7*SR)), 3.3, .20)
# P3 : le jour : un seul son de ville lointaine, un temps de silence avant la réplique du passant
put(sfx, bell(midi(81), 1.5), 4.0, .06)
# P4 : le téléphone s'allume (9,0) et vibre fort, zoom dans l'écran (10,2), bips du point rouge
put(sfx, bell(midi(88), 1.2), 9.0, .20); put(sfx, bell(midi(95), 1.2), 9.08, .13)
vibre(9.0, 10.2, .35); whoosh(10.2, .3, .22)
for t0 in np.arange(10.4, 13.0, .5): beep(t0, 900, .08, .12)
# P5 : 01:59 (grand bip grave), départ en courant
beep(13.0, 220, .5, .22); whoosh(14.0, .3, .2)
# P6 : coupes + saut (17,9), rideau (grincement 19,7 -> 20,5 puis claquement), deux vitrines qui s'éteignent
for tc in (17.0, 19.0, 21.0): whoosh(tc, .28, .22)
whoosh(18.0, .25, .18)
g = np.diff(noise(.8), prepend=0) * np.linspace(.4, 1, int(.8*SR)) * (np.sin(2*np.pi*38*t_(.8)) > -.3); put(sfx, lowpass(g, 5000), 19.7, .20)
put(sfx, thump(55, .9), 20.5, .75); put(sfx, bell(140, 1.2), 20.5, .20); put(sfx, np.diff(noise(.4), prepend=0) * np.exp(-t_(.4)*12), 20.5, .25)
for tt in (21.6, 22.1):
    buzz(tt - .18, .18, .15, 120); put(sfx, thump(50, .8), tt, .5)
    t = t_(.9); put(sfx, np.sin(2*np.pi*(200*t - 150*t**1.3)) * np.exp(-t*4), tt, .20)
# P7 : freinage (23,0), arrêt net (23,5), le Gris apparaît (24,0)
put(sfx, np.diff(noise(.5), prepend=0) * np.linspace(1, 0, int(.5*SR)), 23.0, .28)
put(sfx, thump(48, 1.0), 23.5, .7)
put(sfx, np.sin(2*np.pi*55*t_(3.0)) * env_ar(int(3.0*SR), .8, .5), 24.0, .30)
grondement(24.0, 27.0, .38, 260)
t = t_(1.0); put(sfx, np.sin(2*np.pi*np.cumsum(80 + 500*(t/1.0)**2)/SR) * (t/1.0)**1.5, 23.0 + 0.0, 0.0)
# P8 : compte à rebours rouge : un bip à chaque changement (toutes les 0,75 s), brume qui monte
for k in range(7): beep(28.0 + k*.75, 1250, .10, .16)
grondement(28.0, 33.0, .40, 350)
# P9 : bips 3-2-1, porte qui grince, point d'orgue, explosion et onde de choc
for tt in (33.0, 33.8, 34.6): beep(tt, 1250, .10, .17)
gl = t_(.8); put(sfx, (np.sin(2*np.pi*np.cumsum(260 + 220*(gl/.8))/SR)*.4 + np.diff(noise(.8), prepend=0)*.25) * env_ar(len(gl), .05, .2), 34.1, .20)
put(sfx, bell(midi(96), 1.0), 35.9, .14); put(sfx, thump(55, .8), 35.9, .5)
t = t_(1.2); put(sfx, np.diff(noise(1.2), prepend=0) * np.exp(-t*3.2), 36.5, .40)
put(sfx, bell(midi(84), 2.0), 36.5, .22); put(sfx, bell(midi(91), 1.8), 36.7, .16); put(sfx, bell(midi(96), 1.6), 36.9, .12)
# P10 : respiration, puis le point ambre revient sur la carte (41,0)
souffle(39.6, .22, .5); souffle(40.4, .20, .5)
for k, m in enumerate((88, 91, 96, 100)): put(sfx, bell(midi(m), 1.4), 41.0 + k*.09, .16)
# P11 : le téléphone vibre fort (43,0), puis alarmes qui se multiplient sur la carte (45,5)
vibre(43.0, 45.5, .38); put(sfx, thump(45, 1.2), 43.0, .6)
for i in range(60):
    tt = 45.5 + i*.058 + (i*i % 7) * .004
    beep(tt, 700 + (i*131 % 700), .06, .05 + .002*i)
t = t_(2.5); put(sfx, np.sin(2*np.pi*np.cumsum(300 + 400*(t/2.5)**2)/SR) * (t/2.5)**1.2, 45.5, .10)
# P12 : tout monte, puis la coupure à 51,0 s (rien après)
grondement(49.0, 51.0, .55, 500)
# P14 : fin : cloches
put(sfx, bell(midi(84), 2.0), 53.1, .22); put(sfx, bell(midi(91), 1.6), 53.45, .16)

# ---------------------------------------------------------------- VOIX
VOIX = [  # (nom, texte, début, fin, timbre, vitesse piper)
 ('p01', "Si les lumières s'éteignent derrière toi... cours.", .30, 2.90, 'nar', .90),
 ('p03a', "Elle était là hier. La boulangerie.", 4.10, 6.45, 'nar', .90),
 ('p03b', "Quelle boulangerie ? Il n'y a jamais rien eu ici.", 6.60, 9.00, 'vieux', .88),
 ('p04a', "Elle va s'éteindre. Toi seul peux la sauver.", 10.25, 12.65, 'carte', .93),
 ('p04b', "Quoi ?", 12.70, 13.35, 'nar', .90),
 ('p05', "OK. OK. J'y vais.", 13.55, 14.95, 'nar', .80),
 ('p07a', "Tu ne peux pas tous les sauver, Gardien.", 24.40, 26.75, 'gris', 1.12),
 ('p07b', "Je vais quand même essayer.", 26.85, 28.10, 'nar', .90),
 ('p09a', "Bonjour ! Je voudrais deux steaks, s'il vous plaît !", 33.95, 36.40, 'nar', .85),
 ('p09b', "Ça fait longtemps qu'on n'avait pas vu de nouveau client, ici.", 36.55, 39.00, 'boucher', .90),
 ('p10', "Il suffisait... que quelqu'un vienne.", 39.90, 41.95, 'nar', .95),
 ('p11r', "Ha. Ha. Ha.", 43.40, 44.90, 'gris', 1.5),
 ('p11a', "Ce n'était que la première.", 45.00, 46.70, 'gris', 1.10),
 ('p11b', "Il y en a... combien ?", 46.80, 47.95, 'nar', .95),
 ('p14', "La carte existe vraiment.", 53.10, 54.90, 'nar', .90),
]
FILTRES = {'nar': "", 'vieux': "asetrate=22050*0.80,atempo=1.25,", 'carte': "asetrate=22050*0.90,atempo=1.11,",
           'boucher': "asetrate=22050*0.86,atempo=1.163,", 'gris': "asetrate=22050*0.72,atempo=1.389,"}
ECHO = {'carte': "aecho=0.8:0.6:70|130:0.30|0.20,", 'gris': "aecho=0.8:0.7:120|240:0.40|0.25,"}
bilan = []
def lire(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
for nom, texte, t0, t1, timbre, ls in VOIX:
    brut = f"{TMP}/{nom}-brut.wav"
    subprocess.run([f"{TTS}/venv/bin/python", "-m", "piper", "-m", f"{TTS}/fr_FR-siwis-medium.onnx", "-f", brut,
                    "--length-scale", str(ls), "--", texte], check=True, capture_output=True)
    with wave.open(brut) as w: d = w.getnframes() / w.getframerate()
    tempo = min(1.45, max(1.0, d / (t1 - t0 - .03)))
    out = f"{TMP}/{nom}.wav"
    chaine = FILTRES[timbre] + f"atempo={tempo:.4f}," + ECHO.get(timbre, '') + f"aresample={SR},highpass=f=90"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", chaine, "-ac", "1", out], check=True)
    x = lire(out); fin = t0 + len(x)/SR
    bilan.append((nom, round(t0, 2), round(fin, 2), round(t1, 2), 'OK' if fin <= t1 + .08 else 'DEPASSE'))
    put(voc, x, t0, .95)
print(json.dumps(bilan, ensure_ascii=False))

# ---------------------------------------------------------------- mixage : la musique baisse quand on parle
env = lisse(np.abs(voc), .12); env = np.clip(env / (env.max()*.35 + 1e-9), 0, 1)
duck = 1 - .55*lisse(env, .25); duck2 = 1 - .35*lisse(env, .25)
gL = musL*duck + drm*duck2*.9 + sfx*.9 + voc*1.0; gR = musR*duck + drm*duck2*.9 + sfx*.9 + voc*1.0
tt = np.arange(N) / SR
# la coupure : silence total de 51,0 s à 53,0 s
cut = (tt >= 51.0) & (tt < 53.0)
for g in (gL, gR):
    k = int(.010*SR); i = int(51.0*SR); g[i-k:i] *= np.linspace(1, 0, k)
    g[cut] = 0
    fade = int(.35*SR); g[-fade:] *= np.linspace(1, 0, fade)
st = np.stack([gL, gR], 1); st = st / max(1e-9, np.abs(st).max()) * .9
wavp = f"{TMP}/mix.wav"
with wave.open(wavp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO, "-i", wavp, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", SORTIE], check=True)
print("ok", SORTIE)
