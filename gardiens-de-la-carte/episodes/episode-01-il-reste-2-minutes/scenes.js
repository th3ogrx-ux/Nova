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

// ---------- Les 14 plans ----------
const PLANS = [];
const plan = (d, fn, extra = {}) => PLANS.push({ d, fn, ...extra });
const WALL = () => A.decor['rue-jour'] + `<g transform="translate(90 480)">${A.decor['facade-mur-jour']}</g>`;
const arcsTel = (t, col = COL.clair) => [1, 2].map(i => { const o = Math.sin(t * 40 + i) > -0.2 ? 0.9 - i * 0.25 : 0.2; return `<path d="M${140 - i * 34} 330 Q${108 - i * 34} 380 ${140 - i * 34} 430 M${276 + i * 34} 330 Q${308 + i * 34} 380 ${276 + i * 34} 430" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" opacity="${o}"/>`; }).join('');

// 1 (0-3 s) : en pleine action
plan(3.0, t => sceneP1(t) + caption("Si les lumières s'éteignent derrière toi... cours.", t, { t0: 0.3, hl: ['cours'] }));

// 2 (3-4 s) : image figée puis rembobinage
plan(1.0, t => {
  const tt = t < 0.3 ? 2.95 : 2.95 * (1 - ease(clamp((t - 0.3) / 0.7)));
  let bands = '';
  const fr = Math.floor(t * 30);
  for (let k = 0; k < 6; k++) {
    const y = (k * 317 + fr * 131) % 1700 + 60, h = 60 + ((k * 53 + fr * 17) % 90), dx = Math.sin(t * 40 + k * 9) * 55;
    bands += `<clipPath id="rb${k}"><rect x="0" y="${y}" width="1080" height="${h}"/></clipPath><use href="#rw" clip-path="url(#rb${k})" transform="translate(${dx.toFixed(1)} 0)"/>`;
  }
  let scan = ''; for (let y = 0; y < 1920; y += 8) scan += `<rect y="${y}" width="1080" height="3" fill="#000"/>`;
  const rew = t > 0.3 ? `<g fill="#fff" opacity=".9"><polygon points="130,330 80,360 130,390"/><polygon points="190,330 140,360 190,390"/></g>` : '';
  return `<defs><g id="rw">${sceneP1(tt)}</g></defs><use href="#rw"/>${bands}<use href="#rw" opacity=".25" transform="translate(14 0)" style="mix-blend-mode:screen"/><g opacity=".16">${scan}</g>${rew}` +
    caption('3 heures plus tôt', t, { t0: 0.4, size: 88, center: 1000, hl: ['heures'] });
}, { nocut: true });

// 3 (4-9 s) : le mur gris et le passant
plan(5.0, t => {
  const parle = t > 2.7 && Math.floor(t * 5) % 2 === 0;
  const sc = WALL() + hero('surpris-sans-telephone', 330, 1450, 1.1, { t }) + perso(parle ? A.passant.parle : A.passant.neutre, 735, 1450, 1.05, { t });
  return cam(sc, t, 5, { z0: 1.0, z1: 1.1, f0: [540, 960], f1: [480, 1000] }) + caption('Elle était là hier. La boulangerie.', t, { t0: 0.1, t1: 2.5, hl: ['hier'] }) +
    bubble("Quelle boulangerie ? Il n'y a jamais rien eu ici.", t, 2.6, { by: 330, tailX: 730 });
}, { split: { at: 2.5, z: 1.9, f: [735, 1000], rot: -2 } });

// 4 (9-13 s) : le téléphone s'allume et vibre, la carte, le compte à rebours
const MSG4 = "Elle va s'éteindre. Toi seul peux la sauver.";
plan(4.0, t => {
  if (t < 1.2) {
    const v = Math.sin(t * 70) * 3;
    const sc = WALL() + hero('surpris', 420, 1450, 1.35, { t, rot: v * 0.4, extra: arcsTel(t) });
    return cam(sc, t, 1.2, { z0: 1.0, z1: 1.3, f0: [540, 980], f1: [450, 1080], shake: 9 });
  }
  const u = t - 1.2, A_ = PTS[idxOf('A')];
  const pins = (p, i) => ({ sc: 1, on: 1, glow: 0.85 + 0.15 * Math.sin(t * 5 + i), col: p.id === 'A' ? RED : undefined });
  const fin = etiquette(A_, '02:00', t) + messagePanel(MSG4, 150, (u - 0.05) * 17.5);
  return fondNuit(t) + phoneCam(phoneScene(pins, fin), u, 2.8, 1.9, 2.4, [-30, 120], [-30, 70]) + caption('Quoi ?', t, { t0: 3.65 });
}, { cuts: [1.2] });

