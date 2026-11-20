// Génère les SVG du héros (Noé) à partir de pièces communes : même corps, même visage de base.
// Lancer : node personnages/heros/construire-heros.cjs
const { writeFileSync } = require('node:fs');
const dir = __dirname;

const C = { peau:'#f2c7a0', cheveux:'#2a3566', veste:'#1a6bff', vesteOmbre:'#1457d1', clair:'#6fa8ff',
  ambre:'#f5a623', ambreOmbre:'#d98a0f', pantalon:'#26304f', oeil:'#12193a', sac:'#0f2f7a' };

const glow = `
  <!-- lumière du téléphone -->
  <circle cx="208" cy="380" r="175" fill="${C.clair}" opacity=".07"/>
  <circle cx="208" cy="380" r="125" fill="${C.clair}" opacity=".10"/>
  <circle cx="208" cy="380" r="82" fill="${C.clair}" opacity=".16"/>`;
const jambes = `
  <!-- jambes et chaussures -->
  <rect x="138" y="430" width="54" height="150" rx="22" fill="${C.pantalon}"/>
  <rect x="208" y="430" width="54" height="150" rx="22" fill="${C.pantalon}"/>
  <ellipse cx="160" cy="590" rx="38" ry="18" fill="#f4f6fb"/>
  <ellipse cx="240" cy="590" rx="38" ry="18" fill="#f4f6fb"/>`;
const brasGauche = `
  <!-- bras gauche (le long du corps) -->
  <rect x="84" y="292" width="46" height="150" rx="23" fill="${C.vesteOmbre}"/>
  <circle cx="107" cy="448" r="21" fill="${C.peau}"/>`;
const veste = `
  <!-- veste -->
  <rect x="116" y="266" width="168" height="190" rx="52" fill="${C.veste}"/>
  <rect x="196" y="300" width="8" height="156" rx="4" fill="${C.vesteOmbre}"/>`;
const cou = `
  <!-- cou -->
  <rect x="178" y="236" width="44" height="40" rx="14" fill="${C.peau}"/>`;
const echarpe = `
  <!-- écharpe ambre : détail signature -->
  <rect x="126" y="252" width="148" height="38" rx="19" fill="${C.ambre}"/>
  <rect x="226" y="270" width="36" height="92" rx="16" fill="${C.ambre}"/>
  <rect x="226" y="338" width="36" height="12" fill="${C.ambreOmbre}"/>`;
const brasDroitTel = `
  <!-- bras droit plié vers le téléphone -->
  <polyline points="268,312 292,396 236,408" fill="none" stroke="${C.vesteOmbre}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- téléphone -->
  <g transform="rotate(-8 208 380)">
    <rect x="168" y="322" width="84" height="130" rx="14" fill="#0b1330"/>
    <rect x="175" y="330" width="70" height="114" rx="9" fill="${C.clair}"/>
    <circle cx="210" cy="374" r="19" fill="#ffffff" opacity=".35"/>
    <path d="M210 394 C196 376 196 362 210 360 C224 362 224 376 210 394Z" fill="${C.ambre}"/>
    <circle cx="210" cy="371" r="5" fill="#fff"/>
    <rect x="195" y="418" width="30" height="6" rx="3" fill="#fff" opacity=".6"/>
  </g>
  <circle cx="240" cy="410" r="20" fill="${C.peau}"/>`;
const brasDroitLibre = `
  <!-- bras droit le long du corps -->
  <rect x="270" y="292" width="46" height="150" rx="23" fill="${C.vesteOmbre}"/>
  <circle cx="293" cy="448" r="21" fill="${C.peau}"/>`;
const sacDos = `
  <!-- sac de cours (derrière le corps) -->
  <rect x="96" y="262" width="208" height="196" rx="44" fill="${C.sac}"/>
  <rect x="150" y="410" width="100" height="44" rx="14" fill="#0b2461"/>`;
const sangles = `
  <!-- sangles du sac -->
  <rect x="142" y="282" width="20" height="150" rx="8" fill="${C.sac}"/>
  <rect x="238" y="282" width="20" height="150" rx="8" fill="${C.sac}"/>
  <rect x="140" y="400" width="24" height="12" rx="4" fill="${C.ambre}"/>
  <rect x="236" y="400" width="24" height="12" rx="4" fill="${C.ambre}"/>`;

