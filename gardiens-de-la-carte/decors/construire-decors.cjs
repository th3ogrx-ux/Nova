// Génère les décors réutilisables de la série. Lancer : node decors/construire-decors.cjs
const fs = require('node:fs');
const dir = __dirname;
const out = (nom, w, h, c, vb) => fs.writeFileSync(`${dir}/${nom}.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || `0 0 ${w} ${h}`}" width="${w}" height="${h}">\n  <title>${nom}</title>${c}\n</svg>\n`);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const GROUND = 1380;

// ---------- La cathédrale (silhouette simple, deux tours et une flèche) ----------
const cathedrale = (x, base, s, fill) => `<g transform="translate(${x} ${base}) scale(${s})" fill="${fill}">
  <rect x="-150" y="-330" width="300" height="330"/>
  <rect x="-92" y="-560" width="66" height="560"/><path d="M-96 -560 L-59 -690 L-22 -560Z"/>
  <rect x="26" y="-470" width="66" height="470"/><path d="M22 -470 L59 -590 L96 -470Z"/>
  <path d="M-150 -330 L0 -430 L150 -330Z"/>
  <path d="M-12 -430 L0 -760 L12 -430Z"/></g>`;

// ---------- Rue (nuit / jour) ----------
function rue(mode) {
  const n = mode === 'nuit';
  const P = n ? { ciel:'#040b1c', loin:'#081634', cath:'#0d2250', voisin:'#0a1a40', sol:'#101c46', route:'#0a1330', ligne:'#1a2a5c', fen:'#f5a623' }
              : { ciel:'#a9cdff', loin:'#86abe8', cath:'#7aa0e0', voisin:'#6c8fd6', sol:'#4b5f97', route:'#3a4c80', ligne:'#5f74ad', fen:'#c6d8fa' };
  const r = mulberry(7);
  let c = `<rect width="1080" height="1920" fill="${P.ciel}"/>`;
  if (n) for (let i = 0; i < 30; i++) c += `<circle cx="${Math.round(r()*1080)}" cy="${Math.round(r()*620)}" r="${(1+r()*2.5).toFixed(1)}" fill="#6fa8ff" opacity="${(.4+r()*.5).toFixed(2)}"/>`;
  else c += `<ellipse cx="260" cy="260" rx="130" ry="44" fill="#fff" opacity=".8"/><ellipse cx="360" cy="236" rx="90" ry="40" fill="#fff" opacity=".8"/><ellipse cx="820" cy="380" rx="150" ry="46" fill="#fff" opacity=".7"/>`;
  // ligne de toits lointaine
  for (let x = 0, i = 0; x < 1080; i++) { const w = 90 + Math.round(r()*80), h = 220 + Math.round(r()*260); c += `<rect x="${x}" y="${GROUND-h}" width="${w+2}" height="${h}" fill="${P.loin}"/>`; x += w; }
  c += cathedrale(330, GROUND, 1.45, P.cath);
  // voisins
  c += `<rect x="-20" y="380" width="170" height="${GROUND-380}" fill="${P.voisin}"/><rect x="930" y="430" width="170" height="${GROUND-430}" fill="${P.voisin}"/>`;
  c += `<rect x="30" y="470" width="50" height="80" rx="6" fill="${P.fen}" opacity="${n ? .55 : .5}"/><rect x="990" y="540" width="50" height="80" rx="6" fill="${P.fen}" opacity="${n ? .35 : .5}"/>`;
  c += `<rect y="${GROUND}" width="1080" height="120" fill="${P.sol}"/><rect y="${GROUND+120}" width="1080" height="420" fill="${P.route}"/>`;
  for (let x = 40; x < 1080; x += 220) c += `<rect x="${x}" y="1700" width="110" height="14" rx="7" fill="${P.ligne}"/>`;
  return c;
}
out('rue-nuit', 1080, 1920, rue('nuit'));
out('rue-jour', 1080, 1920, rue('jour'));

