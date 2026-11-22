// Épisode 1 - "La boulangerie qui n'a jamais existé". Code exécuté dans Chromium.
// Variables fournies : A (décors, personnages, points). render(f) dessine l'image numéro f (30 i/s).
const W = 1080, H = 1920, FPS = 30, GROUND = 1380;
const COL = { nuit:'#040b1c', bleu:'#1a6bff', clair:'#6fa8ff', ambre:'#f5a623', gris:'#8b93a7', grisSombre:'#5d667c' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t;
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const viol = new Set();
window.__viol = viol;

// ---------- Textes ----------
const FONT = 'Inter, "DejaVu Sans", sans-serif';
const ctx = document.createElement('canvas').getContext('2d');
const wrapCache = {};
function wrap(text, size, maxW, weight = 800) {
  const key = text + size + maxW + weight;
  if (wrapCache[key]) return wrapCache[key];
  ctx.font = `${weight} ${size}px ${FONT}`;
  const mots = text.replace(/ ([?!:;])/g, ' $1').split(' ');
  const lines = []; let cur = '';
  for (const m of mots) {
    const essai = cur ? cur + ' ' + m : m;
    if (ctx.measureText(essai).width > maxW && cur) { lines.push(cur); cur = m; } else cur = essai;
  }
  if (cur) lines.push(cur);
  return (wrapCache[key] = lines);
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Légende : blanc, contour sombre. Zone sûre : x 110..910, jamais sous y=1670.
function caption(text, t, o = {}) {
  const size = o.size || 72, maxW = o.maxW || 800, cx = o.cx || 510, lh = size * 1.22;
  if (o.t1 != null && t >= o.t1) return '';
  const k = clamp((t - (o.t0 ?? 0.08)) / 0.22);
  const lines = wrap(text, size, maxW);
  const yFirst = o.center != null ? o.center - (lines.length - 1) * lh / 2 + size * 0.35 : (o.bottom || 1612) - (lines.length - 1) * lh;
  const yLast = yFirst + (lines.length - 1) * lh;
  ctx.font = `800 ${size}px ${FONT}`;
  const wMax = Math.max(...lines.map(l => ctx.measureText(l).width));
  if (cx + wMax / 2 + size * 0.1 > 925 || cx - wMax / 2 < 95 || yLast + size * 0.3 > 1670) viol.add(`texte hors zone: "${text}"`);
  if (k <= 0) return '';
  const yc = yFirst + (lines.length - 1) * lh / 2 - size * 0.3, e = easeBack(k);
  const hl = (o.hl || []).map(w => w.toLowerCase());
  const motsLigne = l => l.split(' ').map(w => hl.includes(w.toLowerCase().replace(/[.,?!…:;]/g, '')) ? `<tspan fill="${COL.ambre}">${esc(w)}</tspan>` : esc(w)).join(' ');
  return `<g opacity="${Math.min(1, k * 2)}" transform="translate(${cx} ${yc}) rotate(${(1 - e) * -3}) scale(${0.7 + 0.3 * e}) translate(${-cx} ${-yc})">` +
    lines.map((l, i) => `<text x="${cx}" y="${yFirst + i * lh}" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="${size}" fill="${o.col || '#fff'}" stroke="${COL.nuit}" stroke-width="${size * 0.18}" word-spacing="${size * 0.08}" stroke-linejoin="round" paint-order="stroke">${motsLigne(l)}</text>`).join('') + '</g>';
}

// ---------- Outils de composition ----------
const op = (m, id, v) => m.replace(`id="${id}" opacity="1"`, `id="${id}" opacity="${clamp(v).toFixed(3)}"`);
let CURSPLIT = null;
function cam(content, t, d, o) {
  if (CURSPLIT && t >= CURSPLIT.at) { const S = CURSPLIT; o = { z0: S.z, z1: S.z * 1.12, f0: S.f, f1: S.f2 || S.f, clamp: o.clamp, a: o.a, rot0: S.rot, rot1: S.rot, shake: 0 }; t -= S.at; d -= S.at; }
  const p = clamp(t / d), z = lerp(o.z0, o.z1, p);
  let fx = lerp(o.f0[0], o.f1[0], p) + Math.sin(t * 1.7) * 5, fy = lerp(o.f0[1], o.f1[1], p) + Math.cos(t * 1.3) * 5;
  if (o.clamp !== false) { fx = clamp(fx, 540 / z, W - 540 / z); fy = clamp(fy, 960 / z, H - 960 / z); }
  const a = o.a || [540, 960], s = o.shake || 0;
  const sx = s ? Math.sin(t * 61) * s : 0, sy = s ? Math.cos(t * 53) * s : 0;
  const rot = lerp(o.rot0 || 0, o.rot1 || 0, p);
  return `<g transform="translate(${a[0] + sx} ${a[1] + sy}) rotate(${rot}) scale(${z}) translate(${-fx} ${-fy})">${content}</g>`;
}
function hero(name, cx, feet, s, o = {}) {
  const sy = s * (1 + 0.012 * Math.sin((o.t || 0) * 3.2));
  return `<g transform="translate(${cx} ${feet}) rotate(${o.rot || 0}) scale(${s} ${sy}) translate(-200 -608)">${A.hero[name]}${o.extra || ''}</g>`;
}
function perso(markup, cx, feet, s, o = {}) {
  const sy = s * (1 + 0.01 * Math.sin((o.t || 0) * 2.6 + 1));
  return `<g transform="translate(${cx} ${feet}) rotate(${o.rot || 0}) scale(${s} ${sy}) translate(-200 -608)">${markup}</g>`;
}
const fondNuit = (t, o = 0) => `<rect width="${W}" height="${H}" fill="${COL.nuit}"/>${etincelles(t, 12)}<circle cx="540" cy="960" r="${760 + Math.sin(t * 1.2 + o) * 20}" fill="${COL.bleu}" opacity=".10"/><circle cx="540" cy="960" r="520" fill="${COL.bleu}" opacity=".10"/>`;

const flash = (t, t0, g) => t < t0 ? '' : `<rect width="${W}" height="${H}" fill="#fff" opacity="${(g * Math.exp(-(t - t0) * 13)).toFixed(3)}"/>`;
function speedLines(cx, cy, t, t0) {
  if (t < t0) return '';
  const op = 0.6 * Math.exp(-(t - t0) * 5); let s = '';
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + Math.sin(i * 7.1) * .06, r1 = 230 + (i % 3) * 40, r2 = 1500, w = 0.035;
    s += `<polygon points="${cx + Math.cos(a - w) * r2},${cy + Math.sin(a - w) * r2} ${cx + Math.cos(a + w) * r2},${cy + Math.sin(a + w) * r2} ${cx + Math.cos(a) * r1},${cy + Math.sin(a) * r1}" fill="#fff" opacity="${op.toFixed(3)}"/>`;
  }
  return s;
}
function etincelles(t, n = 14, col = COL.ambre) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(i * 173 + 90 + Math.sin(t * .8 + i) * 40) % 1000 + 40}" cy="${1900 - ((t * (90 + i * 9) + i * 211) % 1900)}" r="${3 + (i % 3) * 2}" fill="${col}" opacity="${0.25 + (i % 4) * 0.12}"/>`;
  return s;
}