// 5 (13-15 s) : 01:59, Noé range le téléphone et part en courant
plan(2.0, t => {
  let corps;
  if (t < 1.0) {
    const A_ = PTS[idxOf('A')];
    const pins = (p, i) => ({ sc: 1, on: 1, glow: 0.85, col: p.id === 'A' ? RED : undefined });
    corps = fondNuit(t) + phoneCam(phoneScene(pins, etiquette(A_, '01:59', t, 1.5)), t, 1.0, 3.0, 3.5, [-30, 60], [-30, 50]);
  } else {
    const u = t - 1.0, c = clamp((u - 0.35) / 0.65);
    const nom = u < 0.35 ? 'determine' : runName('determine-course', t, 8);
    corps = cam(WALL() + hero(nom, 420 + 1500 * easeIn(c), 1450, 1.2, { t, rot: u < 0.35 ? 0 : 5 }), u, 1.0, { z0: 1.05, z1: 1.0, f0: [540, 980], f1: [700, 980], shake: 8 });
  }
  return corps + caption("OK. OK. J'y vais.", t, { t0: 0.5 });
}, { cuts: [1.0] });

// ---------- Plan 6 : la course (4 plans courts de 2 s) ----------
function miniCarte(prog, t) {
  const rx = lerp(-190, -30, prog), ry = lerp(-380, 90, prog), b = Math.floor(t * 4) % 2 === 0;
  return `<g transform="translate(40 330)">${clip('mini', 0, 0, 210, 330, 26)}
    <rect width="210" height="330" rx="26" fill="${COL.nuit}" stroke="${COL.clair}" stroke-width="5"/>
    <g clip-path="url(#mini)"><g transform="translate(105 165) scale(.36)">${A.decor['carte-ville']}
      <circle cx="${rx}" cy="${ry}" r="${b ? 26 : 20}" fill="${RED}"/><circle cx="${rx}" cy="${ry}" r="46" fill="${RED}" opacity=".25"/>
      <circle cx="0" cy="0" r="16" fill="${COL.clair}" stroke="#fff" stroke-width="5"/></g></g>
    <rect width="210" height="330" rx="26" fill="none" stroke="${COL.clair}" stroke-width="5"/></g>`;
}
function tentacule(gx, gy, vers, haut, t, i) {
  const dx = clamp((vers - gx) / 400, -1, 1) * 160, h = haut * (150 + 40 * Math.sin(t * 5 + i));
  const x1 = gx + dx * 0.4 + Math.sin(t * 4 + i) * 22, y1 = gy - h * 0.55, x2 = gx + dx + Math.sin(t * 6 + i) * 18, y2 = gy - h;
  return `<path d="M${gx} ${gy} C${gx} ${y1} ${x1} ${y1} ${x2} ${y2}" fill="none" stroke="#7c859b" stroke-width="40" stroke-linecap="round"/><path d="M${gx} ${gy} C${gx} ${y1} ${x1} ${y1} ${x2} ${y2}" fill="none" stroke="#aab2c4" stroke-width="22" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="26" fill="#aab2c4"/>`;
}
function rideau(x, w, yb) {
  let s = `<rect x="${x - 30}" y="420" width="${w + 60}" height="50" fill="#10214f"/><rect x="${x}" y="470" width="${w}" height="${GROUND - 470}" fill="#0a1330"/>`;
  s += `<rect x="${x}" y="470" width="${w}" height="${yb - 470}" fill="${COL.gris}"/>`;
  for (let y = 490; y < yb - 20; y += 28) s += `<rect x="${x}" y="${y}" width="${w}" height="5" fill="#6b7388"/>`;
  return s + `<rect x="${x - 8}" y="${yb - 24}" width="${w + 16}" height="26" rx="8" fill="#4a526a"/>`;
}
const cd6 = u => u < 4 ? 80 - u : 47 - (u - 4) * 0.5;
plan(8.0, t => {
  const sec = cd6(t), u = t % 2;
  let corps = '';
  if (t < 2) {              // 6a : traversée de la place, mini-carte
    const xN = lerp(150, 760, u / 2), camX = t * 320, bob = Math.abs(Math.sin(t * 14)) * 20;
    let s = A.decor['rue-nuit'] + lampadaires(camX) + poussiere(xN, 1470, t) + hero(runName('determine-course', t, 7), xN, 1470 - bob, 1.1, { t, rot: 5 });
    corps = cam(s, t, 2, { z0: 1.12, z1: 1.28, f0: [540, 1000], f1: [580, 1000], rot0: 2, rot1: -2, shake: 9 }) + miniCarte(t / 8, t);
  } else if (t < 4) {       // 6b : les filets de brume sortent des bouches d'égout
    const hop = u > 0.9 && u < 1.5 ? 190 * Math.sin(Math.PI * (u - 0.9) / 0.6) : 0, camX = u * 400;
    let s = A.decor['rue-nuit'], tent = '';
    for (let i = -1; i < 5; i++) {
      const gx = i * 520 + 200 - (camX % 520) + 520, h = clamp(1 - Math.abs(gx - 540) / 520) + 0.15;
      s += `<ellipse cx="${gx}" cy="1500" rx="86" ry="16" fill="#050a1c"/><rect x="${gx - 60}" y="1496" width="120" height="6" fill="#18255a"/>`;
      tent += tentacule(gx, 1500, 540, h * (0.6 + 0.4 * clamp(u / 1.0)), t, i);
    }
    s += tent + hero(runName('determine-course', t, 8), 540, 1450 - hop - Math.abs(Math.sin(t * 16)) * 14, 1.25, { t, rot: hop ? -8 : 4 });
    corps = cam(s, u, 2, { z0: 1.25, z1: 1.4, f0: [540, 1180], f1: [540, 1230], rot0: -3, rot1: 3, shake: 14 });
  } else if (t < 6) {       // 6c : le rideau métallique
    const yb = u < 1.5 ? lerp(520, 1090, easeOut(clamp(u / 0.9))) : lerp(1090, GROUND, easeIn(clamp((u - 1.5) / 0.4)));
    const x = 700, w = 340, bob = Math.abs(Math.sin(t * 14)) * 16;
    let s = A.decor['rue-nuit'] + `<g transform="translate(-60 ${1380 - 760 * 0.7}) scale(.7)">${op(op(A.decor['vitrine-coin'], 'lumiere', 0.9), 'halo', 0.9)}</g>`;
    const glisse = u > 0.7;
    const xN = glisse ? lerp(520, 1010, clamp((u - 0.7) / 0.8)) : lerp(120, 520, u / 0.7);
    s += rideau(x, w, yb);
    const hn = glisse ? hero('determine-course-a', xN, 1330, 0.62, { t, rot: -85 }) : hero(runName('determine-course', t, 8), xN, 1470 - bob, 1.1, { t, rot: 5 });
    s = A.decor['rue-nuit'] + `<g transform="translate(-60 ${1380 - 760 * 0.7}) scale(.7)">${op(op(A.decor['vitrine-coin'], 'lumiere', 0.9), 'halo', 0.9)}</g>` + `<rect x="${x}" y="470" width="${w}" height="${GROUND - 470}" fill="#0a1330"/>` + hn + rideau(x, w, yb).replace(`<rect x="${x}" y="470" width="${w}" height="${GROUND - 470}" fill="#0a1330"/>`, '');
    if (u > 1.5 && u < 2) s += `<ellipse cx="${x + w / 2}" cy="1390" rx="${200 * clamp((u - 1.5) / 0.3)}" ry="${40 * clamp((u - 1.5) / 0.3)}" fill="${COL.gris}" opacity="${(0.5 * (1 - (u - 1.5) / 0.5)).toFixed(2)}"/>`;
    corps = cam(s, u, 2, { z0: 1.15, z1: 1.3, f0: [440, 1000], f1: [760, 1080], rot0: 0, rot1: 4, shake: u > 1.5 ? 16 * Math.exp(-(u - 1.5) * 6) : 7 });
  } else {                  // 6d : deux vitrines s'éteignent d'un coup
    const o1 = u < 0.6 ? 1 : 0, o2 = u < 1.1 ? 1 : 0;
    const f = (o, t0) => (u > t0 - 0.2 && u < t0 ? (Math.sin(t * 60) > 0 ? 1 : 0.2) : o);
    let s = A.decor['rue-nuit'] +
      `<g transform="translate(-170 ${1380 - 760 * 0.85}) scale(.85)">${op(op(A.decor['vitrine-coin'], 'lumiere', f(o1, 0.6)), 'halo', f(o1, 0.6))}</g>` +
      `<g transform="translate(560 ${1380 - 900 * 0.62}) scale(.62)">${op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', f(o2, 1.1)), 'halo', f(o2, 1.1))}</g>` +
      hero(runName('determine-course', t, 8), 540, 1470 - Math.abs(Math.sin(t * 16)) * 18, 1.3, { t, rot: 3 }) + fogBank(0.04, t);
    corps = cam(s, u, 2, { z0: 1.0, z1: 1.18, f0: [540, 1000], f1: [540, 1060], rot0: -2, rot1: 2, shake: 8 });
  }
  return corps + hud(sec, t);
}, { cuts: [2, 4, 6], fx: t => (t >= 0.6 && t < 0.6 + 0.07 ? '' : '') + (t > 6.5 ? flash(t, 6.6, 0.25) + flash(t, 7.1, 0.25) : '') + (t >= 5.5 ? flash(t, 5.5, 0.3) : '') });