// ---------- Façades (viewBox 900x900, sol à y=900) : boulangerie allumée / mur gris ----------
function facadeBoulangerie() {
  let stripes = '';
  for (let i = 0; i < 9; i++) stripes += `<rect x="${130 + i*70}" y="590" width="70" height="90" fill="${i%2 ? '#e8d9b4' : '#d98a0f'}"/>`;
  let scallops = '';
  for (let i = 0; i < 9; i++) scallops += `<circle cx="${165 + i*70}" cy="680" r="35" fill="${i%2 ? '#e8d9b4' : '#d98a0f'}"/>`;
  return `
  <rect x="60" y="140" width="780" height="760" fill="#1b2f6b"/>
  <rect x="40" y="120" width="820" height="50" rx="8" fill="#10214f"/>
  <rect x="150" y="220" width="180" height="200" rx="10" fill="#10214f"/><rect x="164" y="234" width="152" height="172" rx="6" fill="#0a1634"/>
  <rect x="570" y="220" width="180" height="200" rx="10" fill="#10214f"/><rect x="584" y="234" width="152" height="172" rx="6" fill="#0a1634"/>
  <rect x="236" y="234" width="8" height="172" fill="#10214f"/><rect x="656" y="234" width="8" height="172" fill="#10214f"/>
  <rect x="150" y="450" width="600" height="120" rx="20" fill="#0b1738" stroke="#f5a623" stroke-width="4"/>
  <text x="450" y="530" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="74" fill="#26397a">Boulangerie</text>
  <rect x="120" y="590" width="660" height="90" fill="#10214f"/>${stripes}${scallops}
  <rect x="140" y="700" width="430" height="180" rx="10" fill="#10214f"/><rect x="154" y="714" width="402" height="152" rx="6" fill="#0a1634"/>
  <rect x="590" y="700" width="180" height="200" rx="10" fill="#10214f"/><rect x="606" y="716" width="148" height="184" rx="6" fill="#0a1634"/>
  <rect x="40" y="880" width="820" height="20" fill="#0f1c44"/>
  <g id="halo" opacity="1">
    <circle cx="355" cy="790" r="340" fill="#f5a623" opacity=".08"/><circle cx="355" cy="790" r="240" fill="#f5a623" opacity=".10"/>
    <circle cx="680" cy="800" r="170" fill="#f5a623" opacity=".10"/>
  </g>
  <g id="lumiere" opacity="1">
    <text x="450" y="530" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="74" fill="#f5a623">Boulangerie</text>
    <rect x="154" y="714" width="402" height="152" rx="6" fill="#f5a623"/><rect x="154" y="714" width="402" height="40" rx="6" fill="#ffd27a"/>
    <rect x="154" y="800" width="402" height="8" fill="#b8651b"/>
    <g fill="#b8651b"><rect x="190" y="745" width="26" height="130" rx="13" transform="rotate(14 203 810)"/><rect x="236" y="745" width="26" height="130" rx="13" transform="rotate(8 249 810)"/><rect x="282" y="745" width="26" height="130" rx="13" transform="rotate(-6 295 810)"/><ellipse cx="400" cy="835" rx="46" ry="28"/><ellipse cx="480" cy="840" rx="40" ry="26"/></g>
    <rect x="606" y="716" width="148" height="184" rx="6" fill="#f5a623"/><rect x="606" y="716" width="148" height="36" rx="6" fill="#ffd27a"/>
    <circle cx="624" cy="830" r="8" fill="#b8651b"/>
  </g>`;
}
function facadeMur(mode) {
  const n = mode === 'nuit';
  return `
  <rect x="60" y="140" width="780" height="760" fill="${n ? '#4a526a' : '#9aa3b8'}"/>
  <rect x="40" y="120" width="820" height="50" rx="8" fill="${n ? '#3d4459' : '#858ea5'}"/>
  <rect x="40" y="880" width="820" height="20" fill="${n ? '#363c50' : '#7b849b'}"/>`;
}
out('facade-boulangerie-nuit', 900, 900, facadeBoulangerie());
out('facade-mur-nuit', 900, 900, facadeMur('nuit'));
out('facade-mur-jour', 900, 900, facadeMur('jour'));