// ---------- Brume (l'Oubli) ----------
const FOG = [{ c:'#5d667c', off:90, sp:.9, ph:0 }, { c:'#7c859b', off:40, sp:-.7, ph:2 }, { c:'#aab2c4', off:0, sp:.6, ph:4 }];
function fogBank(level, t) {
  const base = lerp(1900, 160, level);
  let s = '';
  for (const L of FOG) {
    const y0 = base + L.off;
    s += `<rect x="-50" y="${y0 + 70}" width="${W + 100}" height="${H}" fill="${L.c}"/>`;
    for (let i = -1; i < 10; i++) s += `<ellipse cx="${i * 130 + Math.sin(t * L.sp + i) * 40}" cy="${y0 + 40 * Math.sin(t * 1.3 + i * .9 + L.ph)}" rx="150" ry="135" fill="${L.c}"/>`;
  }
  return s;
}
function fogFront(x0, t, topBase = 800) {
  let s = '';
  FOG.forEach((L, k) => {
    const xk = x0 - k * 80, top = topBase + k * 50;
    s += `<rect x="-300" y="${top + 60}" width="${xk + 300 - 40}" height="${H}" fill="${L.c}"/>`;
    for (let i = -1; i < 7; i++) s += `<ellipse cx="${-100 + i * 150 + (xk + 100) * .0}" cy="${top + 35 * Math.sin(t * 1.4 + i + L.ph)}" rx="150" ry="110" fill="${L.c}" opacity="${-100 + i * 150 < xk ? 1 : 0}"/>`;
    for (let j = 0; j < 14; j++) s += `<ellipse cx="${xk - 30 + 25 * Math.sin(t * 1.6 + j + L.ph)}" cy="${top + 60 + j * 125}" rx="120" ry="100" fill="${L.c}"/>`;
  });
  return s;
}

// ---------- Carte et téléphone ----------
const PTS = A.points;
const PIN = 'M0 0 C-12 -16 -15 -24 -15 -30 A15 15 0 1 1 15 -30 C15 -24 12 -16 0 0Z';
function pinMarkup(p, sc, on, glow, couleur) {
  if (sc <= 0) return '';
  const base = couleur || COL.ambre;
  const col = on > 0.5 ? base : COL.grisSombre;
  const halo = on > 0.5 ? `<circle cx="0" cy="-30" r="40" fill="${base}" opacity="${(0.14 * glow).toFixed(3)}"/><circle cx="0" cy="-30" r="24" fill="${base}" opacity="${(0.22 * glow).toFixed(3)}"/>` : '';
  return `<g transform="translate(${p.x} ${p.y}) scale(${sc})">${halo}<path d="${PIN}" fill="${col}"/><circle cx="0" cy="-30" r="5.5" fill="${on > 0.5 ? '#fff3d6' : '#8b93a7'}"/></g>`;
}
function phoneScene(pinsFn, overlay = '') {
  const pins = PTS.map((p, i) => { const s = pinsFn(p, i); return pinMarkup(p, s.sc, s.on, s.glow, s.col); }).join('');
  return `<g>${A.decor.telephone}<g clip-path="url(#ecran)">${A.decor['carte-ville']}${pins}${overlay}</g>
    <rect x="-70" y="-474" width="140" height="30" rx="15" fill="#0b1330"/></g>`;
}
const popScale = (t, t0) => { const k = clamp((t - t0) / 0.35); return k <= 0 ? 0 : (k >= 1 ? 1 : 1 + Math.sin(k * Math.PI) * 0.18) * easeOut(Math.min(1, k * 1.4)); };
const idxOf = id => PTS.findIndex(p => p.id === id);
const phoneCam = (content, t, d, z0, z1, f0, f1, ay = 960) => cam(content, t, d, { z0, z1, f0, f1, a: [540, ay], clamp: false });
// états des lumières A et B qui s'éteignent (plans 8 et 9) : retourne {on, glow}
function eteint(t, tDebut, tFin) {
  if (t < tDebut) return { on: 1, glow: 1 };
  if (t < tFin) return { on: (Math.floor((t - tDebut) * 9) % 2 === 0) ? 1 : 0.2, glow: 0.7 };
  return { on: 0, glow: 0 };
}
function etatPin(p, t, planT) { // planT : temps dans le plan 8 (0..4)
  if (p.id === 'A') return planT < 0.45 ? { on: 1, glow: 1 } : (planT < 1.35 ? eteint(planT, 0.45, 1.35) : { on: 0, glow: 0 });
  if (p.id === 'B') return planT < 2.3 ? { on: 1, glow: 1 } : eteint(planT, 2.3, 3.2);
  return { on: 1, glow: 1 };
}