// 7 (23-28 s) : le Gris
plan(5.0, t => {
  if (t < 1.0) {
    const xN = t < 0.5 ? lerp(1000, 540, easeOut(t / 0.5)) : 540;
    const nom = t < 0.5 ? runName('determine-course', t, 9) : 'surpris-sans-telephone';
    const s = A.decor['rue-nuit'] + (t < 0.7 ? poussiere(xN, 1470, t, 6) : '') + hero(nom, xN, 1470, 1.15, { t, rot: t < 0.5 ? 6 : 0 });
    return cam(s, t, 1.0, { z0: 1.1, z1: 1.3, f0: [540, 1000], f1: [540, 980], shake: t > 0.5 ? 16 * Math.exp(-(t - 0.5) * 6) : 6 });
  }
  const u = t - 1.0, parle = u > 0.4 && u < 2.65 && Math.floor(u * 4) % 2 === 0;
  let brume = '';
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + t * (0.6 + (i % 3) * 0.2), r = 230 + (i % 4) * 45; brume += `<ellipse cx="${730 + Math.cos(a) * r}" cy="${560 + Math.sin(a) * r * 0.55}" rx="${70 + (i % 3) * 20}" ry="${46 + (i % 2) * 18}" fill="${['#5d667c', '#7c859b', '#aab2c4'][i % 3]}" opacity=".75"/>`; }
  const runs = u > 3.0 ? hero(runName('determine-course', t, 8), 250 + 1300 * easeIn(clamp((u - 3.0) / 1.0)), 1470, 0.8, { t, rot: 5 }) : hero('surpris-sans-telephone', 250, 1470, 0.8, { t });
  const s = A.decor['rue-nuit'] + A.decor['toit-nuit'] + brume + perso(parle ? A.gris.parle : A.gris.neutre, 735, 770, 1.05, { t }) + runs;
  return cam(s, u, 4.0, { z0: 1.0, z1: 1.45, f0: [700, 800], f1: [720, 640] });
}, { cuts: [1.0], fx: t => (t >= 0.55 && t < 1.0 ? flash(t, 0.55, 0.3) : '') });