// ---------- Petit commerce de coin (viewBox 700x760) ----------
const vitrineCoin = () => {
  let stripes = '';
  for (let i = 0; i < 8; i++) stripes += `<rect x="${100 + i*60}" y="280" width="60" height="64" fill="${i%2 ? '#f4f6fb' : '#1a6bff'}"/>`;
  return `
  <rect x="40" y="120" width="620" height="640" fill="#1d3170"/><rect x="20" y="100" width="660" height="44" rx="8" fill="#10214f"/>
  <rect x="150" y="180" width="400" height="76" rx="16" fill="#0b1738" stroke="#f5a623" stroke-width="4"/>
  <rect x="100" y="270" width="480" height="14" fill="#10214f"/>${stripes}
  <rect x="100" y="360" width="340" height="340" rx="10" fill="#10214f"/><rect x="114" y="374" width="312" height="312" rx="6" fill="#0a1634"/>
  <rect x="470" y="360" width="140" height="400" rx="10" fill="#10214f"/><rect x="484" y="374" width="112" height="386" rx="6" fill="#0a1634"/>
  <rect x="20" y="740" width="660" height="20" fill="#0f1c44"/>
  <g id="halo" opacity="1"><circle cx="270" cy="530" r="330" fill="#f5a623" opacity=".08"/><circle cx="270" cy="530" r="230" fill="#f5a623" opacity=".10"/></g>
  <g id="lumiere" opacity="1">
    <rect x="114" y="374" width="312" height="312" rx="6" fill="#f5a623"/><rect x="114" y="374" width="312" height="60" rx="6" fill="#ffd27a"/>
    <rect x="114" y="520" width="312" height="8" fill="#b8651b"/><rect x="114" y="610" width="312" height="8" fill="#b8651b"/>
    <g fill="#b8651b"><rect x="150" y="470" width="44" height="50" rx="8"/><rect x="224" y="480" width="38" height="40" rx="8"/><rect x="296" y="466" width="50" height="54" rx="8"/><rect x="160" y="560" width="50" height="50" rx="8"/><rect x="250" y="570" width="40" height="40" rx="8"/><rect x="330" y="558" width="52" height="52" rx="8"/></g>
    <rect x="484" y="374" width="112" height="150" rx="6" fill="#f5a623"/><rect x="170" y="188" width="360" height="60" rx="10" fill="none" stroke="#f5a623" stroke-width="3"/>
  </g>`;
};
out('vitrine-coin', 700, 760, vitrineCoin());

// ---------- Chambre de Noé (nuit) ----------
const chambreBase = `
  <rect width="1080" height="1920" fill="#0a1634"/>
  <rect y="1390" width="1080" height="530" fill="#07102a"/><rect y="1370" width="1080" height="30" fill="#0f1f4d"/>`;
const lit = `
  <rect x="-20" y="1150" width="580" height="260" rx="30" fill="#162a63"/>
  <ellipse cx="130" cy="1200" rx="120" ry="44" fill="#cfd8f0"/>
  <circle cx="130" cy="1196" r="56" fill="#f2c7a0"/>
  <path d="M72 1196 C70 1120 190 1110 190 1196 C170 1166 110 1166 72 1196Z" fill="#2a3566"/>
  <rect x="70" y="1214" width="500" height="170" rx="50" fill="#1a6bff"/><rect x="70" y="1214" width="500" height="50" rx="25" fill="#1457d1"/>`;
const tableNuit = `
  <rect x="610" y="1170" width="310" height="240" rx="12" fill="#162a63"/><rect x="590" y="1146" width="350" height="32" rx="12" fill="#1d3a82"/>
  <rect x="640" y="1210" width="250" height="80" rx="8" fill="#10214f"/><circle cx="765" cy="1250" r="10" fill="#6fa8ff"/>
  <path d="M630 1146 L650 1060 H710 L730 1146Z" fill="#243a7a"/><rect x="676" y="1100" width="8" height="46" fill="#1d3a82"/>`;
const fenetreLune = `
  <rect x="110" y="300" width="360" height="520" rx="14" fill="#10214f"/><rect x="128" y="318" width="324" height="484" rx="8" fill="#123070"/>
  <circle cx="350" cy="450" r="56" fill="#cfe0ff"/><circle cx="378" cy="436" r="48" fill="#123070"/>
  <circle cx="190" cy="400" r="4" fill="#cfe0ff"/><circle cx="240" cy="520" r="3" fill="#cfe0ff"/><circle cx="170" cy="610" r="3" fill="#cfe0ff"/>
  <rect x="286" y="318" width="12" height="484" fill="#10214f"/><rect x="128" y="540" width="324" height="12" fill="#10214f"/>
  <rect x="96" y="812" width="388" height="22" rx="8" fill="#1d3a82"/>`;
out('chambre-nuit', 1080, 1920, chambreBase + fenetreLune + lit + tableNuit);

const fenetreRue = `
  <rect x="520" y="330" width="520" height="780" rx="14" fill="#10214f"/><rect x="540" y="350" width="480" height="740" rx="8" fill="#0a1a3d"/>
  <circle cx="610" cy="430" r="3" fill="#6fa8ff"/><circle cx="900" cy="470" r="4" fill="#6fa8ff"/><circle cx="780" cy="400" r="3" fill="#6fa8ff"/>
  <path d="M540 1090 V820 H620 V740 H700 V820 H780 V720 H860 V830 H1020 V1090Z" fill="#0b1c42"/>
  <g transform="translate(600 690) scale(.52)">${vitrineCoin()}</g>
  <rect x="528" y="1096" width="504" height="24" rx="8" fill="#1d3a82"/>
  <rect x="520" y="330" width="14" height="780" fill="#0d1c46"/>`;
