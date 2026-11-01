#!/usr/bin/env node
/* Studio de montage : une seule commande.

   node montage.js ma-video.mp4                      (écran divisé : tableau en haut, vous en carte en bas)
   node montage.js ma-video.mp4 --bas silhouette --fond blanc|flou|paysage.jpg   (vous découpé, en bas)

   Étapes (mode par défaut) : 1) préparation de la vidéo  2) transcription de la voix
                              3) animations + sous-titres + export MP4 1080x1920, 30 images/s */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RACINE = __dirname;
const ANIM = path.join(RACINE, "animations");
const win = os.platform() === "win32";
const PYTHON = path.join(RACINE, ".venv", win ? "Scripts/python.exe" : "bin/python");

// ---------- lecture des options ----------
const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const i = args.indexOf(nom);
  if (i === -1) return defaut;
  return args.splice(i, 2)[1];
};
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const bas = opt("--bas", "carte"); // carte | silhouette
const derriere = opt("--derriere", "genere"); // (carte) genere | flou | original | image dans fonds/
const fondArg = opt("--fond", "blanc"); // (silhouette) blanc | flou | image
const textesArg = opt("--textes", path.join(ANIM, "textes.json"));
const langue = opt("--langue", "fr");
const qualite = opt("--qualite", "0.5");
const cadrage = parseFloat(opt("--cadrage", "0.50")); // (carte) 0 = haut de l'image, 1 = bas
const vocabulaire = opt("--vocabulaire", "");
const refaire = drapeau("--refaire");
const sansSousTitres = drapeau("--sans-sous-titres");
const aide = drapeau("--aide") || drapeau("-h");
const videoArg = args[0];

if (aide || !videoArg) {
  console.log(`Usage : node montage.js <video> [options]

  --textes fichier.json     animations à afficher (défaut : animations/textes.json)
  --bas carte|silhouette    carte = vous en carte arrondie (défaut) ; silhouette = vous découpé
  --fond blanc|flou|image   (silhouette seulement) l'image est cherchée dans fonds/
  --derriere genere         (carte) décor derrière vous : genere (créé pour vous), flou, original, ou une image de fonds/
  --cadrage 0.50            (carte) quelle partie de l'image reste visible : 0 haut … 1 bas
  --langue fr               langue parlée
  --vocabulaire "Reels, Instagram"   mots que la transcription doit bien reconnaître
  --sans-sous-titres        pas de sous-titres
  --refaire                 recalcule tout (sinon, les étapes lentes déjà faites sont réutilisées)

Exemples :
  node montage.js ma-video.mp4
  node montage.js ma-video.mp4 --bas silhouette --fond flou`);
  process.exit(aide ? 0 : 1);
}
if (!["carte", "silhouette"].includes(bas)) {
  console.error("--bas doit valoir « carte » ou « silhouette ».");
  process.exit(1);
}

// ---------- petits outils ----------
const decoupe = bas === "silhouette" || derriere !== "original";
const total = decoupe ? 4 : 3;
const etape = (n, txt) => console.log(`\n[${n}/${total}] ${txt}`);
const echec = (msg) => {
  console.error(`\nProblème : ${msg}`);
  process.exit(1);
};
const lancer = (cmd, argv, options = {}) => {
  const r = spawnSync(cmd, argv, { stdio: "inherit", ...options });
  if (r.error) echec(`impossible de lancer « ${cmd} » (${r.error.message}). Lance d'abord : node installer.js`);
  if (r.status !== 0) echec(`la commande « ${path.basename(cmd)} » a échoué (code ${r.status}).`);
};
const trouver = (nom, dossiers) => {
  if (fs.existsSync(nom)) return path.resolve(nom);
  for (const d of dossiers) {
    const p = path.join(RACINE, d, nom);
    if (fs.existsSync(p)) return p;
  }
  return null;
};
const sonde = (fichier, champs) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", champs, "-of", "csv=p=0:s=x", fichier], { encoding: "utf8" });
  return (r.stdout || "").trim();
};

if (!fs.existsSync(PYTHON)) echec("l'environnement Python n'existe pas. Lance d'abord : node installer.js");

const video = trouver(videoArg, ["entree"]);
if (!video) echec(`vidéo introuvable : ${videoArg} (mets-la dans le dossier entree/).`);

let fond = fondArg;
if (bas === "silhouette" && !["blanc", "flou"].includes(fondArg)) {
  fond = trouver(fondArg, ["fonds"]);
  if (!fond) echec(`image de fond introuvable : ${fondArg} (mets-la dans le dossier fonds/).`);
}
const typeFond = ["blanc", "flou"].includes(fondArg) ? fondArg : "paysage";
const fichierTextes = trouver(textesArg, ["animations"]);
if (!fichierTextes) echec(`fichier de textes introuvable : ${textesArg}`);

const nom = path.basename(video, path.extname(video));
const tmp = path.join(RACINE, "sortie", ".tmp", nom);
fs.mkdirSync(tmp, { recursive: true });
const etiquette = bas === "carte" ? "carte" : typeFond;
const sortie = path.join(RACINE, "sortie", `${nom}-${etiquette}.mp4`);
const t0 = Date.now();
const frais = (f) => !refaire && fs.existsSync(f) && fs.statSync(f).mtimeMs > fs.statSync(video).mtimeMs;
const pub = path.join(ANIM, "public");
fs.mkdirSync(pub, { recursive: true });