// ===================================================================================
// Épisode 1 : "Il reste 2 minutes" - nouveaux éléments (compte à rebours, course, boucherie...)
// ===================================================================================
const RED = '#ff3b30';
const GRIS_TXT = '#d4daf0';
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `0${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Pastille du compte à rebours, en haut de l'écran (hors des 250 px du bas et du côté droit)
function hud(sec, t, o = {}) {
  const rouge = o.rouge || sec <= 10, blink = rouge && Math.floor(t * 4) % 2 === 0;
  return `<g><rect x="340" y="196" width="340" height="120" rx="40" fill="${COL.nuit}" opacity=".9" stroke="${rouge ? RED : COL.ambre}" stroke-width="6"/>
    <text x="510" y="282" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="88" fill="${rouge ? RED : '#fff'}" opacity="${blink ? 0.4 : 1}">${mmss(sec)}</text></g>`;
}
function etiquette(p, txt, t, grand = 1) {
  const b = Math.floor(t * 3) % 2 === 0;
  return `<g transform="translate(${p.x} ${p.y - 84}) scale(${grand})"><rect x="-54" y="-22" width="108" height="40" rx="12" fill="${COL.nuit}" opacity=".92" stroke="${RED}" stroke-width="3"/>
    <text x="0" y="8" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="28" fill="${b ? '#fff' : RED}">${txt}</text></g>`;
}
const runName = (base, t, hz = 7) => `${base}-${Math.floor(t * hz) % 2 ? 'a' : 'b'}`;
function bubble(text, t, t0, o = {}) {
  const by = o.by || 360, tailX = o.tailX || 730, k = clamp((t - t0) / 0.3), e = easeBack(k);
  const lines = wrap(text, 54, 700, 700), bh = lines.length * 68 + 56;
  if (k <= 0) return '';
  return `<g opacity="${k}" transform="translate(510 ${by + bh / 2}) scale(${0.85 + 0.15 * e}) translate(-510 ${-(by + bh / 2)})">
    <rect x="110" y="${by}" width="800" height="${bh}" rx="46" fill="#fff" stroke="${COL.nuit}" stroke-width="8"/>
    <path d="M${tailX - 40} ${by + bh - 4} L${tailX + 30} ${by + bh - 4} L${tailX + 36} ${by + bh + 150} Z" fill="#fff" stroke="${COL.nuit}" stroke-width="8" stroke-linejoin="round"/>
    <rect x="${tailX - 48}" y="${by + bh - 12}" width="86" height="14" fill="#fff"/>
    ${lines.map((l, i) => `<text x="510" y="${by + 70 + i * 68}" text-anchor="middle" font-family='${FONT}' font-weight="700" font-size="54" fill="#0b1330">${esc(l)}</text>`).join('')}</g>`;
}
// Message tapé sur l'écran du téléphone (en bleu), sur un bandeau sombre
function messagePanel(text, y0, nChars) {
  ctx.font = `700 34px ${FONT}`;
  const lines = wrap(text, 34, 370, 700);
  let reste = Math.max(0, Math.floor(nChars)), s = `<rect x="-238" y="${y0 - 52}" width="476" height="${lines.length * 46 + 54}" rx="26" fill="${COL.nuit}" opacity=".9" stroke="${COL.clair}" stroke-width="3"/>`;
  s += `<g transform="translate(-205 ${y0 - 8}) scale(.9)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="5.5" fill="#fff3d6"/></g>`;
  lines.forEach((l, i) => { const n = Math.min(l.length, reste); reste -= n; if (n > 0) s += `<text x="-165" y="${y0 + i * 46}" font-family='${FONT}' font-weight="700" font-size="34" fill="${COL.clair}">${esc(l.slice(0, n))}</text>`; });
  return s;
}
const clip = (id, x, y, w, h, rx = 0) => `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>`;

// ---------- Rangée de commerces qui défile (rue de nuit), éteints par la brume ----------
function shopsRow(camX, fogW, t) {
  let s = ''; const step = 470, i0 = Math.floor((camX - 300) / step) - 1, i1 = Math.floor((camX + 1400) / step) + 1;
  for (let i = i0; i <= i1; i++) {
    const wx = i * step, sx = wx - camX, kind = ((i % 2) + 2) % 2;
    let v = clamp((wx + 210 - fogW) / 160);
    if (v > 0 && v < 1) v *= Math.sin(t * 45 + i) > 0 ? 1 : 0.25;
    if (kind === 0) s += `<g transform="translate(${sx} ${1380 - 760 * 0.62}) scale(0.62)">${op(op(A.decor['vitrine-coin'], 'lumiere', v), 'halo', v)}</g>`;
    else s += `<g transform="translate(${sx} ${1380 - 900 * 0.5}) scale(0.5)">${op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', v), 'halo', v)}</g>`;
  }
  return s;
}
function lampadaires(camX) {
  let s = ''; const step = 640;
  for (let i = Math.floor(camX / step) - 1; i <= Math.floor((camX + 1300) / step) + 1; i++) {
    const x = i * step + 300 - camX;
    s += `<rect x="${x - 7}" y="880" width="14" height="500" fill="#0a1630"/><circle cx="${x}" cy="870" r="130" fill="${COL.ambre}" opacity=".10"/><circle cx="${x}" cy="870" r="64" fill="${COL.ambre}" opacity=".16"/><circle cx="${x}" cy="870" r="26" fill="#ffe6b0"/>`;
  }
  return s;
}
function poussiere(cx, feet, t, n = 5) {
  let s = '';
  for (let i = 0; i < n; i++) { const k = ((t * 3 + i / n) % 1); s += `<ellipse cx="${cx - 60 - k * 220}" cy="${feet - 10 - k * 30}" rx="${14 + k * 34}" ry="${8 + k * 18}" fill="${COL.gris}" opacity="${(0.5 * (1 - k)).toFixed(2)}"/>`; }
  return s;
}

// ---------- Plan 1 : la course (réutilisé par le rembobinage) ----------
const CAM1 = { z0: 1.15, z1: 1.3, f0: [540, 960], f1: [560, 980], rot0: -3, rot1: -1, shake: 10 };
function sceneP1(t) {
  const camX = 400 + t * 560, bob = Math.abs(Math.sin(t * 14)) * 18;
  let s = A.decor['rue-nuit'] + shopsRow(camX, camX + 300, t);
  for (let i = 0; i < 7; i++) s += `<rect x="${((i * 347 - t * 1800) % 1500 + 1500) % 1500 - 200}" y="${1200 + i * 38}" width="220" height="6" rx="3" fill="#fff" opacity=".12"/>`;
  s += poussiere(700, 1470, t) + hero(runName('essouffle-course', t, 7), 700, 1470 - bob, 1.1, { t, rot: 4 });
  s += fogFront(330 + Math.sin(t * 3) * 25, t, 380);
  return cam(s, t, 3, CAM1);
}