out('chambre-fenetre', 1080, 1920, chambreBase + fenetreRue);

// ---------- Boulangerie, intérieur (ambiance souvenir, couleurs chaudes) ----------
let pain = '';
for (let i = 0; i < 6; i++) pain += `<rect x="${560 + i*75}" y="${700}" width="38" height="120" rx="19" fill="#c97a22" transform="rotate(${i%2 ? 10 : -10} ${579 + i*75} 760)"/>`;
let pain2 = '';
for (let i = 0; i < 5; i++) pain2 += `<ellipse cx="${600 + i*90}" cy="900" rx="40" ry="28" fill="#d99a3a"/>`;
out('boulangerie-interieur', 1080, 1920, `
  <rect width="1080" height="1920" fill="#f1e3c6"/><rect y="1050" width="1080" height="330" fill="#e6d2a8"/>
  <rect y="1380" width="1080" height="540" fill="#cdb48a"/>
  <rect x="60" y="300" width="300" height="560" rx="16" fill="#f7f0de"/><rect x="80" y="320" width="260" height="520" rx="10" fill="#cfe3ff"/>
  <rect x="204" y="320" width="12" height="520" fill="#f7f0de"/>
  <rect x="500" y="640" width="560" height="22" fill="#8a5a2b"/>${pain}
  <rect x="500" y="840" width="560" height="22" fill="#8a5a2b"/>${pain2}
  `);
out('boulangerie-comptoir', 1080, 1920, `
  <rect x="420" y="1180" width="700" height="260" rx="14" fill="#8a5a2b"/><rect x="400" y="1160" width="740" height="40" rx="14" fill="#a8703a"/>
  <rect x="440" y="1226" width="660" height="180" rx="10" fill="#7a4c22"/>`);

// ---------- Téléphone (centré en 0,0 ; écran 520x960) ----------
out('telephone', 600, 1040, `
  <defs><clipPath id="ecran"><rect x="-260" y="-480" width="520" height="960" rx="58"/></clipPath></defs>
  <rect x="-280" y="-500" width="560" height="1000" rx="76" fill="#0b1330" stroke="#1d2a55" stroke-width="8"/>
  <rect x="-260" y="-480" width="520" height="960" rx="58" fill="#050d24"/>
  <rect x="-70" y="-474" width="140" height="30" rx="15" fill="#0b1330"/>`, '-300 -520 600 1040');

// ---------- Carte de la ville (coordonnées de l'écran du téléphone, centrées en 0,0) ----------
const riviere = 'M-300 -330 C-120 -300 -40 -120 40 -40 S200 180 300 260';
const carteSvg = `
  <rect x="-260" y="-480" width="520" height="960" fill="#07163a"/>
  <g fill="#0b1f4e"><rect x="-230" y="-440" width="120" height="90" rx="10"/><rect x="120" y="-130" width="110" height="80" rx="10"/><rect x="-200" y="250" width="130" height="100" rx="10"/><rect x="90" y="330" width="120" height="90" rx="10"/></g>
  <g stroke="#12306e" stroke-width="6" stroke-linecap="round" fill="none">
    <path d="M-260 -380 L260 -400"/><path d="M-260 -250 L260 -230"/><path d="M-260 -110 L260 -140"/><path d="M-260 30 L260 60"/><path d="M-260 170 L260 150"/><path d="M-260 310 L260 330"/><path d="M-260 440 L260 420"/>
    <path d="M-180 -480 L-200 480"/><path d="M-60 -480 L-40 480"/><path d="M70 -480 L90 480"/><path d="M190 -480 L170 480"/>
  </g>
  <g stroke="#0f2a62" stroke-width="3" fill="none"><path d="M-260 -320 L260 -310"/><path d="M-260 -180 L260 -190"/><path d="M-260 100 L260 110"/><path d="M-260 240 L260 230"/><path d="M-120 -480 L-110 480"/><path d="M10 -480 L20 480"/><path d="M130 -480 L140 480"/></g>
  <path d="${riviere}" fill="none" stroke="#1a4fb8" stroke-width="74" stroke-linecap="round"/>
  <path d="${riviere}" fill="none" stroke="#2f6fe0" stroke-width="56" stroke-linecap="round"/>
  <path d="${riviere}" fill="none" stroke="#6fa8ff" stroke-width="4" stroke-linecap="round" opacity=".6" transform="translate(0 -8)"/>
  <g transform="translate(-120 150) scale(.55)" fill="#3a66c8" stroke="#6fa8ff" stroke-width="6">
    <rect x="-150" y="-330" width="300" height="330"/><rect x="-92" y="-560" width="66" height="560"/><path d="M-96 -560 L-59 -690 L-22 -560Z"/>
    <rect x="26" y="-470" width="66" height="470"/><path d="M22 -470 L59 -590 L96 -470Z"/><path d="M-150 -330 L0 -430 L150 -330Z"/><path d="M-12 -430 L0 -760 L12 -430Z"/></g>`;