const corpsAvecTel = glow + jambes + brasGauche + veste + cou + echarpe + brasDroitTel;
const corpsSansTel = sacDos + jambes + brasGauche + veste + sangles + cou + echarpe + brasDroitLibre;

const tete = (visage) => `
  <!-- oreilles -->
  <circle cx="113" cy="180" r="17" fill="${C.peau}"/>
  <circle cx="287" cy="180" r="17" fill="${C.peau}"/>
  <!-- tête -->
  <circle cx="200" cy="172" r="90" fill="${C.peau}"/>
  <!-- cheveux : frange simple + mèche -->
  <path d="M108 168 C100 84 160 62 206 66 C260 66 304 100 292 168 C276 134 246 118 222 120 C196 136 150 126 108 168Z" fill="${C.cheveux}"/>
  <path d="M196 70 C188 46 214 36 226 48 C214 50 210 58 214 68Z" fill="${C.cheveux}"/>
  ${visage}`;

const joues = `<circle cx="140" cy="212" r="13" fill="#ec9a86" opacity=".45"/><circle cx="260" cy="212" r="13" fill="#ec9a86" opacity=".45"/>`;
const oeil = (x,y,rx,ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.oeil}"/><circle cx="${x+3}" cy="${y-ry*0.35}" r="${Math.max(2.5,rx*0.28)}" fill="#fff"/>`;

const visages = {
  neutre: (dx=0, dy=0) => `${joues}
    ${oeil(162+dx,184+dy,9,12)}${oeil(238+dx,184+dy,9,12)}
    <path d="M146 158 Q162 150 178 156" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <path d="M222 156 Q238 150 254 158" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <path d="M184 226 Q200 238 216 226" fill="none" stroke="${C.oeil}" stroke-width="5" stroke-linecap="round"/>`,
  content: () => `${joues}
    ${oeil(162,184,9,12)}${oeil(238,184,9,12)}
    <path d="M146 156 Q162 148 178 154" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <path d="M222 154 Q238 148 254 156" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <path d="M178 222 Q200 250 222 222Z" fill="${C.oeil}"/>`,
  surpris: () => `${joues}
    <circle cx="162" cy="182" r="19" fill="#fff"/><circle cx="238" cy="182" r="19" fill="#fff"/>
    <circle cx="162" cy="184" r="9" fill="${C.oeil}"/><circle cx="238" cy="184" r="9" fill="${C.oeil}"/>
    <circle cx="165" cy="180" r="3" fill="#fff"/><circle cx="241" cy="180" r="3" fill="#fff"/>
    <path d="M146 148 Q164 130 182 144" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <path d="M218 142 Q238 126 258 146" fill="none" stroke="${C.cheveux}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="200" cy="230" rx="12" ry="16" fill="${C.oeil}"/>
    <ellipse cx="200" cy="237" rx="7" ry="6" fill="#e0606e"/>`,
  determine: (dx=0, dy=0) => `${joues}
    ${oeil(162+dx,186+dy,9,8)}${oeil(238+dx,186+dy,9,8)}
    <path d="M142 160 L182 172" fill="none" stroke="${C.cheveux}" stroke-width="8" stroke-linecap="round"/>
    <path d="M258 160 L218 172" fill="none" stroke="${C.cheveux}" stroke-width="8" stroke-linecap="round"/>
    <path d="M182 228 Q204 232 222 220" fill="none" stroke="${C.oeil}" stroke-width="5" stroke-linecap="round"/>`
};

const ecrire = (nom, corps, visage) => {
  writeFileSync(`${dir}/heros-${nom}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" width="400" height="640">
  <title>Heros - ${nom}</title>${corps}${tete(visage)}
</svg>
`);
};

// Version avec téléphone (originale)
ecrire('neutre', corpsAvecTel, visages.neutre());
ecrire('surpris', corpsAvecTel, visages.surpris());
ecrire('determine', corpsAvecTel, visages.determine());
// Variantes de regard (avec téléphone)
ecrire('neutre-regard-bas', corpsAvecTel, visages.neutre(0, 6));
ecrire('determine-regard-droite', corpsAvecTel, visages.determine(7, 0));
// Version sans téléphone, avec le sac de cours (scènes de jour)
ecrire('neutre-sans-telephone', corpsSansTel, visages.neutre());
ecrire('content-sans-telephone', corpsSansTel, visages.content());
ecrire('surpris-sans-telephone', corpsSansTel, visages.surpris());
ecrire('determine-sans-telephone', corpsSansTel, visages.determine());
console.log('SVG heros generes');