// 8 (28-33 s) : la boucherie, la brume, le boucher qui s'efface
const FACB = (t, enseigne, lum) => op(op(op(A.decor['boucherie-facade-nuit'], 'enseigne', enseigne), 'lumiere', lum), 'halo', lum);
function boucherieVue(t, enseigne, lum, opBoucher, face) {
  const cp = clip('vit', 134, 694, 442, 182, 6);
  return `<g transform="translate(90 480)">${FACB(t, enseigne, lum)}${cp}<g clip-path="url(#vit)"><g transform="translate(${355 - 200 * 0.42} ${745 - 176 * 0.42}) scale(.42)" opacity="${opBoucher.toFixed(3)}">${A.boucher[face]}</g></g>${A.decor['boucherie-vitre']}</g>`;
}
const cd8 = t => Math.max(1, 10 - Math.floor(Math.max(0, t) / 0.75));
plan(5.0, t => {
  const cdv = cd8(t);
  let corps;
  if (t < 2.5) {
    const xN = lerp(-150, 330, clamp(t / 1.1)), nom = t < 1.1 ? runName('essouffle-course', t, 8) : 'essouffle-sans-telephone';
    const ens = lerp(1, 0.25, clamp((t - 0.4) / 2.0)), lum = 0.9 + 0.1 * Math.sin(t * 30);
    let s = A.decor['rue-nuit'] + boucherieVue(t, ens, lum, 1, 'inquiet') + hero(nom, xN, 1470, 1.1, { t, rot: t < 1.1 ? 5 : 0 });
    s += fogFrontR(lerp(1250, 700, easeOut(clamp(t / 2.2))), t, 1120);
    corps = cam(s, t, 2.5, { z0: 1.0, z1: 1.2, f0: [540, 1000], f1: [620, 1080], shake: t < 1.1 ? 8 : 3 });
  } else {
    const u = t - 2.5, vis = lerp(0.65, 0.18, clamp(u / 2.4)) * (Math.sin(u * 25) > -0.6 ? 1 : 0.4);
    let s = A.decor['rue-nuit'] + boucherieVue(t, lerp(1, 0.15, clamp(u / 1.5)), 0.85 + 0.15 * Math.sin(t * 30), vis, 'inquiet') + fogFrontR(lerp(900, 640, clamp(u / 2.5)), t, 1180);
    corps = cam(s, u, 2.5, { z0: 2.2, z1: 2.5, f0: [435, 1225], f1: [450, 1215], rot0: -2, rot1: 2, shake: 5 });
  }
  return corps + hud(cdv, t, { rouge: true });
}, { cuts: [2.5] });
function fogFrontR(x0, t, top) { return `<g transform="translate(1080 0) scale(-1 1)">${fogFront(1080 - x0, t, top)}</g>`; }