out('carte-ville', 520, 960, carteSvg, '-260 -480 520 960');

// points lumineux (commerces) : positions fixes, évitent la rivière et la cathédrale
function bez(p0, p1, p2, p3, t) { const u = 1-t; return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]; }
const rv = [];
for (let t = 0; t <= 1; t += .02) rv.push(bez([-300,-330],[-120,-300],[-40,-120],[40,-40], t));
for (let t = 0; t <= 1; t += .02) rv.push(bez([40,-40],[120,40],[200,180],[300,260], t));
const rr = mulberry(21);
const pts = [{ id: 'A', x: -30, y: 90 }, { id: 'B', x: 120, y: 190 }];
let essais = 0;
while (pts.length < 40 && essais++ < 5000) {
  const x = Math.round(-220 + rr()*440), y = Math.round(-410 + rr()*800);
  if (rv.some(([a,b]) => Math.hypot(a-x, b-y) < 62)) continue;
  if (Math.hypot(x+120, y-60) < 80 && y > -100 && y < 160) continue; // cathédrale
  if (pts.some(p => Math.hypot(p.x-x, p.y-y) < 62)) continue;
  pts.push({ id: String(pts.length), x, y });
}
// ordre d'apparition : du centre vers l'extérieur, A et B parmi les premiers
const rest = pts.slice(2).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
fs.writeFileSync(`${dir}/carte-points.json`, JSON.stringify([pts[0], pts[1], ...rest], null, 1));

// ---------- Brume (l'Oubli) et épingle ----------
let b = '';
const rb = mulberry(5);
for (let i = 0; i < 16; i++) b += `<ellipse cx="${100 + i*95}" cy="${380 + Math.round(rb()*60)}" rx="${150 + Math.round(rb()*60)}" ry="${110 + Math.round(rb()*50)}" fill="${['#5d667c','#7c859b','#aab2c4'][i%3]}"/>`;
out('brume', 1600, 700, b + `<rect y="440" width="1600" height="260" fill="#aab2c4"/>`);
out('epingle', 100, 130, `<path d="M50 125 C20 90 10 66 10 50 A40 40 0 1 1 90 50 C90 66 80 90 50 125Z" fill="#f5a623"/><circle cx="50" cy="50" r="15" fill="#fff3d6"/>`);

