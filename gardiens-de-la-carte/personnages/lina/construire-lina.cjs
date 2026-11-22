// Lina : Gardienne de 17 ans, même style que Noé (tête ronde, formes plates).
// Imperméable jaune moutarde, cheveux attachés (queue-de-cheval), téléphone à écran bleu.
// Lancer : node personnages/lina/construire-lina.cjs
const { writeFileSync } = require('node:fs');
const dir = __dirname;
const C = { peau:'#c98f66', cheveux:'#3b2220', imper:'#d0a11f', imperOmbre:'#a8800f', pantalon:'#2b3f4f', bottes:'#7a3326',
  clair:'#6fa8ff', ambre:'#f5a623', oeil:'#12193a', bleu:'#1a6bff' };

const glow = `
  <circle cx="208" cy="380" r="175" fill="${C.clair}" opacity=".07"/><circle cx="208" cy="380" r="125" fill="${C.clair}" opacity=".10"/><circle cx="208" cy="380" r="82" fill="${C.clair}" opacity=".16"/>`;
const jambes = `
  <rect x="138" y="440" width="54" height="130" rx="22" fill="${C.pantalon}"/><rect x="208" y="440" width="54" height="130" rx="22" fill="${C.pantalon}"/>
  <rect x="124" y="552" width="76" height="48" rx="18" fill="${C.bottes}"/><rect x="200" y="552" width="76" height="48" rx="18" fill="${C.bottes}"/>`;
const brasGauche = `<rect x="84" y="292" width="46" height="170" rx="23" fill="${C.imperOmbre}"/><circle cx="107" cy="468" r="21" fill="${C.peau}"/>`;
const imper = `
  <rect x="112" y="262" width="176" height="262" rx="46" fill="${C.imper}"/>
  <rect x="112" y="388" width="176" height="18" fill="${C.imperOmbre}"/><rect x="190" y="384" width="20" height="26" rx="5" fill="#e8c860"/>
  <rect x="196" y="300" width="8" height="224" rx="4" fill="${C.imperOmbre}"/>
  <circle cx="178" cy="340" r="7" fill="${C.imperOmbre}"/><circle cx="178" cy="450" r="7" fill="${C.imperOmbre}"/>
  <rect x="136" y="440" width="44" height="12" rx="6" fill="${C.imperOmbre}"/>
  <rect x="178" y="236" width="44" height="40" rx="14" fill="${C.peau}"/>
  <ellipse cx="200" cy="268" rx="78" ry="28" fill="${C.imperOmbre}"/>`;   // capuche rabattue autour du cou
const brasTel = `
  <polyline points="268,312 292,396 236,408" fill="none" stroke="${C.imperOmbre}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="rotate(-8 208 380)"><rect x="168" y="322" width="84" height="130" rx="14" fill="#0b1330"/><rect x="175" y="330" width="70" height="114" rx="9" fill="${C.clair}"/>
    <circle cx="210" cy="374" r="19" fill="#fff" opacity=".35"/><path d="M210 394 C196 376 196 362 210 360 C224 362 224 376 210 394Z" fill="${C.ambre}"/><circle cx="210" cy="371" r="5" fill="#fff"/><rect x="195" y="418" width="30" height="6" rx="3" fill="#fff" opacity=".6"/></g>
  <circle cx="240" cy="410" r="20" fill="${C.peau}"/>`;
const brasBouquet = `
  <polyline points="268,312 290,384 252,404" fill="none" stroke="${C.imperOmbre}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M222 352 L274 352 L250 430Z" fill="#f4f6fb"/><path d="M236 352 L250 430 L262 352Z" fill="#e3e8f4"/>
  <g stroke="#3f9b6a" stroke-width="6" stroke-linecap="round"><path d="M236 352 L226 318"/><path d="M250 352 L250 296"/><path d="M262 352 L274 322"/></g>
  <ellipse cx="216" cy="338" rx="16" ry="8" fill="#3f9b6a" transform="rotate(-30 216 338)"/><ellipse cx="284" cy="336" rx="16" ry="8" fill="#3f9b6a" transform="rotate(30 284 336)"/>
  <circle cx="224" cy="312" r="17" fill="#e0606e"/><circle cx="276" cy="316" r="16" fill="#f5d36b"/><circle cx="250" cy="288" r="19" fill="#f4f6fb"/><circle cx="250" cy="288" r="7" fill="#f5d36b"/><circle cx="224" cy="312" r="6" fill="#b8333f"/>
  <circle cx="250" cy="410" r="20" fill="${C.peau}"/>`;