// ===================================================================================
// Épisode 2 : "Ne m'oublie pas"
// ===================================================================================
const LINA_TXT = '#ffe08a';
const PLANS = [];
const plan = (d, fn, extra = {}) => PLANS.push({ d, fn, ...extra });
const PTS47 = PTS.concat([[-205, -410], [190, -380], [-215, -250], [205, -60], [-60, 300], [200, 300], [-10, 420]].map(([x, y], i) => ({ id: 'x' + i, x, y })));
function phoneSceneP(P, pinsFn, labels = '', overlay = '', dy = 0) {
  const pins = P.map((p, i) => { const s = pinsFn(p, i); return pinMarkup(p, s.sc, s.on, s.glow, s.col); }).join('');
  return `<g>${A.decor.telephone}<g clip-path="url(#ecran)"><g transform="translate(0 ${dy})">${A.decor['carte-ville']}${pins}${labels}</g>${overlay}</g><rect x="-70" y="-474" width="140" height="30" rx="15" fill="#0b1330"/></g>`;
}
const FAC = (nom, e = 1, l = 1) => op(op(op(A.decor[nom], 'enseigne', e), 'lumiere', l), 'halo', l);
const NUIT = (nom, e, l, tx = 90, ty = 480) => A.decor['rue-nuit'] + `<g transform="translate(${tx} ${ty})">${FAC(nom, e, l)}</g>`;
const fogFrontR = (x0, t, top) => `<g transform="translate(1080 0) scale(-1 1)">${fogFront(1080 - x0, t, top)}</g>`;
function rayons(cx, cy, t, t0, n = 18, long = 1600) {
  if (t < t0) return '';
  const k = t - t0, o = Math.max(0, 0.7 * Math.exp(-k * 2.4)); let s = '';
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * 0.4, w = 0.07; s += `<polygon points="${cx},${cy} ${cx + Math.cos(a - w) * long},${cy + Math.sin(a - w) * long} ${cx + Math.cos(a + w) * long},${cy + Math.sin(a + w) * long}" fill="${COL.ambre}" opacity="${o.toFixed(3)}"/>`; }
  return s;
}
const reflets = pulse => [162, 238].map(x => `<circle cx="${x}" cy="184" r="19" fill="${RED}" opacity="${(0.28 + 0.2 * pulse).toFixed(2)}"/><g transform="translate(${x + 3} 190) scale(.3)"><path d="${PIN}" fill="${RED}"/></g>`).join('');
// Panneau de message (couleur au choix : bleu pour les messages de la carte, ambre pour la boulangère)
function messagePanelC(text, y0, nChars, col, taille = 40, largeur = 400) {
  ctx.font = `700 ${taille}px ${FONT}`;
  const lines = wrap(text, taille, largeur, 700), h = lines.length * (taille * 1.3) + 56;
  let reste = Math.max(0, Math.floor(nChars)), s = `<rect x="-238" y="${y0 - 56}" width="476" height="${h}" rx="26" fill="${COL.nuit}" opacity=".92" stroke="${col}" stroke-width="3"/>`;
  s += `<g transform="translate(-205 ${y0 - 10}) scale(.9)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="5.5" fill="#fff3d6"/></g>`;
  lines.forEach((l, i) => { const n = Math.min(l.length, reste); reste -= n; if (n > 0) s += `<text x="-160" y="${y0 + i * taille * 1.3}" font-family='${FONT}' font-weight="700" font-size="${taille}" fill="${col}">${esc(l.slice(0, n))}</text>`; });
  return s;
}
const arcs = (t, col) => [1, 2].map(i => { const o = Math.sin(t * 40 + i) > -0.2 ? 0.9 - i * 0.25 : 0.2; return `<path d="M${140 - i * 34} 330 Q${108 - i * 34} 380 ${140 - i * 34} 430 M${276 + i * 34} 330 Q${308 + i * 34} 380 ${276 + i * 34} 430" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" opacity="${o}"/>`; }).join('');
const lina = (nom, cx, feet, sc, o = {}) => `<g transform="translate(${cx} ${feet}) rotate(${o.rot || 0}) scale(${sc}) translate(-200 -608)">${A.lina[nom]}</g>`;
const doigt = (x, y) => `<g transform="translate(${x} ${y}) rotate(-18)"><rect x="-26" y="-6" width="52" height="150" rx="26" fill="#f2c7a0"/><rect x="-26" y="-6" width="52" height="34" rx="17" fill="#e6b48a"/></g>`;

// ---- 1 (0-3 s) : reprise exacte de la fin de l'épisode 1 (les yeux), puis zoom arrière : "47"
plan(3.0, t => {
  if (t < 1.2) {
    const S = lerp(7.0, 5.6, t / 1.2), pulse = 0.5 + 0.5 * Math.sin(t * 16), sx = Math.sin(t * 70) * 5, sy = Math.cos(t * 63) * 5;
    return `<rect width="${W}" height="${H}" fill="#14060a"/><g transform="translate(${540 + sx} ${960 + sy}) rotate(${-2 + t * 2}) scale(${S}) translate(-200 -184)">${A.hero['surpris-sans-telephone']}${reflets(pulse)}</g><rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.08 + 0.12 * pulse).toFixed(3)}"/>` + caption('47 commerces. Une seule nuit. Et je suis tout seul.', t, { t0: 0.3, hl: ['47', 'seul.'.replace('.', '')] });
  }
  const u = t - 1.2, b = Math.floor(t * 5) % 2;
  const pins = (p, i) => ({ sc: 1, on: 1, glow: ((i + b) % 2) ? 1 : 0.3, col: RED });
  const compteur = `<g transform="translate(0 -330)"><rect x="-170" y="-78" width="340" height="156" rx="40" fill="${COL.nuit}" opacity=".94" stroke="${RED}" stroke-width="7"/><text x="0" y="56" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="150" fill="${RED}">47</text></g>`;
  return fondNuit(t) + `<rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.08 + 0.05 * Math.sin(t * 12)).toFixed(3)}"/>` +
    phoneCam(phoneSceneP(PTS47, pins, '', compteur), u, 1.8, 2.7, 1.25, [0, -260], [0, 0], 900) + caption('47 commerces. Une seule nuit. Et je suis tout seul.', t, { t0: 0.3, hl: ['47', 'seul'] });
}, { cuts: [1.2], fx: t => flash(t, 1.2, 0.3) });