// ---------- Boucherie (façade de nuit) : 'enseigne', 'halo' et 'lumiere' sont animables ----------
let rayBoucher = '';
for (let i = 0; i < 9; i++) rayBoucher += `<rect x="${120 + i*70}" y="560" width="70" height="80" fill="${i%2 ? '#e8d9b4' : '#c23a34'}"/>`;
let scBou = '';
for (let i = 0; i < 9; i++) scBou += `<circle cx="${155 + i*70}" cy="640" r="35" fill="${i%2 ? '#e8d9b4' : '#c23a34'}"/>`;
out('boucherie-facade-nuit', 900, 900, `
  <rect x="60" y="140" width="780" height="760" fill="#2a2f66"/><rect x="40" y="120" width="820" height="50" rx="8" fill="#161a48"/>
  <rect x="150" y="200" width="180" height="200" rx="10" fill="#161a48"/><rect x="164" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <rect x="570" y="200" width="180" height="200" rx="10" fill="#161a48"/><rect x="584" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <g id="enseigne" opacity="1">
    <rect x="200" y="430" width="500" height="100" rx="20" fill="#0b1738" stroke="#f5a623" stroke-width="4"/>
    <circle cx="450" cy="480" r="32" fill="#f5a623"/><circle cx="450" cy="480" r="12" fill="#0b1738"/>
    <rect x="360" y="466" width="60" height="28" rx="14" fill="#f5a623"/><rect x="480" y="466" width="60" height="28" rx="14" fill="#f5a623"/>
  </g>
  <rect x="100" y="550" width="700" height="14" fill="#161a48"/>${rayBoucher}${scBou}
  <rect x="120" y="680" width="470" height="210" rx="10" fill="#161a48"/><rect x="134" y="694" width="442" height="182" rx="6" fill="#0a1634"/>
  <rect x="620" y="660" width="180" height="240" rx="10" fill="#161a48"/><rect x="636" y="676" width="148" height="224" rx="6" fill="#0a1634"/>
  <rect x="40" y="880" width="820" height="20" fill="#10143a"/>
  <g id="halo" opacity="1"><circle cx="355" cy="790" r="340" fill="#f5a623" opacity=".08"/><circle cx="355" cy="790" r="240" fill="#f5a623" opacity=".10"/><circle cx="710" cy="800" r="170" fill="#f5a623" opacity=".10"/></g>
  <g id="lumiere" opacity="1">
    <rect x="134" y="694" width="442" height="182" rx="6" fill="#f5a623"/><rect x="134" y="694" width="442" height="36" rx="6" fill="#ffd27a"/>
    <rect x="636" y="676" width="148" height="224" rx="6" fill="#f5a623"/>
    <g stroke="#7a3a1b" stroke-width="5" stroke-linecap="round"><path d="M180 700 V760 M250 700 V780 M320 700 V760 M390 700 V780 M460 700 V760 M530 700 V780"/></g>
    <g fill="#c23a34"><ellipse cx="180" cy="770" rx="14" ry="26"/><ellipse cx="250" cy="790" rx="14" ry="26"/><ellipse cx="320" cy="770" rx="14" ry="26"/><ellipse cx="390" cy="790" rx="14" ry="26"/><ellipse cx="460" cy="770" rx="14" ry="26"/><ellipse cx="530" cy="790" rx="14" ry="26"/></g>
  </g>`);
out('boucherie-vitre', 900, 900, `<g fill="#fff" opacity=".12"><path d="M150 694 L260 694 L190 876 L134 876Z"/><path d="M300 694 L330 694 L260 876 L230 876Z"/></g><rect x="134" y="694" width="442" height="182" rx="6" fill="none" stroke="#161a48" stroke-width="10"/>`);

// ---------- Boucherie, intérieur (carrelage, crochets, comptoir rouge) ----------
let carreaux = '';
for (let x = 0; x < 1080; x += 120) carreaux += `<rect x="${x}" y="0" width="3" height="1380" fill="#d7dfee"/>`;
for (let y = 0; y < 1380; y += 120) carreaux += `<rect x="0" y="${y}" width="1080" height="3" fill="#d7dfee"/>`;
let crochets = '';
for (let i = 0; i < 6; i++) crochets += `<path d="M${560 + i*85} 420 V500" stroke="#7a3a1b" stroke-width="6"/><ellipse cx="${560 + i*85}" cy="540" rx="24" ry="50" fill="${i%2 ? '#c23a34' : '#d9605a'}"/>`;
out('boucherie-interieur', 1080, 1920, `
  <rect width="1080" height="1920" fill="#f0e6cf"/><rect width="1080" height="1380" fill="#eef2fa"/>${carreaux}
  <rect y="1380" width="1080" height="540" fill="#bfae8c"/>
  <rect x="520" y="400" width="520" height="14" fill="#8a5a2b"/>${crochets}`);
out('boucherie-comptoir', 1080, 1920, `<rect x="420" y="1180" width="700" height="260" rx="14" fill="#b3342f"/><rect x="400" y="1160" width="740" height="40" rx="14" fill="#e8e8ee"/><rect x="440" y="1226" width="660" height="180" rx="10" fill="#9a2b27"/>`);

// ---------- Toit (le Gris domine la ville) ----------
out('toit-nuit', 1080, 1920, `
  <rect x="330" y="760" width="800" height="700" fill="#0d1c45"/><rect x="300" y="730" width="840" height="46" rx="8" fill="#08122f"/>
  <rect x="860" y="600" width="70" height="140" fill="#08122f"/><rect x="852" y="590" width="86" height="18" fill="#08122f"/>
  <rect x="420" y="690" width="10" height="50" fill="#08122f"/>
  <g fill="#f5a623" opacity=".25"><rect x="400" y="860" width="60" height="90" rx="6"/><rect x="560" y="860" width="60" height="90" rx="6"/><rect x="720" y="1000" width="60" height="90" rx="6"/></g>`);