const brasTend = `
  <polyline points="268,312 322,372 370,346" fill="none" stroke="${C.imperOmbre}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="400" cy="320" r="150" fill="${C.clair}" opacity=".08"/><circle cx="400" cy="320" r="100" fill="${C.clair}" opacity=".12"/>
  <g transform="rotate(-10 392 322)"><rect x="350" y="252" width="84" height="130" rx="14" fill="#0b1330"/><rect x="357" y="260" width="70" height="114" rx="9" fill="${C.clair}"/>
    <circle cx="392" cy="304" r="19" fill="#fff" opacity=".35"/><path d="M392 324 C378 306 378 292 392 290 C406 292 406 306 392 324Z" fill="${C.ambre}"/><circle cx="392" cy="301" r="5" fill="#fff"/></g>
  <circle cx="372" cy="348" r="20" fill="${C.peau}"/>`;

const tete = (visage) => `
  <!-- queue-de-cheval (derrière la tête) -->
  <path d="M268 104 C346 90 372 196 336 262 C326 290 300 280 308 248 C320 196 296 150 262 130Z" fill="${C.cheveux}"/>
  <circle cx="276" cy="112" r="12" fill="${C.bleu}"/>
  <circle cx="113" cy="180" r="17" fill="${C.peau}"/><circle cx="287" cy="180" r="17" fill="${C.peau}"/>
  <circle cx="200" cy="172" r="90" fill="${C.peau}"/>
  <path d="M106 172 C94 80 156 56 206 60 C264 60 308 96 294 172 C280 134 256 110 214 116 C186 126 150 122 106 172Z" fill="${C.cheveux}"/>
  <path d="M112 156 C134 102 190 92 216 118 C182 108 150 128 112 156Z" fill="${C.cheveux}"/>
  ${visage}`;
const joues = `<circle cx="142" cy="214" r="13" fill="#e08a7a" opacity=".45"/><circle cx="258" cy="214" r="13" fill="#e08a7a" opacity=".45"/>`;
const oeil = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.oeil}"/><circle cx="${x+3}" cy="${y-ry*0.35}" r="${Math.max(2.5, rx*0.28)}" fill="#fff"/>`;
const sourcil = (d, w = 6) => `<path d="${d}" fill="none" stroke="${C.cheveux}" stroke-width="${w}" stroke-linecap="round"/>`;
const visages = {
  moqueuse: `${joues}${oeil(162, 188, 9, 9)}${oeil(238, 188, 9, 9)}
    <path d="M150 176 H174 V186 H150Z" fill="${C.peau}"/><path d="M226 176 H250 V186 H226Z" fill="${C.peau}"/>
    <path d="M150 182 H174 M226 182 H250" stroke="${C.oeil}" stroke-width="5" stroke-linecap="round"/>
    ${sourcil('M142 150 Q162 134 182 148')}${sourcil('M220 160 L258 152')}
    <path d="M178 228 Q208 242 230 216" fill="none" stroke="${C.oeil}" stroke-width="5" stroke-linecap="round"/><path d="M230 216 L236 210" stroke="${C.oeil}" stroke-width="4" stroke-linecap="round"/>`,
  serieuse: `${joues}${oeil(162, 188, 9, 12)}${oeil(238, 188, 9, 12)}
    ${sourcil('M144 164 L182 160', 7)}${sourcil('M218 160 L256 164', 7)}
    <path d="M184 230 L216 230" fill="none" stroke="${C.oeil}" stroke-width="5" stroke-linecap="round"/>`,
  choquee: `${joues}
    <circle cx="162" cy="184" r="19" fill="#fff"/><circle cx="238" cy="184" r="19" fill="#fff"/><circle cx="162" cy="186" r="8" fill="${C.oeil}"/><circle cx="238" cy="186" r="8" fill="${C.oeil}"/>
    <circle cx="165" cy="182" r="3" fill="#fff"/><circle cx="241" cy="182" r="3" fill="#fff"/>
    ${sourcil('M144 146 Q164 126 184 142')}${sourcil('M216 142 Q236 126 256 146')}
    <ellipse cx="200" cy="232" rx="13" ry="17" fill="${C.oeil}"/><ellipse cx="200" cy="239" rx="7" ry="6" fill="#e0606e"/>`
};
const ecrire = (nom, corps, visage, largeur = 400) => writeFileSync(`${dir}/lina-${nom}.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} 640" width="${largeur}" height="640">\n  <title>Lina - ${nom}</title>${corps}${tete(visage)}\n</svg>\n`);

const base = glow + jambes + brasGauche + imper + brasTel;
for (const e of ['moqueuse', 'serieuse', 'choquee']) ecrire(e, base, visages[e]);
ecrire('bouquet-moqueuse', jambes + brasGauche + imper + brasBouquet, visages.moqueuse);
ecrire('bouquet-serieuse', jambes + brasGauche + imper + brasBouquet, visages.serieuse);
ecrire('tend-moqueuse', jambes + brasGauche + imper + brasTend, visages.moqueuse, 480);
ecrire('tend-serieuse', jambes + brasGauche + imper + brasTend, visages.serieuse, 480);
console.log('Lina ok');