// ---- 2 (3-6 s) : trois flashs de l'épisode 1
plan(3.0, t => {
  let s; const grain = `<rect width="${W}" height="${H}" fill="#0a1a3d" opacity=".22"/><rect width="${W}" height="${H}" fill="url(#vig)" opacity=".7"/>`;
  if (t < 1.0) {                                           // la boulangerie avalée par la brume
    const level = easeIn(clamp(t / 0.9)), fac = op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', 0.9), 'halo', 0.9);
    s = cam(A.decor['rue-nuit'] + `<g transform="translate(90 480)">${fac}</g>` + fogBank(level * 0.95, t), t, 1.0, { z0: 1.1, z1: 1.3, f0: [540, 1000], f1: [540, 1040] });
  } else if (t < 2.0) {                                    // le compte à rebours à 00:01
    const u = t - 1.0, p = 1 + 0.08 * Math.sin(u * 20);
    s = `<rect width="${W}" height="${H}" fill="${COL.nuit}"/>${rayons(540, 900, u, 0, 16, 1500)}<g transform="translate(540 960) scale(${p}) translate(-540 -960)"><rect x="90" y="760" width="900" height="300" rx="60" fill="${COL.nuit}" opacity=".95" stroke="${COL.ambre}" stroke-width="10"/><text x="540" y="990" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="250" fill="${COL.ambre}">00:01</text></g>`;
  } else {                                                 // la boucherie se rallume
    const u = t - 2.0, ring = clamp(u * 1.2);
    s = cam(A.decor['rue-nuit'] + `<g transform="translate(90 480)">${FAC('boucherie-facade-nuit')}${A.decor['boucherie-vitre']}</g>` + rayons(800, 1260, u, 0, 18) +
      `<circle cx="800" cy="1260" r="${ring * 1300}" fill="none" stroke="${COL.ambre}" stroke-width="${50 * (1 - ring)}" opacity="${(1 - ring).toFixed(2)}"/>` + fogFrontR(lerp(700, 1800, easeIn(clamp(u / 0.9))), t, 1120), u, 1.0, { z0: 1.2, z1: 1.4, f0: [680, 1220], f1: [690, 1190] });
  }
  return s + grain + caption("Hier, pour sauver une seule boutique, il m'a fallu deux minutes.", t, { t0: 0.1, size: 62, hl: ['deux', 'minutes'] });
}, { cuts: [1.0, 2.0], fx: t => flash(t, 0.02, 0.35) });

// ---- 3 (6-10 s) : la carte pleine de points rouges
const LAB3 = PTS47.map((p, i) => 40 + ((i * 37) % 80));
plan(4.0, t => {
  if (t < 2.0) {
    const ph = t * t * 14, dy = 230 * Math.sin(ph), b = Math.floor(t * 6);
    const pins = (p, i) => ({ sc: 1, on: 1, glow: ((i + b) % 2) ? 1 : 0.3, col: RED });
    let lab = ''; PTS47.forEach((p, i) => { if (i % 3 === 0) lab += etiquette(p, mmss(LAB3[i] - t * 5), t + i * 0.1); });
    const f = doigt(70, 120 - dy * 0.5);
    return fondNuit(t) + `<rect width="${W}" height="${H}" fill="${RED}" opacity="0.07"/>` + phoneCam(phoneSceneP(PTS47, pins, lab, f, dy), t, 2.0, 1.55, 1.8, [0, 0], [0, 30], 960) + caption('Je ne peux pas être partout à la fois.', t, { t0: 0.2 });
  }
  const u = t - 2.0, pulse = 0.5 + 0.5 * Math.sin(t * 12);
  const glow = [175, 125, 82].map((r, i) => `<circle cx="208" cy="380" r="${r}" fill="${RED}" opacity="${((0.10 + i * 0.07) * (0.6 + 0.4 * pulse)).toFixed(3)}"/>`).join('');
  const s = A.decor['rue-nuit'] + `<rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.10 + 0.10 * pulse).toFixed(3)}"/>` + hero('surpris', 540, 1560, 1.5, { t, rot: Math.sin(t * 9) * 1.5, extra: glow });
  return cam(s, u, 2.0, { z0: 1.0, z1: 1.25, f0: [540, 1000], f1: [540, 1060], rot0: 2, rot1: -2, shake: 8 }) + caption('Je ne peux pas être partout à la fois.', t, { t0: 0.2 });
}, { cuts: [2.0] });

// ---- 4 (10-15 s) : l'échec devant la librairie
plan(5.0, t => {
  let corps;
  if (t < 2.0) {
    const xN = lerp(-150, 330, clamp(t / 1.0)), nom = t < 1.0 ? runName('essouffle-course', t, 8) : 'essouffle-sans-telephone';
    const e = lerp(1, 0.1, clamp((t - 0.9) / 0.9)), l = t < 0.9 ? 0.9 + 0.1 * Math.sin(t * 30) : lerp(0.9, 0, clamp((t - 0.9) / 0.8));
    const s = NUIT('librairie-facade-nuit', e, l) + hero(nom, xN, 1470, 1.1, { t, rot: t < 1.0 ? 5 : 0 }) + fogFrontR(lerp(1300, 560, easeOut(clamp((t - 0.3) / 1.5))), t, 1000);
    corps = cam(s, t, 2.0, { z0: 1.0, z1: 1.18, f0: [540, 1000], f1: [600, 1080], shake: t < 1 ? 8 : 3 });
  } else if (t < 3.5) {                                    // la main passe à travers le gris
    const u = t - 2.0, tip = lerp(500, 800, ease(clamp(u / 1.3)));
    let rid = ''; for (let i = 0; i < 3; i++) { const k = ((u * 1.4 + i / 3) % 1); rid += `<ellipse cx="640" cy="930" rx="${30 + k * 150}" ry="${60 + k * 260}" fill="none" stroke="#aab2c4" stroke-width="${10 * (1 - k)}" opacity="${(0.8 * (1 - k)).toFixed(2)}"/>`; }
    const s = `<rect width="${W}" height="${H}" fill="#4a526a"/><rect x="640" width="440" height="${H}" fill="#6b7388"/>` +
      `<rect x="-200" y="860" width="${tip - 200}" height="140" rx="60" fill="#1457d1"/><rect x="${tip - 260}" y="850" width="46" height="160" rx="18" fill="#f5a623"/><circle cx="${tip - 20}" cy="930" r="68" fill="#f2c7a0"/>` +
      `<rect x="640" y="0" width="440" height="${H}" fill="#6b7388" opacity="${(0.55 + 0.35 * clamp(u / 1.2)).toFixed(2)}"/>` + rid + `<ellipse cx="760" cy="930" rx="${60 + u * 90}" ry="${90 + u * 120}" fill="#aab2c4" opacity="0.6"/>`;
    corps = cam(s, u, 1.5, { z0: 1.0, z1: 1.2, f0: [540, 940], f1: [620, 940], shake: 7, clamp: false });
  } else {                                                 // le mur devient lisse, une seconde de silence
    const u = t - 3.5;
    const s = NUIT('librairie-facade-nuit', 0, 0).replace(/<g transform="translate\(90 480\)">[\s\S]*<\/g>$/, `<g transform="translate(90 480)">${A.decor['facade-mur-nuit']}</g>`) + hero('essouffle-sans-telephone', 330, 1470, 1.0, { t, rot: 8 }) + fogBank(0.05, t);
    corps = cam(s, u, 1.5, { z0: 1.0, z1: 1.1, f0: [540, 1000], f1: [540, 960] });
  }
  return corps + caption('Non... non, non, non.', t, { t0: 2.2, t1: 4.0 });
}, { cuts: [2.0, 3.5], fx: t => flash(t, 0.9, 0.3) });