// ---------- Librairie (façade de nuit) ----------
let livres = '', xl = 140;
const couleursLivres = ['#c23a34', '#1a6bff', '#3f9b6a', '#f4f6fb', '#7a3a1b', '#6a3fa0', '#e8a21a'];
for (let r = 0; r < 2; r++) { xl = 140; for (let i = 0; i < 12; i++) { const w = 22 + (i * 7) % 14, h = 50 + (i * 13) % 26; livres += `<rect x="${xl}" y="${(r ? 836 : 760) - h}" width="${w}" height="${h}" rx="3" fill="${couleursLivres[(i + r * 3) % 7]}"/>`; xl += w + 6; } }
let rayLib = '', scLib = '';
for (let i = 0; i < 9; i++) { rayLib += `<rect x="${120 + i*70}" y="560" width="70" height="80" fill="${i%2 ? '#e8d9b4' : '#1f7a5c'}"/>`; scLib += `<circle cx="${155 + i*70}" cy="640" r="35" fill="${i%2 ? '#e8d9b4' : '#1f7a5c'}"/>`; }
out('librairie-facade-nuit', 900, 900, `
  <rect x="60" y="140" width="780" height="760" fill="#23405f"/><rect x="40" y="120" width="820" height="50" rx="8" fill="#142a44"/>
  <rect x="150" y="200" width="180" height="200" rx="10" fill="#142a44"/><rect x="164" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <rect x="570" y="200" width="180" height="200" rx="10" fill="#142a44"/><rect x="584" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <g id="enseigne" opacity="1"><rect x="200" y="430" width="500" height="100" rx="20" fill="#0b1738" stroke="#f5a623" stroke-width="4"/>
    <path d="M450 468 C420 452 392 456 372 462 V510 C392 504 420 500 450 514Z M450 468 C480 452 508 456 528 462 V510 C508 504 480 500 450 514Z" fill="#f5a623"/></g>
  <rect x="100" y="550" width="700" height="14" fill="#142a44"/>${rayLib}${scLib}
  <rect x="110" y="680" width="490" height="210" rx="10" fill="#142a44"/><rect x="124" y="694" width="462" height="182" rx="6" fill="#0a1634"/>
  <rect x="620" y="660" width="180" height="240" rx="10" fill="#142a44"/><rect x="636" y="676" width="148" height="224" rx="6" fill="#0a1634"/>
  <rect x="40" y="880" width="820" height="20" fill="#0f1c34"/>
  <g id="halo" opacity="1"><circle cx="355" cy="790" r="340" fill="#f5a623" opacity=".08"/><circle cx="355" cy="790" r="240" fill="#f5a623" opacity=".10"/><circle cx="710" cy="800" r="170" fill="#f5a623" opacity=".10"/></g>
  <g id="lumiere" opacity="1"><rect x="124" y="694" width="462" height="182" rx="6" fill="#f5a623"/><rect x="124" y="694" width="462" height="30" rx="6" fill="#ffd27a"/>
    <rect x="124" y="760" width="462" height="8" fill="#b8651b"/><rect x="124" y="836" width="462" height="8" fill="#b8651b"/>${livres}
    <rect x="636" y="676" width="148" height="224" rx="6" fill="#f5a623"/></g>`);