// 9 (33-39 s) : le sauvetage
const INT_B = (t, op_, face, hero_) => A.decor['boucherie-interieur'] + perso(A.boucher[face], 770, 1325, 1.05, { t }).replace('<g ', `<g opacity="${op_.toFixed(3)}" `) + A.decor['boucherie-comptoir'] + hero_;
function rayons(cx, cy, t, t0, n = 18, long = 1600) {
  if (t < t0) return '';
  const k = t - t0, op_ = Math.max(0, 0.7 * Math.exp(-k * 2.4)); let s = '';
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + k * 0.4, w = 0.07; s += `<polygon points="${cx},${cy} ${cx + Math.cos(a - w) * long},${cy + Math.sin(a - w) * long} ${cx + Math.cos(a + w) * long},${cy + Math.sin(a + w) * long}" fill="${COL.ambre}" opacity="${op_.toFixed(3)}"/>`; }
  return s;
}
plan(6.0, t => {
  const cdv = t < 2.7 ? Math.max(1, 3 - Math.floor(t / 0.8)) : 1;
  let corps = '', showHud = t < 3.5;
  if (t < 2.0) {            // 9a : Noé pousse la porte à travers la brume
    const open = ease(clamp((t - 0.7) / 0.7)), xN = lerp(430, 770, ease(clamp(t / 1.3)));
    const door = `<rect x="636" y="676" width="148" height="224" fill="#1a0d12"/><g transform="translate(636 0) scale(${1 - open * 0.85} 1) translate(-636 0)"><rect x="636" y="676" width="148" height="224" fill="${COL.ambre}"/></g>`;
    const fac = `<g transform="translate(90 480)">${FACB(t, 0.4, 0.9)}${door}</g>`;
    const nH = t > 1.4 ? lerp(1, 0, clamp((t - 1.4) / 0.4)) : 1;
    let s = A.decor['rue-nuit'] + fac + `<g opacity="${nH.toFixed(2)}">` + hero(t < 1.3 ? runName('determine-course', t, 6) : 'determine-sans-telephone', xN, 1470, 1.1 - 0.15 * clamp((t - 1.3) / 0.5), { t, rot: 3 }) + '</g>' + fogFrontR(lerp(760, 700, clamp(t / 2)), t, 1120);
    corps = cam(s, t, 2.0, { z0: 1.05, z1: 1.35, f0: [640, 1180], f1: [690, 1260], rot0: 2, rot1: -2, shake: 8 });
  } else if (t < 3.5) {     // 9b : à l'intérieur, le boucher redevient net
    const u = t - 2.0, vis = clamp((u - 0.2) / 1.0), flick = u < 1.2 ? (Math.sin(u * 40) > -0.5 ? 1 : 0.5) : 1;
    const face = u > 1.2 ? 'content' : 'inquiet';
    const s = INT_B(t, 0.25 + 0.75 * vis * flick, face, hero('surpris-sans-telephone', 250, 1400, 1.1, { t }));
    corps = cam(s, u, 1.5, { z0: 1.0, z1: 1.15, f0: [540, 1000], f1: [520, 1020], shake: 5 });
  } else if (t < 4.5) {     // 9c : l'explosion de lumière repousse la brume
    const u = t - 3.5;
    let ring = ''; for (let i = 0; i < 3; i++) { const k = clamp(u * 1.4 - i * 0.18); ring += `<circle cx="800" cy="1260" r="${k * 1500}" fill="none" stroke="${COL.ambre}" stroke-width="${60 * (1 - k)}" opacity="${(1 - k).toFixed(2)}"/>`; }
    const s = A.decor['rue-nuit'] + `<g transform="translate(90 480)">${FACB(t, 1, 1)}${A.decor['boucherie-vitre']}</g>` + `<circle cx="800" cy="1260" r="${300 + u * 900}" fill="${COL.ambre}" opacity="${(0.5 * (1 - u)).toFixed(2)}"/>` + ring + rayons(800, 1260, u, 0, 20) + fogFrontR(lerp(700, 1900, easeIn(clamp(u / 0.9))), t, 1120);
    corps = cam(s, u, 1.0, { z0: 1.2, z1: 1.5, f0: [680, 1220], f1: [690, 1180], shake: 14 * Math.exp(-u * 3) });
  } else {                  // 9d : le boucher sourit
    const u = t - 4.5;
    let spark = etincelles(t, 20);
    const s = INT_B(t, 1, 'content', '') + rayons(770, 900, u, 0, 16, 1500) + spark;
    corps = cam(s, u, 1.5, { z0: 1.25, z1: 1.5, f0: [760, 1020], f1: [760, 980], rot0: -2, rot1: 1 });
  }
  return corps + (showHud ? hud(cdv, t, { rouge: t < 2.7 }) : '') +
    caption("Bonjour ! Je voudrais deux steaks, s'il vous plaît !", t, { t0: 0.9, t1: 3.4, hl: ['steaks,'] }) +
    bubble("Ça fait longtemps qu'on n'avait pas vu de nouveau client, ici.", t, 3.5, { by: 330, tailX: 720 });
}, { cuts: [2.0, 3.5, 4.5], fx: t => flash(t, 2.9, 0.5) + flash(t, 3.5, 0.6) });