// ---- 5 (15-19 s) : le Gris en haut du lampadaire
plan(4.0, t => {
  const sway = Math.sin(t * 1.3) * 1.2;
  const lampe = `<g transform="translate(560 ${560 - 236})"><clipPath id="lc"><rect x="0" y="0" width="400" height="${1380 - 324}"/></clipPath><g clip-path="url(#lc)">${A.decor['lampadaire-haut']}</g></g>`;
  const s = A.decor['rue-nuit'] + lampe + perso(A.gris.assis, 760, 560 + 36, 0.82, { t, rot: sway }) + hero('essouffle-sans-telephone', 300, 1470, 0.95, { t, rot: 4 }) + fogBank(0.05, t);
  const c = t < 1.5 ? { z0: 1.5, z1: 1.35, f0: [330, 1180], f1: [360, 1150] } : { z0: 1.0, z1: 1.45, f0: [700, 1000], f1: [700, 560] };
  return cam(s, t, 4.0, c) + caption('Tu comprends, maintenant ? Un seul Gardien, ça ne suffit pas.', t, { t0: 0.4, size: 62, col: GRIS_TXT, hl: ['Gardien,'] });
}, { cuts: [1.5], split: { at: 1.5, z: 1.5, f: [700, 620], f2: [690, 520], rot: 0 } });

// ---- 6 (19-25 s) : Lina
plan(6.0, t => {
  let corps;
  if (t < 1.2) {                                           // la vitrine de la fleuriste se rallume
    const on = t > 0.3 ? 1 : 0, fl = t < 0.3 ? 0 : 1;
    const s = NUIT('fleuriste-facade-nuit', fl, on * (0.9 + 0.1 * Math.sin(t * 40))) + rayons(800, 1260, t, 0.3, 18) + hero('essouffle-sans-telephone', 250, 1470, 0.95, { t, rot: 6 }) + fogFrontR(lerp(760, 1800, easeIn(clamp((t - 0.3) / 0.8))), t, 1100);
    corps = cam(s, t, 1.2, { z0: 1.05, z1: 1.3, f0: [640, 1180], f1: [680, 1200], shake: t > 0.3 ? 12 * Math.exp(-(t - 0.3) * 3) : 3 });
  } else if (t < 2.4) {                                    // Lina sort de la boutique avec un bouquet
    const u = t - 1.2, xL = lerp(800, 640, easeOut(clamp(u / 1.0)));
    const s = NUIT('fleuriste-facade-nuit', 1, 1) + `<g opacity="${clamp(u / 0.2)}">` + lina('bouquet-moqueuse', xL, 1470, 1.1) + '</g>';
    corps = cam(s, u, 1.2, { z0: 1.2, z1: 1.45, f0: [700, 1100], f1: [660, 1060] });
  } else if (t < 4.0) {                                    // Noé stupéfait
    const u = t - 2.4;
    corps = cam(A.decor['rue-nuit'] + `<rect width="${W}" height="${H}" fill="${COL.ambre}" opacity=".08"/>` + hero('surpris-sans-telephone', 540, 1500, 1.5, { t }), u, 1.6, { z0: 1.0, z1: 1.2, f0: [540, 1000], f1: [540, 1040] });
  } else {                                                 // les deux Gardiens côte à côte
    const u = t - 4.0, linaNom = u > 1.0 ? 'serieuse' : 'moqueuse';
    corps = cam(NUIT('fleuriste-facade-nuit', 1, 1) + hero('surpris-sans-telephone', 340, 1470, 1.15, { t }) + lina('bouquet-' + linaNom, 790, 1470, 1.15), u, 2.0, { z0: 1.0, z1: 1.2, f0: [540, 1000], f1: [580, 1060] });
  }
  return corps + caption("T'es nouveau, toi.", t, { t0: 1.15, t1: 2.4, col: LINA_TXT }) + caption('Tu... tu les vois aussi ?', t, { t0: 2.4, t1: 4.1 }) +
    caption("Depuis un an. Et on n'est pas que deux.", t, { t0: 4.1, col: LINA_TXT, hl: ['deux.'.replace('.', '')] });
}, { cuts: [1.2, 2.4, 4.0], fx: t => flash(t, 0.3, 0.6) });

// ---- 7 (25-31 s) : les autres Gardiens (points bleus qui se rendent aux points rouges)
const DEPART = PTS47.map((p, i) => { const a = i * 2.399, r = 330 + (i % 5) * 30; return { x: Math.cos(a) * r, y: Math.sin(a) * r * 1.4 }; });
const ARRIVEE = PTS47.map((p, i) => 0.4 + ((i * 53) % 100) / 100 * 3.1);
plan(6.0, t => {
  if (t < 2.0) {
    const s = A.decor['rue-nuit'] + `<rect width="${W}" height="${H}" fill="${COL.clair}" opacity="${(0.05 + 0.03 * Math.sin(t * 8)).toFixed(3)}"/>` + lina('tend-serieuse', 560, 1470, 1.25);
    return cam(s, t, 2.0, { z0: 1.0, z1: 1.55, f0: [540, 1000], f1: [820, 900] }) + caption("Chaque fois que quelqu'un pousse la porte d'un commerce, une lumière se rallume.", t, { t0: 0.3, size: 58, col: LINA_TXT, hl: ['lumière', 'rallume'] });
  }
  const u = t - 2.0, A_ = u;
  const pins = (p, i) => { const ok = A_ >= ARRIVEE[i]; return { sc: 1, on: 1, glow: ok ? 0.9 : ((Math.floor(t * 6) + i) % 2 ? 1 : 0.3), col: ok ? undefined : RED }; };
  let lab = '', dots = '';
  PTS47.forEach((p, i) => {
    const k = clamp(A_ / ARRIVEE[i]), q = ease(k), x = lerp(DEPART[i].x, p.x, q), y = lerp(DEPART[i].y, p.y - 30, q);
    if (k < 1) dots += `<circle cx="${x}" cy="${y}" r="26" fill="${COL.clair}" opacity=".25"/><circle cx="${x}" cy="${y}" r="11" fill="${COL.clair}" stroke="#fff" stroke-width="3"/>`;
    else if (A_ - ARRIVEE[i] < 0.6) { const r = (A_ - ARRIVEE[i]) / 0.6; dots += `<circle cx="${p.x}" cy="${p.y - 30}" r="${20 + r * 110}" fill="none" stroke="${COL.ambre}" stroke-width="${8 * (1 - r)}" opacity="${(1 - r).toFixed(2)}"/>`; }
    if (i % 4 === 0 && k < 1) lab += etiquette(p, mmss(LAB3[i] - A_ * 8), t + i * 0.1);
  });
  return fondNuit(t) + phoneCam(phoneSceneP(PTS47, pins, lab + dots), u, 4.0, 1.5, 2.0, [0, -60], [0, 40]) + caption("Chaque fois que quelqu'un pousse la porte d'un commerce, une lumière se rallume.", t, { t0: 0.3, size: 58, col: LINA_TXT, hl: ['lumière', 'rallume'] });
}, { cuts: [2.0], fx: t => flash(t, 2.0, 0.3) });

