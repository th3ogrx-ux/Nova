#!/usr/bin/env node
/* Studio de montage : une seule commande.

   node montage.js                    prend la première vidéo du dossier entree/
   node montage.js ma-video.mp4       ou une vidéo précise

   Étapes : 1) découpe de la silhouette  2) silhouette transparente
            3) transcription (fichier corrigeable)  4) animations + export sortie/video.mp4 (1080x1920, 30 i/s) */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RACINE = __dirname;
const ANIM = path.join(RACINE, "animations");
const win = os.platform() === "win32";
const PYTHON = path.join(RACINE, ".venv", win ? "Scripts/python.exe" : "bin/python");

// ---------- options ----------
const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i === -1 ? defaut : args.splice(i, 2)[1];
};
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  return i === -1 ? false : (args.splice(i, 1), true);
};
const fichierScenes = opt("--scenes", path.join(RACINE, "scenes.json"));
const fichierConfig = opt("--config", path.join(RACINE, "config.json"));
const fondOpt = opt("--fond", ""); // blanc | noir (remplace config.json pour ce rendu)
const format = opt("--format", "vertical"); // vertical (1080x1920) | horizontal (1920x1080)
const nomSortie = opt("--sortie", "video.mp4");
const langue = opt("--langue", "fr");
const vocabulaire = opt("--vocabulaire", "");
const qualite = opt("--qualite", "0.5");
const epaulesOpt = opt("--epaules", ""); // largeur ajoutée de chaque côté (px), 0 = pas d'épaules créées
const refaire = drapeau("--refaire");
const retranscrire = drapeau("--retranscrire");
const transcrireSeulement = drapeau("--transcrire-seulement");
const aide = drapeau("--aide") || drapeau("-h");

if (aide) {
  console.log(`Usage : node montage.js [video] [options]

  --scenes fichier.json     animations (défaut : scenes.json)
  --config fichier.json     réglages (défaut : config.json)
  --fond blanc|noir         remplace le fond de config.json pour ce rendu
  --format vertical|horizontal  vertical = 1080x1920 (défaut) ; horizontal = 1920x1080, tête dans un rectangle
  --sortie nom.mp4          nom du fichier dans sortie/ (défaut : video.mp4)
  --langue fr               langue parlée
  --vocabulaire "Reels, Instagram"   mots que la transcription doit bien reconnaître
  --transcrire-seulement    s'arrête après la transcription : corrige le fichier, puis relance
  --retranscrire            refait la transcription (écrase tes corrections)
  --epaules 150             largeur d'épaules créée de chaque côté, en pixels (0 = aucune)
  --refaire                 recalcule tout`);
  process.exit(0);
}

// ---------- outils ----------
const etape = (n, txt) => console.log(`\n[${n}/4] ${txt}`);
const echec = (msg) => {
  console.error(`\nProblème : ${msg}`);
  process.exit(1);
};
const lancer = (cmd, argv, options = {}) => {
  const r = spawnSync(cmd, argv, { stdio: "inherit", ...options });
  if (r.error) echec(`impossible de lancer « ${cmd} » (${r.error.message}). Lance d'abord : node installer.js`);
  if (r.status !== 0) echec(`la commande « ${path.basename(cmd)} » a échoué (code ${r.status}).`);
};
const sonde = (f, champs) =>
  (spawnSync("ffprobe", ["-v", "error", "-show_entries", champs, "-of", "csv=p=0", f], { encoding: "utf8" }).stdout || "").trim();

if (!fs.existsSync(PYTHON)) echec("l'environnement Python n'existe pas. Lance d'abord : node installer.js");

// ---------- la vidéo ----------
let video = args[0];
if (!video) {
  const dossier = path.join(RACINE, "entree");
  const trouve = fs.existsSync(dossier) ? fs.readdirSync(dossier).filter((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)).sort()[0] : null;
  if (!trouve) echec("aucune vidéo dans le dossier entree/.");
  video = path.join(dossier, trouve);
} else if (!fs.existsSync(video)) {
  video = path.join(RACINE, "entree", video);
}
if (!fs.existsSync(video)) echec(`vidéo introuvable : ${args[0]}`);
video = path.resolve(video);

const photo = path.join(RACINE, "fonds", "cadre.jpg");
if (!fs.existsSync(photo)) echec("il manque la photo du cadre : fonds/cadre.jpg");
for (const f of [fichierScenes, fichierConfig]) if (!fs.existsSync(f)) echec(`fichier introuvable : ${f}`);

const nom = path.basename(video, path.extname(video));
const tmp = path.join(RACINE, "sortie", ".tmp", nom);
fs.mkdirSync(tmp, { recursive: true });
const pub = path.join(ANIM, "public");
fs.mkdirSync(pub, { recursive: true });
const sortie = path.join(RACINE, "sortie", nomSortie);
const motsFichier = path.join(RACINE, "entree", `${nom}.mots.json`);
const t0 = Date.now();
const frais = (f) => !refaire && fs.existsSync(f) && fs.statSync(f).mtimeMs > fs.statSync(video).mtimeMs;

console.log(`Vidéo  : ${video}\nSortie : ${sortie}`);