console.log(`Vidéo   : ${video}\nMode    : ${bas === "carte" ? "écran divisé (carte)" : "silhouette, fond " + typeFond}\nTextes  : ${fichierTextes}\nSortie  : ${sortie}`);

const props = { mode: bas, fond: typeFond, base: null, camera: null, ratio: 16 / 9, cadrage, dureeSecondes: 10 };
let n = 0;

if (bas === "carte") {
  let source = video;
  if (derriere !== "original") {
    // ---------- 1+2) découpe, puis nouveau décor derrière vous (taille d'origine) ----------
    const masque = path.join(tmp, "masque.mkv");
    etape(++n, "Découpe de la silhouette (RVM, sur processeur : ~5 min par minute de vidéo)");
    if (frais(masque)) console.log("  (découpe déjà faite, je la réutilise)");
    else lancer(PYTHON, [path.join(RACINE, "outils", "matting.py"), video, masque, "--moteur", "rvm", "--ratio", qualite]);
    etape(++n, `Nouveau décor derrière vous (${derriere})`);
    let fondChoisi = derriere;
    if (!["genere", "flou"].includes(derriere)) {
      fondChoisi = trouver(derriere, ["fonds"]);
      if (!fondChoisi) echec(`image de fond introuvable : ${derriere} (mets-la dans le dossier fonds/).`);
    }
    source = path.join(tmp, "decor.mp4");
    lancer(PYTHON, [path.join(RACINE, "outils", "remplacer_fond.py"), video, masque, source, "--fond", fondChoisi]);
  }
  // ---------- préparation : H.264 propre, orientation corrigée ----------
  etape(++n, "Préparation de la vidéo (H.264, orientation corrigée)");
  const cam = path.join(tmp, "camera.mp4");
  lancer("ffmpeg", ["-v", "error", "-y", "-i", source, "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
    "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", cam]);
  fs.copyFileSync(cam, path.join(pub, "camera.mp4"));
  const [w, h] = sonde(cam, "stream=width,height").split("\n")[0].split("x").map(Number);
  props.camera = "camera.mp4";
  props.ratio = h / w;
  props.dureeSecondes = parseFloat(sonde(cam, "format=duration")) || 10;
} else {
  // ---------- 1) découpe ----------
  const masque = path.join(tmp, "masque.mkv");
  etape(++n, "Découpe de la silhouette (RVM, sur processeur : ~5 min par minute de vidéo)");
  if (frais(masque)) console.log("  (découpe déjà faite, je la réutilise)");
  else lancer(PYTHON, [path.join(RACINE, "outils", "matting.py"), video, masque, "--moteur", "rvm", "--ratio", qualite]);
  // ---------- 2) fond + placement ----------
  const base = path.join(tmp, "base.mp4");
  etape(++n, "Remplacement du fond et placement dans la moitié basse");
  lancer(PYTHON, [path.join(RACINE, "outils", "composer.py"), video, masque, base, "--fond", fond]);
  fs.copyFileSync(base, path.join(pub, "base.mp4"));
  props.base = "base.mp4";
  props.dureeSecondes = parseFloat(sonde(base, "format=duration")) || 10;
}

// ---------- transcription ----------
const motsFichier = path.join(tmp, "mots.json");
etape(++n, "Transcription de la voix (sous-titres mot par mot)");
if (sansSousTitres) fs.writeFileSync(motsFichier, "[]");
else if (frais(motsFichier) && !vocabulaire) console.log("  (transcription déjà faite, je la réutilise)");
else lancer(PYTHON, [path.join(RACINE, "outils", "transcrire.py"), video, motsFichier, "--langue", langue,
  ...(vocabulaire ? ["--vocabulaire", vocabulaire] : [])]);

// ---------- animations + export ----------
etape(++n, "Animations Remotion et export MP4 1080x1920, 30 images/s");
props.textes = JSON.parse(fs.readFileSync(fichierTextes, "utf8"));
props.mots = JSON.parse(fs.readFileSync(motsFichier, "utf8"));
if (sansSousTitres) props.textes.sousTitres = { actif: false };
const fichierProps = path.join(tmp, "props.json");
fs.writeFileSync(fichierProps, JSON.stringify(props));

const rendu = ["remotion", "render", "src/index.ts", "Montage", sortie, `--props=${fichierProps}`, "--crf=18",
  "--concurrency=" + Math.max(1, Math.min(8, os.cpus().length))];
// Chrome : celui du système si on l'indique (CHROME_PATH), sinon Remotion télécharge le sien.
const chrome = process.env.CHROME_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : "");
if (chrome) rendu.push(`--browser-executable=${chrome}`, "--chrome-mode=chrome-for-testing");
if (process.env.REMOTION_GL || chrome) rendu.push(`--gl=${process.env.REMOTION_GL || "swangle"}`);
lancer(win ? "npx.cmd" : "npx", rendu, { cwd: ANIM, shell: win });

for (const f of ["camera.mp4", "base.mp4"]) fs.rmSync(path.join(pub, f), { force: true });
console.log(`\nTerminé en ${((Date.now() - t0) / 60000).toFixed(1)} min.\nRésultat : ${sortie}`);