// ---- 8 (31-36 s) : la colère du Gris, la vague de brume
plan(5.0, t => {
  const monte = easeOut(clamp(t / 2.0));
  if (t < 2.5) {
    const s = A.decor['rue-nuit'] + `<g transform="translate(${-740 + Math.sin(t * 3) * 20} ${lerp(900, 80, monte)}) scale(1.1)">${A.decor['vague-brume']}</g>` + perso(A.gris.colere, 540, 1500, 1.35, { t, rot: Math.sin(t * 20) * 0.8 }) + fogBank(0.12 + 0.1 * monte, t);
    return cam(s, t, 2.5, { z0: 1.1, z1: 1.35, f0: [540, 1000], f1: [540, 860], rot0: -3, rot1: 3, shake: 14 }) + caption('Alors je vais les effacer... de vos souvenirs.', t, { t0: 0.5, col: GRIS_TXT, hl: ['effacer...'.replace('...', '')] });
  }
  const u = t - 2.5;
  const s = A.decor['rue-nuit'] + `<g transform="translate(${-1000 + Math.sin(t * 3) * 25} ${lerp(40, -40, u / 2.5)}) scale(1.35)">${A.decor['vague-brume']}</g>` +
    hero('surpris-sans-telephone', 280, 1470, 0.8, { t }) + lina('choquee', 460, 1470, 0.8) + fogBank(0.25, t);
  return cam(s, u, 2.5, { z0: 1.0, z1: 1.2, f0: [540, 960], f1: [540, 820], rot0: 3, rot1: -2, shake: 12 }) + caption('Alors je vais les effacer... de vos souvenirs.', t, { t0: 0.5, col: GRIS_TXT, hl: ['effacer'] });
}, { cuts: [2.5], fx: t => flash(t, 0.05, 0.4) });

// ---- 9 (36-41 s) : le message de la boulangère (en ambre)
const MSG9 = 'Noé. Ne m\'oublie pas.';
plan(5.0, t => {
  let corps;
  if (t < 1.2) {                                           // silence, le téléphone vibre
    const v = Math.sin(t * 60) * 2.5;
    const s = A.decor['rue-nuit'] + `<rect width="${W}" height="${H}" fill="#000" opacity=".25"/>` + hero('neutre', 540 + v, 1500, 1.4, { t, extra: arcs(t, COL.ambre) });
    corps = cam(s, t, 1.2, { z0: 1.0, z1: 1.25, f0: [540, 1000], f1: [540, 1080], shake: 5 });
  } else if (t < 3.2) {                                    // le message s'écrit, lettre par lettre, en ambre
    const u = t - 1.2, n = (u - 0.1) * 12;
    const pins = (p, i) => ({ sc: 1, on: 1, glow: 0.4 });
    const ov = `<rect x="-260" y="-480" width="520" height="960" fill="${COL.nuit}" opacity=".82"/>` + messagePanelC(MSG9, -30, n, COL.ambre, 46, 380);
    corps = fondNuit(t) + phoneCam(phoneSceneP(PTS, pins, '', ov), u, 2.0, 1.9, 2.1, [0, -30], [0, -10]);
  } else {                                                 // Noé murmure
    const u = t - 3.2;
    corps = cam(A.decor['rue-nuit'] + hero('surpris', 540, 1560, 1.5, { t }), u, 1.8, { z0: 1.1, z1: 1.45, f0: [540, 1000], f1: [540, 960] });
  }
  return corps + caption('Qui êtes-vous ?', t, { t0: 3.55, size: 76 });
}, { cuts: [1.2, 3.2] });

// ---- 10 (41-46 s) : la révélation, la boulangerie dans la brume
plan(5.0, t => {
  if (t < 2.2) {
    const u = t, flick = 0.8 + 0.2 * Math.sin(t * 17), wave = Math.sin(t * 9) * 12;
    const cp = clip('vitB', 154, 714, 402, 152, 6);
    let brume = ''; for (let i = 0; i < 12; i++) { const gauche = i < 6, cx = gauche ? -20 + i * 40 + Math.sin(t * 1.4 + i) * 30 : 760 + (i - 6) * 40 + Math.sin(t * 1.4 + i) * 30; brume += `<ellipse cx="${cx}" cy="${700 + (i % 3) * 80 + 30 * Math.sin(t * 1.1 + i)}" rx="130" ry="150" fill="${['#7c859b', '#aab2c4', '#5d667c'][i % 3]}" opacity=".9"/>`; }
    for (let i = 0; i < 8; i++) brume += `<ellipse cx="${40 + i * 120 + Math.sin(t * 1.2 + i) * 40}" cy="${960 + 20 * Math.sin(t * 1.1 + i)}" rx="150" ry="90" fill="${['#7c859b', '#aab2c4', '#5d667c'][i % 3]}"/>`;
    const image = `<g transform="translate(-248 -300) scale(.55)"><rect x="-60" y="60" width="1020" height="920" fill="#0a1634"/>${op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', 0.85), 'halo', 0.85)}${cp}
      <g clip-path="url(#vitB)"><g opacity="${flick.toFixed(2)}"><g transform="translate(${355 - 200 * 0.46} ${760 - 200 * 0.46}) scale(.46) rotate(${wave * 0.1} 200 400)">${A.boulangere.salue}</g></g></g>${brume}</g>`;
    const s = fondNuit(t) + phoneCam(`<g>${A.decor.telephone}<g clip-path="url(#ecran)"><rect x="-260" y="-480" width="520" height="960" fill="#0a1634"/>${image}<rect x="-260" y="-480" width="520" height="960" fill="${COL.ambre}" opacity=".05"/></g></g>`, u, 2.2, 1.55, 1.95, [0, 60], [0, 90], 960);
    return s;
  }
  const u = t - 2.2;
  const s = A.decor['rue-nuit'] + lina('choquee', 340, 1470, 1.25) + hero('surpris', 760, 1470, 1.1, { t });
  return cam(s, u, 2.8, { z0: 1.05, z1: 1.35, f0: [540, 1000], f1: [420, 1000], shake: 4 }) + caption("C'est impossible. Personne ne revient de l'Oubli.", t, { t0: 2.4, col: LINA_TXT, hl: ['impossible.'.replace('.', '')] });
}, { cuts: [2.2], fx: t => flash(t, 2.2, 0.4) });