// ---------- Fleuriste (façade de nuit) ----------
let rayFl = '', scFl = '';
for (let i = 0; i < 9; i++) { rayFl += `<rect x="${120 + i*70}" y="560" width="70" height="80" fill="${i%2 ? '#f4e6c8' : '#d96a9a'}"/>`; scFl += `<circle cx="${155 + i*70}" cy="640" r="35" fill="${i%2 ? '#f4e6c8' : '#d96a9a'}"/>`; }
const fleur = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r*0.35}" fill="#f5d36b"/>`;
let fleursVitre = '', seaux = '';
const cf = ['#e0606e', '#f4f6fb', '#f5d36b', '#d96a9a', '#c23a34'];
for (let i = 0; i < 11; i++) fleursVitre += fleur(160 + i*36, 770 + (i % 3) * 22, 18, cf[i % 5]) + `<path d="M${160 + i*36} ${790 + (i % 3) * 22} V876" stroke="#3f9b6a" stroke-width="5"/>`;
for (let k = 0; k < 3; k++) { const bx = 130 + k*150; seaux += `<path d="M${bx} 840 H${bx + 110} L${bx + 98} 892 H${bx + 12}Z" fill="#8a5a2b"/>` + [0, 1, 2, 3].map(i => fleur(bx + 18 + i*26, 818 - (i % 2) * 14, 15, cf[(i + k) % 5])).join(''); }
out('fleuriste-facade-nuit', 900, 900, `
  <rect x="60" y="140" width="780" height="760" fill="#3b2a63"/><rect x="40" y="120" width="820" height="50" rx="8" fill="#241a45"/>
  <rect x="150" y="200" width="180" height="200" rx="10" fill="#241a45"/><rect x="164" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <rect x="570" y="200" width="180" height="200" rx="10" fill="#241a45"/><rect x="584" y="214" width="152" height="172" rx="6" fill="#0a1634"/>
  <g id="enseigne" opacity="1"><rect x="200" y="430" width="500" height="100" rx="20" fill="#0b1738" stroke="#f5a623" stroke-width="4"/>
    ${[0, 1, 2, 3, 4].map(i => `<circle cx="${450 + Math.cos(i*1.2566)*26}" cy="${480 + Math.sin(i*1.2566)*26}" r="16" fill="#f5a623"/>`).join('')}<circle cx="450" cy="480" r="12" fill="#0b1738"/></g>
  <rect x="100" y="550" width="700" height="14" fill="#241a45"/>${rayFl}${scFl}
  <rect x="110" y="680" width="490" height="210" rx="10" fill="#241a45"/><rect x="124" y="694" width="462" height="182" rx="6" fill="#0a1634"/>
  <rect x="620" y="660" width="180" height="240" rx="10" fill="#241a45"/><rect x="636" y="676" width="148" height="224" rx="6" fill="#0a1634"/>
  <rect x="40" y="880" width="820" height="20" fill="#1a1236"/>
  <g id="halo" opacity="1"><circle cx="355" cy="790" r="340" fill="#f5a623" opacity=".08"/><circle cx="355" cy="790" r="240" fill="#f5a623" opacity=".10"/><circle cx="710" cy="800" r="170" fill="#f5a623" opacity=".10"/></g>
  <g id="lumiere" opacity="1"><rect x="124" y="694" width="462" height="182" rx="6" fill="#f5a623"/><rect x="124" y="694" width="462" height="30" rx="6" fill="#ffd27a"/>${fleursVitre}
    <rect x="636" y="676" width="148" height="224" rx="6" fill="#f5a623"/></g>
  <g id="seaux">${seaux}</g>`);

// ---------- Grand lampadaire (le Gris s'assoit tout en haut ; plate-forme à y=236) ----------
out('lampadaire-haut', 400, 1500, `
  <rect x="190" y="340" width="20" height="1160" fill="#0a1630"/><rect x="160" y="1440" width="80" height="60" rx="8" fill="#0a1630"/>
  <rect x="150" y="236" width="100" height="14" rx="6" fill="#0a1630"/>
  <path d="M158 250 H242 L228 340 H172Z" fill="#0d1c45" stroke="#0a1630" stroke-width="6"/>
  <g id="lampe" opacity="1"><circle cx="200" cy="300" r="170" fill="#f5a623" opacity=".10"/><circle cx="200" cy="300" r="96" fill="#f5a623" opacity=".16"/><path d="M172 256 H228 L218 330 H182Z" fill="#ffe6b0"/></g>`);

// ---------- Énorme vague de brume (se dresse derrière le Gris) ----------
{ const rw = mulberry(33); let v = '';
  const teintes = [['#5d667c', 1.0], ['#7c859b', 0.78], ['#aab2c4', 0.56]];
  for (const [col, k] of teintes) {
    v += `<path d="M0 1400 V760 C300 ${700 + (1 - k) * 160} 700 ${560 + (1 - k) * 180} 1000 ${380 + (1 - k) * 220} C1300 ${200 + (1 - k) * 260} 1700 ${240 + (1 - k) * 200} 2100 ${420 + (1 - k) * 200} C2250 500 2340 600 2400 700 V1400Z" fill="${col}"/>`;
    for (let i = 0; i < 46; i++) { const a = -0.25 + (i / 45) * 3.3, R = 560 * k + 60, cx = 1250 + Math.cos(a + Math.PI) * R * 1.55, cy = 800 + Math.sin(a + Math.PI) * R - 30 * k;
      v += `<circle cx="${Math.round(cx)}" cy="${Math.round(cy)}" r="${Math.round(70 + rw() * 70)}" fill="${col}"/>`; }
  }
  out('vague-brume', 2400, 1400, v); }
console.log('decors ok');