// ---------- transcription (fonction : utilisable avant la découpe avec --transcrire-seulement) ----------
function transcrire(numero) {
  etape(numero, "Transcription de la voix (Whisper en local)");
  if (fs.existsSync(motsFichier) && !retranscrire && !refaire) {
    console.log(`  (je garde ta transcription : ${path.relative(RACINE, motsFichier)})`);
  } else {
    // Si tu as le texte exact de la vidéo dans entree/<nom>.script.txt, il corrige les mots mal reconnus.
    const scriptTexte = path.join(RACINE, "entree", `${nom}.script.txt`);
    lancer(PYTHON, [path.join(RACINE, "outils", "transcrire.py"), video, motsFichier, "--langue", langue,
      ...(vocabulaire ? ["--vocabulaire", vocabulaire] : []), ...(fs.existsSync(scriptTexte) ? ["--script", scriptTexte] : [])]);
  }
}
if (transcrireSeulement) {
  transcrire(1);
  console.log(`\nTranscription prête : ${motsFichier}\nCorrige les mots (champ « text », garde l'espace devant chaque mot), puis relance : node montage.js`);
  process.exit(0);
}

// ---------- 1) découpe ----------
const masque = path.join(tmp, "masque.mkv");
etape(1, "Découpe de la silhouette (RVM sur processeur : environ 5 min par minute de vidéo)");
if (frais(masque)) console.log("  (déjà faite, je la réutilise)");
else lancer(PYTHON, [path.join(RACINE, "outils", "matting.py"), video, masque, "--moteur", "rvm", "--ratio", qualite]);

// ---------- 2) silhouette transparente ----------
const personne = path.join(tmp, format === "horizontal" ? "personne-h.webm" : "personne.webm");
const mesuresF = path.join(tmp, format === "horizontal" ? "mesures-h.json" : "mesures.json");
etape(2, "Silhouette transparente (contour nettoyé, sans liseré)");
if (frais(personne) && fs.existsSync(mesuresF)) console.log("  (déjà faite, je la réutilise)");
else {
  const cfg = JSON.parse(fs.readFileSync(fichierConfig, "utf8"));
  const defautEp = format === "horizontal" ? (cfg.horizontal && cfg.horizontal.epaulesPx) : (cfg.tete && cfg.tete.epaulesPx);
  const ext = epaulesOpt !== "" ? epaulesOpt : String(defautEp !== undefined ? defautEp : 150);
  lancer(PYTHON, [path.join(RACINE, "outils", "personne_alpha.py"), video, masque, personne, mesuresF, "--epaules", ext]);
}

// ---------- 3) transcription ----------
transcrire(3);

// ---------- 4) animations + export ----------
etape(4, "Animations Remotion et export MP4 1080x1920, 30 images/s, son d'origine");
fs.copyFileSync(personne, path.join(pub, "personne.webm"));
fs.copyFileSync(photo, path.join(pub, "cadre.jpg"));
// Le son d'origine, remis à un volume normal pour les réseaux (-14 LUFS) : les vidéos de téléphone sont souvent trop faibles.
// Pour garder exactement le volume d'origine : "son": { "normaliser": false } dans config.json.
const normaliser = (JSON.parse(fs.readFileSync(fichierConfig, "utf8")).son || {}).normaliser !== false;
lancer("ffmpeg", ["-v", "error", "-y", "-i", video, "-vn", ...(normaliser ? ["-af", "loudnorm=I=-14:TP=-1.5:LRA=11"] : []),
  "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", path.join(pub, "audio.m4a")]);

const config = JSON.parse(fs.readFileSync(fichierConfig, "utf8"));
const fichierScenesJson = JSON.parse(fs.readFileSync(fichierScenes, "utf8"));
// Le titre du haut propre à cette vidéo (clé « titreFixe » du fichier de scènes) remplace celui de config.json.
if (fichierScenesJson.titreFixe) config.titre_fixe = { ...(config.titre_fixe || { actif: true, y: 150, hauteur: 200 }), ...fichierScenesJson.titreFixe };
if (fondOpt) config.fond = fondOpt;
const props = {
  config,
  scenes: JSON.parse(fs.readFileSync(fichierScenes, "utf8")).scenes,
  grosPlans: format === "horizontal" ? [] : fichierScenesJson.grosPlans || [],
  cta: format === "horizontal" ? (fichierScenesJson.horizontal && fichierScenesJson.horizontal.cta) || null : null,
  mots: JSON.parse(fs.readFileSync(motsFichier, "utf8")),
  dureeSecondes: parseFloat(sonde(video, "format=duration")) || 10,
  personne: "personne.webm",
  audio: "audio.m4a",
  cadrePhoto: "cadre.jpg",
  mesures: JSON.parse(fs.readFileSync(mesuresF, "utf8")),
};
const fichierProps = path.join(tmp, "props.json");
fs.writeFileSync(fichierProps, JSON.stringify(props));

const rendu = ["remotion", "render", "src/index.ts", format === "horizontal" ? "MontageH" : "Montage", sortie, `--props=${fichierProps}`, "--crf=18",
  "--concurrency=" + Math.max(1, Math.min(8, os.cpus().length))];
// Chrome : celui du système si on l'indique (CHROME_PATH), sinon Remotion télécharge le sien.
const chrome = process.env.CHROME_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : "");
if (chrome) rendu.push(`--browser-executable=${chrome}`, "--chrome-mode=chrome-for-testing");
if (process.env.REMOTION_GL || chrome) rendu.push(`--gl=${process.env.REMOTION_GL || "swangle"}`);
lancer(win ? "npx.cmd" : "npx", rendu, { cwd: ANIM, shell: win });

for (const f of ["personne.webm", "cadre.jpg", "audio.m4a"]) fs.rmSync(path.join(pub, f), { force: true });
console.log(`\nTerminé en ${((Date.now() - t0) / 60000).toFixed(1)} min.\nRésultat : ${sortie}`);