// ---- 11 (46-49 s) : "Viens me chercher", puis coupure nette
const MSG11 = 'Je suis toujours là. Viens me chercher.';
plan(3.0, t => {
  if (t < 1.6) {
    const pins = (p, i) => ({ sc: 1, on: 1, glow: 0.4 });
    const ov = `<rect x="-260" y="-480" width="520" height="960" fill="${COL.nuit}" opacity=".82"/>` + messagePanelC(MSG11, -50, (t - 0.1) * 22, COL.ambre, 40, 380);
    return fondNuit(t) + phoneCam(phoneSceneP(PTS, pins, '', ov), t, 1.6, 1.9, 2.1, [0, -40], [0, -30]);
  }
  const u = t - 1.6, S = 2.6 + 2.6 * easeIn(u / 1.4), nom = u > 0.6 ? 'determine-sans-telephone' : 'surpris-sans-telephone', pulse = 0.5 + 0.5 * Math.sin(t * 14);
  return `<rect width="${W}" height="${H}" fill="#0a1634"/><g transform="translate(${540 + Math.sin(t * 70) * 4 * u} ${960 + Math.cos(t * 63) * 4 * u}) scale(${S}) translate(-200 -184)">${A.hero[nom]}</g>` +
    `<rect width="${W}" height="${H}" fill="${COL.ambre}" opacity="${(0.05 + 0.07 * pulse).toFixed(3)}"/>` + caption(MSG11, t, { t0: 1.7, size: 66, col: COL.ambre, hl: [] });
}, { cuts: [1.6] });

// ---- 12 (49-51 s) : écran noir
plan(2.0, t => `<rect width="${W}" height="${H}" fill="#000"/><g transform="translate(510 960) scale(${1 + 0.03 * t / 2}) translate(-510 -960)">` +
  caption('Suite au prochain épisode.', t, { size: 84, center: 900, t0: 0.05 }) +
  caption("Épisode 2 - Ne m'oublie pas", t, { size: 46, center: 1120, t0: 0.25, maxW: 780 }) + '</g>', { nocut: true });

// ---- 13 (51-53 s) : fin
plan(2.0, t => {
  const z = 1 + 0.05 * Math.sin(t * 2.0) + 0.04 * t, pulse = 1 + 0.06 * Math.sin(t * 6);
  const pin = `<g transform="translate(510 800) scale(${z})"><circle cx="0" cy="-200" r="${470 * pulse}" fill="${COL.bleu}" opacity=".16"/><circle cx="0" cy="-200" r="${340 * pulse}" fill="${COL.ambre}" opacity=".12"/><circle cx="0" cy="-200" r="${240 * pulse}" fill="${COL.ambre}" opacity=".16"/>
    <g transform="scale(8)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="7" fill="#fff3d6"/></g></g>`;
  return `<rect width="${W}" height="${H}" fill="${COL.nuit}"/>${etincelles(t, 16)}` + pin + caption('La carte existe vraiment. Lien en bio.', t, { size: 72, center: 1330, t0: 0.05, hl: ['vraiment.'.replace('.', '')] });
});

// ---------- rendu ----------
PLANS[2].fx = t => flash(t, 2.0, 0.3);
PLANS[10].fx = t => (t >= 1.5 && t < 1.7 ? flash(t, 1.6, 0.25) : '');
let _t0 = 0; PLANS.forEach(p => { p.t0 = _t0; _t0 += p.d; });
const TOTAL = Math.round(_t0 * FPS);
function render(f, guides) {
  const T = f / FPS;
  let i = PLANS.findIndex(p => T < p.t0 + p.d - 1e-6); if (i < 0) i = PLANS.length - 1;
  const P = PLANS[i], tl = T - P.t0;
  CURSPLIT = P.split || null;
  const coupes = (P.cuts || (P.split ? [P.split.at] : [])).filter(c => tl >= c);
  const tc = tl - (coupes.length ? Math.max(...coupes) : 0), k = clamp(tc / 0.16);
  const punch = P.nocut ? 1 : 1 + 0.09 * (1 - easeOut(k));
  const cut = P.nocut ? '' : `<rect width="${W}" height="${H}" fill="#fff" opacity="${(0.2 * (1 - k) * (1 - k)).toFixed(3)}"/>`;
  const g = guides ? `<g fill="#ff0000" opacity=".25"><rect x="940" y="0" width="140" height="1920"/><rect x="0" y="1670" width="1080" height="250"/></g>` : '';
  document.getElementById('c').innerHTML = `<g transform="translate(540 960) scale(${punch}) translate(-540 -960)">${P.fn(tl)}</g>${cut}${P.fx ? P.fx(tl) : ''}` + g;
  return i;
}
window.STILLS = [[1, 0.6], [1, 2.2], [2, 0.7], [2, 1.5], [2, 2.5], [3, 1.2], [3, 3.0], [4, 1.5], [4, 2.8], [4, 4.3], [5, 0.8], [5, 3.0], [6, 0.8], [6, 1.9], [6, 3.2], [6, 5.0], [7, 1.2], [7, 4.5], [8, 1.5], [8, 3.5], [9, 0.8], [9, 2.4], [9, 4.2], [10, 1.2], [10, 3.8], [11, 0.9], [11, 2.4], [12, 1.2], [13, 1.0]];
window.render = render; window.PLANS = PLANS; window.TOTAL = TOTAL;
