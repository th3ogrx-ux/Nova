// Génère les 3 photos de profil (SVG sources) puis lance l'export PNG via outils/export-pdp.cjs
const fs = require('fs');
const out = 'export/photo-de-profil/sources';
const A = { bleu:'#1a6bff', clair:'#6fa8ff', ambre:'#f5a623', nuit:'#040b1c' };
const brume = `
  <ellipse cx="250" cy="880" rx="330" ry="110" fill="#7c859b" opacity=".85"/>
  <ellipse cx="780" cy="900" rx="360" ry="120" fill="#7c859b" opacity=".85"/>
  <ellipse cx="520" cy="930" rx="420" ry="120" fill="#aab2c4"/>
  <ellipse cx="170" cy="990" rx="260" ry="90" fill="#aab2c4"/>
  <ellipse cx="880" cy="1000" rx="260" ry="90" fill="#aab2c4"/>`;
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${c}</svg>\n`;

// A : épingle de carte lumineuse dans la nuit, brume en bas
fs.writeFileSync(`${out}/pdp-A-epingle.svg`, svg(`
  <rect width="1024" height="1024" fill="${A.nuit}"/>
  <circle cx="512" cy="440" r="430" fill="${A.bleu}" opacity=".16"/>
  <circle cx="512" cy="440" r="330" fill="${A.bleu}" opacity=".22"/>
  <circle cx="512" cy="440" r="250" fill="${A.ambre}" opacity=".18"/>
  <path d="M512 740 C396 600 346 530 346 440 A166 166 0 1 1 678 440 C678 530 628 600 512 740Z" fill="${A.ambre}"/>
  <circle cx="512" cy="440" r="64" fill="#fff3d6"/>
  ${brume}`));

// B : visage du héros (mêmes pièces que personnages/heros) sur fond bleu
const h = fs.readFileSync('personnages/heros/heros-determine.svg', 'utf8');
const veste = h.slice(h.indexOf('<!-- veste -->'), h.indexOf('<!-- bras droit'));
const tete = h.slice(h.indexOf('<!-- oreilles -->'), h.indexOf('</svg>'));
fs.writeFileSync(`${out}/pdp-B-heros.svg`, svg(`
  <rect width="1024" height="1024" fill="${A.bleu}"/>
  <circle cx="512" cy="470" r="400" fill="${A.clair}" opacity=".35"/>
  <circle cx="512" cy="470" r="290" fill="${A.clair}" opacity=".35"/>
  <g transform="translate(-8 70) scale(2.6)">${veste.replace('fill="#1a6bff"','fill="#0f4ec4"')}${tete}</g>`));

// C : un commerce qui brille (auvent rayé, vitrine ambre), brume en bas
fs.writeFileSync(`${out}/pdp-C-commerce.svg`, svg(`
  <rect width="1024" height="1024" fill="#0a1d4a"/>
  <circle cx="512" cy="450" r="420" fill="${A.bleu}" opacity=".22"/>
  <circle cx="512" cy="450" r="300" fill="${A.ambre}" opacity=".16"/>
  <rect x="312" y="400" width="400" height="320" rx="14" fill="#040b1c"/>
  <rect x="352" y="470" width="190" height="200" rx="10" fill="${A.ambre}"/>
  <rect x="572" y="470" width="100" height="250" rx="10" fill="#fff3d6"/>
  <path d="M292 400 L332 290 H692 L732 400Z" fill="${A.ambre}"/>
  <path d="M372 290 H452 L432 400 H332Z M532 290 H612 L632 400 H512Z" fill="#fff3d6"/>
  <path d="M292 400 H732 V420 H292Z" fill="#d98a0f"/>
  ${brume}`));
console.log('sources PDP ok');