// 10 (39-43 s) : soulagement, la lumière revient sur la carte
plan(4.0, t => {
  let corps;
  if (t < 2.0) {
    const respire = Math.sin(t * 7) * 0.02, nom = t < 1.3 ? 'essouffle-sans-telephone' : 'content-sans-telephone';
    const s = A.decor['rue-nuit'] + `<g transform="translate(90 480)">${FACB(t, 1, 1)}${A.decor['boucherie-vitre']}</g>` + etincelles(t, 14) + hero(nom, 430, 1470, 1.1 * (1 + respire), { t, rot: t < 1.3 ? 10 : 0 });
    corps = cam(s, t, 2.0, { z0: 1.0, z1: 1.18, f0: [540, 1000], f1: [520, 1050] });
  } else {
    const u = t - 2.0, A_ = PTS[idxOf('A')];
    const pins = (p, i) => ({ sc: 1, on: 1, glow: 0.85 + 0.15 * Math.sin(t * 5 + i) });
    let anneaux = ''; for (let i = 0; i < 3; i++) { const k = ((u * 1.2 + i / 3) % 1); anneaux += `<circle cx="${A_.x}" cy="${A_.y - 30}" r="${20 + k * 150}" fill="none" stroke="${COL.ambre}" stroke-width="${8 * (1 - k)}" opacity="${(1 - k).toFixed(2)}"/>`; }
    corps = fondNuit(t) + phoneCam(phoneScene(pins, anneaux), u, 2.0, 2.2, 2.6, [-30, 70], [-30, 60]);
  }
  return corps + caption("Il suffisait... que quelqu'un vienne.", t, { t0: 0.9, hl: ["quelqu'un"] });
}, { cuts: [2.0], fx: t => flash(t, 1.3, 0.3) });

