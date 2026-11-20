#!/usr/bin/env python3
"""Bande-son de l'épisode 1 : voix off (Piper, voix fr_FR siwis, CC BY 4.0), musique et bruitages
générés par synthèse. Usage : python3 composer-son.py <dossier_tts> <dossier_travail> <video.mp4> <sortie.mp4>
<dossier_tts> contient venv/ (piper-tts) et fr_FR-siwis-medium.onnx."""
import sys, os, subprocess, wave, json
import numpy as np

TTS, TMP, VIDEO, SORTIE = sys.argv[1:5]
os.makedirs(TMP, exist_ok=True)
SR = 44100; DUR = 42.0; N = int(SR * DUR)
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- outils de synthèse
def t_(d): return np.arange(int(d * SR)) / SR
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env_ar(n, a, r):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] *= np.linspace(0, 1, na) ** 1.5
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def lowpass(x, fc):
    a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y
def put(bus, sig, t0, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: bus[i:j] += sig[:j - i] * g
def bell(f, d=1.2):
    t = t_(d); return (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*7) + .2*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*12)) * np.exp(-t*3.6) * (1 - np.exp(-t*400))
def thump(f0=90, d=.35):
    t = t_(d); return np.sin(2*np.pi*(f0*np.exp(-t*9)*t + 0)) * np.exp(-t*12)
def noise(d): return rng.standard_normal(int(d*SR))
def click(): 
    t = t_(.03); return noise(.03) * np.exp(-t*220)

musL = np.zeros(N); musR = np.zeros(N); sfx = np.zeros(N); voc = np.zeros(N); drm = np.zeros(N)

# ---------------------------------------------------------------- musique (nappes + cloches)
def pad(notes, t0, t1, g=.10, brillance=1.0, rel=1.0):
    d = (t1 - t0) + rel; n = int(d * SR); t = t_(d)
    for ch, bus in ((0, musL), (1, musR)):
        sig = np.zeros(n)
        for k, m in enumerate(notes):
            f = midi(m) * (1 + (0.0014 if (k + ch) % 2 else -0.0014))
            sig += np.sin(2*np.pi*f*t) + .30*brillance*np.sin(2*np.pi*2*f*t) + .12*brillance*np.sin(2*np.pi*3*f*t)
        sig *= (1 + .12*np.sin(2*np.pi*.23*t + ch)) / len(notes)
        put(bus, sig * env_ar(n, min(1.4, (t1-t0)*.45), rel), t0, g)
A2, C3, E3, F2, G2, D3 = 45, 48, 52, 41, 43, 50
pad([45, 52, 57, 60], 0, 4.5, .11, .6)                  # La mineur : nuit, mystère
pad([41, 48, 52, 57], 4.5, 11.5, .11, .7)               # Fa
pad([48, 55, 60, 64], 11.5, 15.0, .10, 1.0)             # Do : souvenir, doux
pad([45, 52, 57, 60], 15.0, 18.5, .11, .7)             # La mineur : le téléphone
pad([48, 55, 59, 64], 18.5, 24.0, .11, 1.1)            # Do maj7 : la carte, émerveillement
pad([45, 52, 57, 60], 24.0, 28.0, .12, .6)             # La mineur : ça s'éteint
pad([38, 50, 57, 62], 28.0, 32.5, .12, .7)             # Ré mineur : le message
pad([41, 48, 53, 57], 32.5, 34.8, .12, 1.0)            # Fa : Noé décidé
pad([43, 50, 55, 59], 34.8, 36.0, .12, 1.0)            # Sol
pad([45, 52, 57, 60], 36.0, 38.5, .13, .5, rel=.05)    # tension, coupée net
pad([48, 55, 60, 64, 67], 40.5, 42.0, .14, 1.2, rel=.3)  # fin : Do majeur, lumineux
# basse pulsée (téléphone -> brume)
for t0, t1, f in ((15.0, 18.5, 45), (24.0, 28.0, 45), (28.0, 32.5, 36.7), (36.0, 38.5, 45)):
    d = t1 - t0; t = t_(d); sig = np.sin(2*np.pi*midi(f-12+12)*t) * (.55 + .45*np.sin(2*np.pi*1.2*t)) * env_ar(len(t), .3, .15)
    put(musL, sig, t0, .12); put(musR, sig, t0, .12)
