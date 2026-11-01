#!/usr/bin/env node
/* Installation en une commande : node installer.js
   Crée l'environnement Python dans .venv/, télécharge les modèles (RVM ~15 Mo, Whisper « small » ~480 Mo)
   et installe Remotion dans animations/. Rien n'est installé en dehors de ce dossier. */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const R = __dirname;
const win = os.platform() === "win32";
const PY = path.join(R, ".venv", win ? "Scripts/python.exe" : "bin/python");
const dire = (t) => console.log(`\n== ${t}`);
const lancer = (cmd, args, o = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: win && /^npm|^npx/.test(cmd), ...o });
  if (r.status !== 0) {
    console.error(`\nProblème : « ${cmd} ${args.slice(0, 3).join(" ")} » a échoué. Relis le message ci-dessus, puis relance node installer.js.`);
    process.exit(1);
  }
};
const existe = (cmd, arg = "--version") => spawnSync(cmd, [arg], { stdio: "ignore", shell: win }).status === 0;

dire("1/5 Vérification des outils");
for (const [nom, cmd, aide] of [
  ["Node.js", "node", "https://nodejs.org (version officielle LTS)"],
  ["ffmpeg", "ffmpeg", "https://ffmpeg.org/download.html"],
  ["Python 3", win ? "python" : "python3", "https://www.python.org/downloads/"],
]) {
  if (!existe(cmd, cmd === "ffmpeg" ? "-version" : "--version")) {
    console.error(`Il manque ${nom}. Installe-le depuis ${aide}, puis relance.`);
    process.exit(1);
  }
  console.log(`  ${nom} : ok`);
}

dire("2/5 Environnement Python (dans .venv/)");
if (!fs.existsSync(PY)) lancer(win ? "python" : "python3", ["-m", "venv", path.join(R, ".venv")]);
lancer(PY, ["-m", "pip", "install", "--upgrade", "pip"]);
lancer(PY, ["-m", "pip", "install", "-r", path.join(R, "requirements.txt")]);

dire("3/5 Modèle de découpe : Robust Video Matting (officiel, GitHub PeterL1n, ~15 Mo)");
fs.mkdirSync(path.join(R, "modeles"), { recursive: true });
const rvm = path.join(R, "modeles", "rvm_mobilenetv3_fp32.onnx");
const telecharger = async () => {
  if (fs.existsSync(rvm) && fs.statSync(rvm).size > 10e6) return console.log("  déjà présent");
  const rep = await fetch("https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx");
  if (!rep.ok) throw new Error(`téléchargement refusé (${rep.status})`);
  fs.writeFileSync(rvm, Buffer.from(await rep.arrayBuffer()));
  console.log("  téléchargé");
};

dire("4/5 Modèle de transcription : Whisper « small » (faster-whisper, SYSTRAN sur Hugging Face, ~480 Mo)");
const whisper = () => {
  const dossier = path.join(R, "modeles", "whisper-small");
  if (fs.existsSync(path.join(dossier, "model.bin"))) return console.log("  déjà présent");
  lancer(PY, ["-c", `from huggingface_hub import snapshot_download as s; s('Systran/faster-whisper-small', local_dir=r'${dossier}')`]);
};

dire("5/5 Remotion (animations), dans animations/");
const anim = () => lancer(win ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], { cwd: path.join(R, "animations") });

telecharger()
  .then(() => {
    whisper();
    anim();
    for (const d of ["entree", "sortie", "fonds"]) fs.mkdirSync(path.join(R, d), { recursive: true });
    console.log("\nTout est prêt. Mets ta vidéo dans entree/ et ta photo de cadre dans fonds/cadre.jpg, puis lance : node montage.js");
  })
  .catch((e) => {
    console.error(`\nProblème : ${e.message}. Vérifie ta connexion internet, puis relance node installer.js.`);
    process.exit(1);
  });
