// Génère le passant et la boulangère (même style plat que le héros : tête ronde, formes simples).
// Lancer : node personnages/construire-personnages.cjs
const { writeFileSync } = require('node:fs');
const dir = __dirname;
const svg = (titre, c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 640" width="400" height="640">
  <title>${titre}</title>${c}
</svg>
`;

// ---------- Le passant âgé : casquette brune, lunettes rondes, moustache, long manteau camel, canne ----------
const P = { peau:'#ecc7a6', cheveux:'#c9d0e0', manteau:'#b98b4e', manteauOmbre:'#9a7038', pantalon:'#3a3f55', casquette:'#6b4f3a', oeil:'#12193a' };
const passantCorps = `
  <rect x="142" y="480" width="52" height="110" rx="22" fill="${P.pantalon}"/>
  <rect x="208" y="480" width="52" height="110" rx="22" fill="${P.pantalon}"/>
  <ellipse cx="164" cy="592" rx="38" ry="17" fill="#1c2236"/>
  <ellipse cx="238" cy="592" rx="38" ry="17" fill="#1c2236"/>
  <rect x="84" y="292" width="46" height="170" rx="23" fill="${P.manteauOmbre}"/>
  <circle cx="107" cy="468" r="20" fill="${P.peau}"/>
  <rect x="112" y="266" width="176" height="270" rx="48" fill="${P.manteau}"/>
  <rect x="196" y="300" width="8" height="236" rx="4" fill="${P.manteauOmbre}"/>
  <circle cx="214" cy="400" r="6" fill="${P.manteauOmbre}"/><circle cx="214" cy="450" r="6" fill="${P.manteauOmbre}"/>
  <path d="M150 262 L200 330 L170 268Z M250 262 L200 330 L230 268Z" fill="${P.manteauOmbre}"/>
  <rect x="178" y="236" width="44" height="40" rx="14" fill="${P.peau}"/>
  <!-- canne -->
  <rect x="296" y="452" width="10" height="152" rx="5" fill="#5a3b22"/>
  <path d="M282 452 Q300 424 318 452" fill="none" stroke="#5a3b22" stroke-width="10" stroke-linecap="round"/>
  <rect x="270" y="296" width="46" height="150" rx="23" fill="${P.manteauOmbre}"/>
  <circle cx="297" cy="456" r="20" fill="${P.peau}"/>`;
const passantTete = (bouche, sourcils) => `
  <circle cx="115" cy="184" r="17" fill="${P.peau}"/><circle cx="285" cy="184" r="17" fill="${P.peau}"/>
  <circle cx="200" cy="176" r="88" fill="${P.peau}"/>
  <circle cx="118" cy="150" r="22" fill="${P.cheveux}"/><circle cx="282" cy="150" r="22" fill="${P.cheveux}"/>
  <!-- casquette -->
  <path d="M104 150 C100 80 150 62 202 62 C256 62 300 84 296 150 C260 128 150 128 104 150Z" fill="${P.casquette}"/>
  <path d="M104 150 C150 132 262 132 296 150 L310 160 C250 146 150 146 90 160Z" fill="#4e3a2b"/>
  <!-- lunettes rondes -->
  <circle cx="162" cy="186" r="26" fill="#fff" opacity=".35" stroke="${P.oeil}" stroke-width="6"/>
  <circle cx="238" cy="186" r="26" fill="#fff" opacity=".35" stroke="${P.oeil}" stroke-width="6"/>
  <path d="M188 184 Q200 176 212 184" fill="none" stroke="${P.oeil}" stroke-width="6"/>
  <circle cx="162" cy="188" r="7" fill="${P.oeil}"/><circle cx="238" cy="188" r="7" fill="${P.oeil}"/>
  ${sourcils}
  <!-- moustache et bouche -->
  <path d="M164 222 Q182 210 200 220 Q218 210 236 222 Q218 238 200 230 Q182 238 164 222Z" fill="${P.cheveux}"/>
  ${bouche}`;
const sourcilsCalmes = `<path d="M136 150 Q160 140 186 150" fill="none" stroke="#9aa3b8" stroke-width="9" stroke-linecap="round"/><path d="M214 150 Q240 140 264 150" fill="none" stroke="#9aa3b8" stroke-width="9" stroke-linecap="round"/>`;
const sourcilsHauts = `<path d="M136 146 Q160 132 186 146" fill="none" stroke="#9aa3b8" stroke-width="9" stroke-linecap="round"/><path d="M214 146 Q240 132 264 146" fill="none" stroke="#9aa3b8" stroke-width="9" stroke-linecap="round"/>`;
writeFileSync(`${dir}/passant/passant-neutre.svg`, svg('Passant - neutre', passantCorps + passantTete(`<path d="M186 246 Q200 250 214 246" fill="none" stroke="${P.oeil}" stroke-width="5" stroke-linecap="round"/>`, sourcilsCalmes)));
writeFileSync(`${dir}/passant/passant-parle.svg`, svg('Passant - parle', passantCorps + passantTete(`<ellipse cx="200" cy="248" rx="14" ry="9" fill="${P.oeil}"/>`, sourcilsHauts)));

// ---------- La boulangère : calot blanc, chignon, tablier blanc, sourire ----------
const B = { peau:'#f0c6a4', cheveux:'#7a4a2b', chemise:'#e0674f', chemiseOmbre:'#c9553f', tablier:'#f4f6fb', oeil:'#12193a' };
const croissant = `<g transform="translate(16 332) rotate(-24)">
    <path d="M-30 8 C-26 -20 26 -20 30 8 C20 -2 -20 -2 -30 8Z" fill="#d99a3a"/>
    <path d="M-12 -6 L-8 8 M0 -9 L0 6 M12 -6 L8 8" stroke="#a96d1f" stroke-width="4" stroke-linecap="round"/>
  </g>`;
const boulCorps = (tend) => `
  <rect x="148" y="480" width="50" height="110" rx="22" fill="#26304f"/>
  <rect x="206" y="480" width="50" height="110" rx="22" fill="#26304f"/>
  <ellipse cx="170" cy="592" rx="36" ry="16" fill="#1c2236"/><ellipse cx="236" cy="592" rx="36" ry="16" fill="#1c2236"/>
  <rect x="106" y="266" width="188" height="230" rx="52" fill="${B.chemise}"/>
  <rect x="140" y="300" width="120" height="196" rx="30" fill="${B.tablier}"/>
  <path d="M150 300 L172 262 M250 300 L228 262" stroke="${B.tablier}" stroke-width="14" stroke-linecap="round"/>
  <rect x="170" y="400" width="60" height="42" rx="10" fill="#e3e8f4"/>
  <rect x="178" y="236" width="44" height="40" rx="14" fill="${B.peau}"/>
  <rect x="270" y="292" width="46" height="150" rx="23" fill="${B.chemiseOmbre}"/>
  <circle cx="293" cy="448" r="21" fill="${B.peau}"/>
  ${tend
    ? `<polyline points="130,314 74,356 42,352" fill="none" stroke="${B.chemiseOmbre}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="30" cy="350" r="21" fill="${B.peau}"/>${croissant}`
    : `<rect x="84" y="292" width="46" height="150" rx="23" fill="${B.chemiseOmbre}"/><circle cx="107" cy="448" r="21" fill="${B.peau}"/>`}`;
const boulTete = `
  <circle cx="113" cy="180" r="17" fill="${B.peau}"/><circle cx="287" cy="180" r="17" fill="${B.peau}"/>
  <circle cx="200" cy="74" r="34" fill="${B.cheveux}"/>
  <circle cx="200" cy="172" r="90" fill="${B.peau}"/>
  <path d="M110 160 C106 90 156 78 202 78 C252 78 298 94 290 160 C272 130 232 124 200 126 C166 124 128 130 110 160Z" fill="${B.cheveux}"/>
  <path d="M116 120 C118 76 160 66 202 66 C246 66 286 78 286 120 C250 104 154 104 116 120Z" fill="${B.tablier}"/>
  <rect x="112" y="116" width="176" height="14" rx="7" fill="#dfe5f2"/>
  <circle cx="140" cy="212" r="14" fill="#ec9a86" opacity=".5"/><circle cx="260" cy="212" r="14" fill="#ec9a86" opacity=".5"/>
  <path d="M146 188 Q162 168 178 188" fill="none" stroke="${B.oeil}" stroke-width="7" stroke-linecap="round"/>
  <path d="M222 188 Q238 168 254 188" fill="none" stroke="${B.oeil}" stroke-width="7" stroke-linecap="round"/>
  <path d="M170 220 Q200 258 230 220Z" fill="${B.oeil}"/><path d="M184 236 Q200 246 216 236 Q200 232 184 236Z" fill="#e0606e"/>`;
writeFileSync(`${dir}/boulangere/boulangere-neutre.svg`, svg('Boulangere - neutre', boulCorps(false) + boulTete));
writeFileSync(`${dir}/boulangere/boulangere-tend-croissant.svg`, svg('Boulangere - tend un croissant', boulCorps(true) + boulTete));

// ---------- Le Gris : grande silhouette grise, capuche, yeux pâles, manteau qui se fond dans la brume ----------
const G = { manteau:'#4a526a', ombre:'#353c52', visage:'#8b93a7', capuche:'#5d667c', oeil:'#e8eefc', brume:'#aab2c4' };
const grisCorps = `
  <ellipse cx="120" cy="612" rx="110" ry="30" fill="${G.brume}" opacity=".55"/><ellipse cx="290" cy="620" rx="120" ry="26" fill="${G.brume}" opacity=".55"/>
  <path d="M138 236 L262 236 C300 300 330 470 350 618 C300 640 260 600 220 628 C180 596 130 640 50 618 C70 470 100 300 138 236Z" fill="${G.manteau}"/>
  <path d="M200 250 L212 620 L196 626Z" fill="${G.ombre}"/>
  <path d="M138 240 C96 330 78 470 66 560 L112 570 C124 470 140 350 168 262Z" fill="${G.ombre}"/>
  <path d="M262 240 C304 330 322 470 334 560 L288 570 C276 470 260 350 232 262Z" fill="${G.ombre}"/>
  <rect x="52" y="540" width="40" height="80" rx="20" fill="${G.visage}"/><rect x="308" y="540" width="40" height="80" rx="20" fill="${G.visage}"/>`;
const grisTete = (bouche) => `
  <path d="M110 190 C104 96 160 70 200 70 C240 70 296 96 290 190 C292 220 270 250 250 256 L150 256 C130 250 108 220 110 190Z" fill="${G.capuche}"/>
  <circle cx="200" cy="178" r="72" fill="${G.visage}"/>
  <ellipse cx="170" cy="172" rx="17" ry="10" fill="${G.oeil}" transform="rotate(10 170 172)"/><ellipse cx="230" cy="172" rx="17" ry="10" fill="${G.oeil}" transform="rotate(-10 230 172)"/>
  <circle cx="170" cy="172" r="4" fill="#12193a"/><circle cx="230" cy="172" r="4" fill="#12193a"/>
  ${bouche}`;
writeFileSync(`${dir}/gris/gris-neutre.svg`, svg('Le Gris - neutre', grisCorps + grisTete(`<path d="M178 218 Q200 212 222 218" fill="none" stroke="#12193a" stroke-width="5" stroke-linecap="round"/>`)));
writeFileSync(`${dir}/gris/gris-parle.svg`, svg('Le Gris - parle', grisCorps + grisTete(`<ellipse cx="200" cy="220" rx="14" ry="6" fill="#12193a"/>`)));

// ---------- Le boucher : tête ronde, grosse moustache, tablier rayé rouge et blanc ----------
const Bo = { peau:'#eeb08e', cheveux:'#5a3b22', rouge:'#d9473f', blanc:'#f4f6fb', oeil:'#12193a' };
let rayures = '';
for (let i = 0; i < 6; i++) rayures += `<rect x="${140 + i*20}" y="296" width="10" height="200" fill="${Bo.rouge}"/>`;
const boucherCorps = `
  <rect x="148" y="480" width="50" height="110" rx="22" fill="#26304f"/><rect x="206" y="480" width="50" height="110" rx="22" fill="#26304f"/>
  <ellipse cx="170" cy="592" rx="36" ry="16" fill="#1c2236"/><ellipse cx="236" cy="592" rx="36" ry="16" fill="#1c2236"/>
  <rect x="84" y="292" width="46" height="150" rx="23" fill="${Bo.blanc}"/><circle cx="107" cy="448" r="21" fill="${Bo.peau}"/>
  <rect x="270" y="292" width="46" height="150" rx="23" fill="${Bo.blanc}"/><circle cx="293" cy="448" r="21" fill="${Bo.peau}"/>
  <rect x="106" y="266" width="188" height="230" rx="52" fill="${Bo.blanc}"/>
  <rect x="136" y="296" width="128" height="200" rx="28" fill="${Bo.blanc}"/>${rayures}
  <rect x="136" y="296" width="128" height="200" rx="28" fill="none" stroke="${Bo.rouge}" stroke-width="6"/>
  <rect x="178" y="236" width="44" height="40" rx="14" fill="${Bo.peau}"/>`;
const boucherTete = (visage) => `
  <circle cx="112" cy="184" r="17" fill="${Bo.peau}"/><circle cx="288" cy="184" r="17" fill="${Bo.peau}"/>
  <circle cx="200" cy="176" r="88" fill="${Bo.peau}"/>
  <path d="M130 120 C150 92 250 92 270 120 C240 108 160 108 130 120Z" fill="${Bo.cheveux}"/>
  <circle cx="134" cy="150" r="16" fill="${Bo.cheveux}"/><circle cx="266" cy="150" r="16" fill="${Bo.cheveux}"/>
  <circle cx="140" cy="210" r="15" fill="#e0606e" opacity=".5"/><circle cx="260" cy="210" r="15" fill="#e0606e" opacity=".5"/>
  ${visage}
  <path d="M150 220 Q176 200 200 216 Q224 200 250 220 Q226 244 200 232 Q174 244 150 220Z" fill="${Bo.cheveux}"/>`;
const bVis = {
  inquiet: `<ellipse cx="164" cy="178" rx="9" ry="11" fill="${Bo.oeil}"/><ellipse cx="236" cy="178" rx="9" ry="11" fill="${Bo.oeil}"/>
    <path d="M142 156 L184 144" fill="none" stroke="${Bo.cheveux}" stroke-width="8" stroke-linecap="round"/><path d="M258 156 L216 144" fill="none" stroke="${Bo.cheveux}" stroke-width="8" stroke-linecap="round"/>
    <path d="M184 252 Q200 244 216 252" fill="none" stroke="${Bo.oeil}" stroke-width="5" stroke-linecap="round"/>`,
  content: `<path d="M146 180 Q164 160 182 180" fill="none" stroke="${Bo.oeil}" stroke-width="7" stroke-linecap="round"/><path d="M218 180 Q236 160 254 180" fill="none" stroke="${Bo.oeil}" stroke-width="7" stroke-linecap="round"/>
    <path d="M168 246 Q200 280 232 246Z" fill="${Bo.oeil}"/><path d="M182 262 Q200 270 218 262 Q200 258 182 262Z" fill="#e0606e"/>`
};
writeFileSync(`${dir}/boucher/boucher-inquiet.svg`, svg('Boucher - inquiet', boucherCorps + boucherTete(bVis.inquiet)));
writeFileSync(`${dir}/boucher/boucher-content.svg`, svg('Boucher - content', boucherCorps + boucherTete(bVis.content)));
console.log('personnages ok');