# boîte à musique du souvenir (plan 5)
mel = [76, 79, 81, 79, 76, 74, 76]
for i, m in enumerate(mel): put(sfx, bell(midi(m), 1.4), 11.7 + i*.45, .16)
# arpèges lumineux sur la carte (plan 7)
penta = [81, 84, 86, 88, 91, 93]
# cloches des épingles : plan 7a (18.5 + .45 + i*.12) puis 7b (21.0 + .05 + (i-14)*.1)
for i in range(40):
    t0 = 18.5 + .45 + i*.12 if i < 14 else 21.0 + .05 + (i-14)*.10
    put(sfx, bell(midi(penta[(i*5 + i//3) % len(penta)]), .9), t0, .10 + .04*((i % 3) == 0))
# cloche finale
put(sfx, bell(midi(84), 2.0), 40.55, .22); put(sfx, bell(midi(91), 1.6), 40.95, .16)

# ---------------------------------------------------------------- bruitages
def buzz(t0, d, g=.12, f=100):
    t = t_(d); s = np.sign(np.sin(2*np.pi*f*t)) * .5 + noise(d) * .15
    s *= (np.sin(2*np.pi*23*t) > -.2) * env_ar(len(t), .02, .05); put(sfx, lowpass(s, 2500), t0, g)
buzz(.5, .9, .12)                                          # néon qui vacille (plan 1)
for k in range(4): put(sfx, click(), .5 + k*.23, .3)
# brume : montée puis retrait (plan 2) : bruit grave qui gonfle
d = 3.0; w = lowpass(noise(d), 380) * (np.sin(np.pi*np.clip(t_(d)/d, 0, 1))**1.4) ; put(sfx, w, 2.0, 1.7)
put(sfx, thump(55, 1.0), 3.1, .5)                          # le mur apparaît
# pas de Noé (plan 3) puis arrêt net + sursaut
for k, tt in enumerate((4.62, 4.95, 5.28, 5.5)): put(sfx, thump(120 - k*5, .16), tt, .45)
st = t_(.6); put(sfx, np.sin(2*np.pi*(300*st + 900*st**2)) * np.exp(-st*5) * (st > 0), 5.52, .10)   # surprise
# plan 5 : léger tintement de comptoir
put(sfx, bell(midi(96), .6), 12.4, .05)
# plan 6 : le téléphone vibre (15.45 -> 18.5) + carillon
for k in range(int((18.5 - 15.45) / .38)):
    d = .22; t = t_(d); s = (np.sin(2*np.pi*72*t) + .5*np.sin(2*np.pi*144*t)) * env_ar(len(t), .01, .06)
    put(sfx, s, 15.45 + k*.38, .30)
put(sfx, bell(midi(88), 1.2), 15.45, .18); put(sfx, bell(midi(95), 1.2), 15.55, .12)
# plan 8 : coupures de courant qui clignotent puis s'éteignent
for t0, t1 in ((24.45, 25.35), (26.3, 27.2)):
    buzz(t0, t1 - t0, .13, 120)
    t = t_(.9); put(sfx, np.sin(2*np.pi*(200*t - 150*t**1.3)) * np.exp(-t*4) * (t > 0), t1, .22); put(sfx, thump(50, .8), t1, .35)
# plan 9 : frappe du message (30 caractères/s)
for t0, n in ((28.15, len("Ils disparaissent quand plus personne ne vient.")), (30.3, len("Tu les vois. Tu es Gardien, maintenant."))):
    for c in range(0, n, 2): put(sfx, click(), t0 + c/30, .22)
# plan 10 : le regard déterminé (33.7) : accord montant
put(sfx, thump(65, .8), 33.7, .45); put(sfx, bell(midi(72), 1.5), 33.7, .12)
# plan 11 : la brume avance, montée de tension coupée net à 38.5
d = 2.5; t = t_(d); r = lowpass(noise(d), 700) * (t/d)**2.2; put(sfx, r, 36.0, 1.3)
for k in range(8): put(sfx, thump(60, .25), 36.0 + k*(.5 - .04*k), .30 + .04*k)
# la coupure : silence total entre 38.5 et 40.5 (rien n'est ajouté)

# ---------------------------------------------------------------- rythme : batterie calée sur 120 battements/min (1 temps = 0,5 s)
# toutes les coupes de la vidéo tombent sur des multiples de 0,5 s : image et son frappent ensemble.
def kick(t0, g=.55):
    t = t_(.38); ph = 2*np.pi*np.cumsum(48 + 120*np.exp(-t*26))/SR
    put(drm, np.sin(ph) * np.exp(-t*8.5) * (1 - np.exp(-t*900)), t0, g)
def snare(t0, g=.40):
    t = t_(.26); n = noise(.26); n = np.diff(n, prepend=0)
    put(drm, (n*.55*np.exp(-t*20) + np.sin(2*np.pi*190*t)*.5*np.exp(-t*28)), t0, g)
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
beat = .5
# 0-2 s : l'accroche, un coeur qui s'accélère
for i, t0 in enumerate((0.0, .5, 1.0, 1.25, 1.5, 1.75)): kick(t0, .35 + .05*i)
riser(0.0, 2.0, .22)
# 2-4,5 s : la brume, pouls grave
for t0 in (2.0, 3.0, 4.0): kick(t0, .55)
# 4,5-11,5 s : rythme mystérieux, un temps sur deux, contretemps de charleston
for t0 in np.arange(4.5, 11.5, 1.0): kick(t0, .50)
for t0 in np.arange(5.0, 11.5, 1.0): hat(t0, .07)
for t0 in np.arange(6.0, 11.5, 2.0): snare(t0 + .5 - .5, .30)
# 11,5-15 s : on respire (boîte à musique seule)
# 15-18,5 s : le téléphone, pulsation qui s'accélère
for t0 in np.arange(15.0, 18.5, .5): kick(t0, .42)
for t0 in np.arange(16.5, 18.5, .25): hat(t0, .06)
# 18,5-24 s : la carte, groove complet (kick à chaque temps, caisse claire sur 2 et 4, charleston en croches)
crash(18.5, .18)
for t0 in np.arange(18.5, 24.0, .5): kick(t0, .55)
for t0 in np.arange(19.0, 24.0, 1.0): snare(t0, .38)
for t0 in np.arange(18.5, 24.0, .25): hat(t0 + .0, .07 + (0.03 if (round((t0-18.5)/.25) % 2) else 0))
arp = [81, 84, 88, 91, 88, 84, 86, 91]
for i, t0 in enumerate(np.arange(18.5, 24.0, .25)): pluck(midi(arp[i % 8] - 12), t0, .05)
# 24-28 s : ça s'éteint, demi-temps lourd
for t0 in np.arange(24.0, 28.0, 1.0): kick(t0, .60)
snare(25.0, .30); snare(27.0, .30)
# 28-32,5 s : le message, pouls + roulement final
for t0 in np.arange(28.0, 32.0, 1.0): kick(t0, .50)
for t0 in np.arange(29.0, 32.0, 2.0): snare(t0, .26)
for i, t0 in enumerate(np.arange(31.5, 32.5, .125)): snare(t0, .12 + .03*i)
whoosh(32.5, .35, .20)
# 32,5-36 s : Noé décidé, la montée
crash(32.5, .18)
for t0 in np.arange(32.5, 36.0, .5): kick(t0, .58)
for t0 in np.arange(33.0, 36.0, 1.0): snare(t0, .36)
for t0 in np.arange(32.5, 36.0, .25): hat(t0, .07)
for i, t0 in enumerate(np.arange(32.5, 36.0, .25)): pluck(midi([77, 81, 84, 89, 84, 81, 79, 83][i % 8] - 12), t0, .05)
# 36-38,5 s : la brume avance, roulement et montée coupés net
for i, t0 in enumerate(np.arange(36.0, 38.5, .125)): snare(t0, .10 + .008*i)
riser(36.0, 38.5, .30)
# 40,5 s : impact final + accord
kick(40.5, .7); crash(40.5, .20)
# petits "whoosh" qui accompagnent les coupes
for tc in (2.0, 4.5, 8.0, 11.5, 15.0, 18.5, 24.0, 28.0, 36.0): whoosh(tc)
# coups d'impact aux moments forts : mur (3.15), surprise (5.5), téléphone (15.45), extinctions (25.35, 27.2), regard (33.7)
for tt in (3.15, 5.5, 15.45, 25.35, 27.2, 33.7): put(sfx, thump(48, .9), tt, .55)

# ---------------------------------------------------------------- voix
VOIX = [  # (nom, texte, début, fin, timbre)
 ('p01', "Hier, cette boulangerie existait.", .05, 2.0, 'nar'),
 ('p02', "Ce matin, il n'y a plus qu'un mur.", 2.1, 4.45, 'nar'),
 ('p03', "Et personne ne s'en souvient.", 5.2, 7.9, 'nar'),
 ('p04', "Une boulangerie ? Ici ? Il n'y a jamais rien eu, mon garçon.", 8.3, 11.4, 'vieux'),
 ('p05', "Pourtant, hier encore, j'y achetais mon pain.", 11.7, 14.95, 'nar'),
 ('p06', "Cette nuit-là, mon téléphone s'est allumé tout seul.", 15.1, 18.4, 'nar'),
 ('p07a', "Des lumières. Partout dans la ville.", 18.7, 21.1, 'nar'),
 ('p07b', "Chaque lumière... c'est un commerce.", 21.3, 23.9, 'nar'),
 ('p08', "Et certaines s'éteignent.", 24.2, 26.1, 'nar'),
 ('p09a', "Ils disparaissent quand plus personne ne vient.", 28.15, 30.35, 'carte'),
 ('p09b', "Tu les vois. Tu es Gardien, maintenant.", 30.45, 32.55, 'carte'),
 ('p10', "Celle-ci, au coin de ma rue...", 32.9, 35.4, 'nar'),
 ('p12', "Suite au prochain épisode.", 38.65, 40.4, 'nar'),
 ('p13', "La carte existe vraiment.", 40.55, 41.95, 'nar'),
]
FILTRES = {'nar': "", 'vieux': "asetrate=22050*0.80,atempo=1.25,", 'carte': "asetrate=22050*0.90,atempo=1.11,"}
bilan = []
def lire(p):
    with wave.open(p) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
for nom, texte, t0, t1, timbre in VOIX:
    brut = f"{TMP}/{nom}-brut.wav"
    subprocess.run([f"{TTS}/venv/bin/python", "-m", "piper", "-m", f"{TTS}/fr_FR-siwis-medium.onnx", "-f", brut,
                    "--length-scale", "0.9" if timbre == 'nar' else "0.88", "--", texte], check=True, capture_output=True)
    with wave.open(brut) as w: d = w.getnframes() / w.getframerate()
    d_eff = d * (1.0 if timbre == 'nar' else (1/1.25*1.25 if timbre == 'vieux' else 1.0))
    tempo = max(1.0, d / (t1 - t0 - .05)); tempo = min(tempo, 1.4)
    out = f"{TMP}/{nom}.wav"
    chaine = FILTRES[timbre] + f"atempo={tempo:.4f}," + ("aecho=0.8:0.6:70|130:0.30|0.20," if timbre == 'carte' else "") + f"aresample={SR},highpass=f=90,volume=1.0"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", brut, "-af", chaine, "-ac", "1", out], check=True)
    x = lire(out); fin = t0 + len(x)/SR
    bilan.append((nom, round(t0, 2), round(fin, 2), round(t1, 2), 'OK' if fin <= t1 + .05 else 'DEPASSE'))
    put(voc, x, t0, .95)
print(json.dumps(bilan, ensure_ascii=False))

# ---------------------------------------------------------------- mixage (la musique baisse quand on parle)
def lisse(x, f): 
    k = int(f * SR); return np.convolve(x, np.ones(k)/k, mode='same')
env = lisse(np.abs(voc), .12); env = np.clip(env / (env.max()*.35 + 1e-9), 0, 1)
duck = 1 - .55*lisse(env, .25)
duck2 = 1 - .35*lisse(env, .25)
gL = musL*duck + drm*duck2*.9 + sfx*.9 + voc*1.0; gR = musR*duck + drm*duck2*.9 + sfx*.9 + voc*1.0
# silence net sur la coupure 38.5 -> 40.5
cut = (np.arange(N)/SR >= 38.5) & (np.arange(N)/SR < 40.5)
for g in (gL, gR):
    g[cut] = 0
    fade = int(.35*SR); g[-fade:] *= np.linspace(1, 0, fade)
    k = int(.012*SR); i = int(38.5*SR); g[i-k:i] *= np.linspace(1, 0, k)   # évite le clic à la coupure
st = np.stack([gL, gR], 1); st = st / max(1e-9, np.abs(st).max()) * .9
wavp = f"{TMP}/mix.wav"
with wave.open(wavp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO, "-i", wavp, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", SORTIE], check=True)
print("ok", SORTIE)