// 11 (43-49 s) : le retournement
const REDS = PTS.map((p, i) => p.id !== 'A' && (i * 7) % 3 !== 0);
const LABELS = ['01:48', '02:00', '00:55', '01:20', '00:30', '01:05', '00:42', '01:33'];
plan(6.0, t => {
  let corps, cap = '';
  if (t < 2.5) {
    const v = Math.sin(t * 80) * 3, pulse = 0.5 + 0.5 * Math.sin(t * 14);
    const glow = [175, 125, 82].map((r, i) => `<circle cx="208" cy="380" r="${r}" fill="${RED}" opacity="${((0.10 + i * 0.07) * (0.6 + 0.4 * pulse)).toFixed(3)}"/>`).join('');
    const s = A.decor['rue-nuit'] + `<rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.10 + 0.12 * pulse).toFixed(3)}"/>` + hero('surpris', 540 + v, 1560, 1.5, { t, rot: v * 0.3, extra: glow + arcsTel(t, RED) });
    corps = cam(s, t, 2.5, { z0: 1.0, z1: 1.25, f0: [540, 1000], f1: [540, 1060], rot0: -3, rot1: 3, shake: 12 });
    cap = caption('Ha... ha... ha...', t, { t0: 0.4, t1: 1.9, col: GRIS_TXT, size: 70 });
  } else {
    const u = t - 2.5;
    const pins = (p, i) => {
      const rouge = REDS[i], ph = Math.sin(t * 8 + i * 1.7) > -0.2;
      return { sc: popScale(u, 0.05 + (i % 10) * 0.06), on: 1, glow: ph ? 1 : 0.2, col: rouge ? RED : undefined };
    };
    let lab = ''; PTS.forEach((p, i) => { if (REDS[i] && i % 5 === 0) lab += etiquette(p, LABELS[(i / 5 | 0) % LABELS.length], t + i * 0.1); });
    corps = fondNuit(t) + `<rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.06 + 0.06 * Math.sin(t * 9)).toFixed(3)}"/>` + phoneCam(phoneScene(pins, lab), u, 3.5, 1.35, 1.9, [0, 20], [-20, 60]);
  }
  return corps + cap + caption("Ce n'était que la première.", t, { t0: 2.0, t1: 3.75, col: GRIS_TXT, hl: ['première.'] }) + caption('Il y en a... combien ?', t, { t0: 3.8, hl: ['combien'] });
}, { cuts: [2.5], fx: t => flash(t, 0.05, 0.4) });

// 12 (49-51 s) : les yeux de Noé, reflet rouge, coupure nette au milieu du mouvement
plan(2.0, t => {
  const S = 3.4 + 3.6 * easeIn(t / 2), pulse = 0.5 + 0.5 * Math.sin(t * 16), sx = Math.sin(t * 70) * 6 * t, sy = Math.cos(t * 63) * 6 * t;
  const reflets = [162, 238].map(x => `<circle cx="${x}" cy="184" r="19" fill="${RED}" opacity="${(0.28 + 0.2 * pulse).toFixed(2)}"/><g transform="translate(${x + 3} ${190}) scale(.3)"><path d="${PIN}" fill="${RED}"/></g>`).join('');
  return `<rect width="${W}" height="${H}" fill="#14060a"/><g transform="translate(${540 + sx} ${960 + sy}) rotate(${-4 + t * 4}) scale(${S}) translate(-200 -184)">${A.hero['surpris-sans-telephone']}${reflets}</g>` +
    `<rect width="${W}" height="${H}" fill="${RED}" opacity="${(0.08 + 0.12 * pulse).toFixed(3)}"/>`;
}, { nocut: false });

// 13 (51-53 s) : écran noir
plan(2.0, t => `<rect width="${W}" height="${H}" fill="#000"/><g transform="translate(510 960) scale(${1 + 0.03 * t / 2}) translate(-510 -960)">` +
  caption('Suite au prochain épisode.', t, { size: 84, center: 900, t0: 0.05 }) +
  caption('Épisode 1 - Il reste 2 minutes', t, { size: 46, center: 1120, t0: 0.25, maxW: 780 }) + '</g>', { nocut: true });

// 14 (53-55 s) : fin
plan(2.0, t => {
  const z = 1 + 0.05 * Math.sin(t * 2.0) + 0.04 * t, pulse = 1 + 0.06 * Math.sin(t * 6);
  const pin = `<g transform="translate(510 800) scale(${z})"><circle cx="0" cy="-200" r="${470 * pulse}" fill="${COL.bleu}" opacity=".16"/><circle cx="0" cy="-200" r="${340 * pulse}" fill="${COL.ambre}" opacity=".12"/><circle cx="0" cy="-200" r="${240 * pulse}" fill="${COL.ambre}" opacity=".16"/>
    <g transform="scale(8)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="7" fill="#fff3d6"/></g></g>`;
  return `<rect width="${W}" height="${H}" fill="${COL.nuit}"/>${etincelles(t, 16)}` + pin + caption('La carte existe vraiment. Lien en bio.', t, { size: 72, center: 1330, t0: 0.05, hl: ['vraiment.'] });
});

// ---------- effets d'impact par plan (flash, lignes de vitesse) ----------
PLANS[2].fx = t => flash(t, 2.5, 0.25);
PLANS[3].fx = t => flash(t, 0.05, 0.5);
PLANS[4].fx = t => flash(t, 1.0, 0.3);
PLANS[0].fx = t => flash(t, 0.02, 0.35);

let _t0 = 0; PLANS.forEach(p => { p.t0 = _t0; _t0 += p.d; });
const TOTAL = Math.round(_t0 * FPS);
function render(f, guides) {
  const T = f / FPS;
  let i = PLANS.findIndex(p => T < p.t0 + p.d - 1e-6); if (i < 0) i = PLANS.length - 1;
  const P = PLANS[i], tl = T - P.t0;
  CURSPLIT = P.split || null;
  const coupes = (P.cuts || (P.split ? [P.split.at] : [])).filter(c => tl >= c);
  const tc = tl - (coupes.length ? Math.max(...coupes) : 0), k = clamp(tc / 0.16);
  const punch = P.nocut ? 1 : 1 + 0.09 * (1 - easeOut(k));                  // zoom "coup" à chaque coupe
  const cut = P.nocut ? '' : `<rect width="${W}" height="${H}" fill="#fff" opacity="${(0.2 * (1 - k) * (1 - k)).toFixed(3)}"/>`;
  const g = guides ? `<g fill="#ff0000" opacity=".25"><rect x="940" y="0" width="140" height="1920"/><rect x="0" y="1670" width="1080" height="250"/></g>` : '';
  document.getElementById('c').innerHTML = `<g transform="translate(540 960) scale(${punch}) translate(-540 -960)">${P.fn(tl)}</g>${cut}${P.fx ? P.fx(tl) : ''}` + g;
  return i;
}
// images de contrôle : [plan (1-14), temps local]
window.STILLS = [[1, 1.5], [2, 0.8], [3, 1.5], [3, 3.5], [4, 0.6], [4, 2.8], [5, 0.7], [5, 1.5], [6, 1.0], [6, 3.0], [6, 5.0], [6, 7.2], [7, 0.8], [7, 3.0], [8, 1.8], [8, 4.0], [9, 1.2], [9, 2.8], [9, 4.0], [9, 5.2], [10, 1.5], [10, 3.0], [11, 1.5], [11, 4.2], [12, 1.5], [13, 1.2], [14, 1.0]];
window.render = render; window.PLANS = PLANS; window.TOTAL = TOTAL;
