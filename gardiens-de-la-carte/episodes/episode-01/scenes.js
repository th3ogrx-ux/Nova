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
    lines.map((l, i) => `<text x="${cx}" y="${yFirst + i * lh}" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="${size}" fill="#fff" stroke="${COL.nuit}" stroke-width="${size * 0.18}" word-spacing="${size * 0.08}" stroke-linejoin="round" paint-order="stroke">${motsLigne(l)}</text>`).join('') + '</g>';
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
  return `<g transform="translate(${cx} ${feet}) rotate(${o.rot || 0}) scale(${s} ${sy}) translate(-200 -608)">${A.hero[name]}</g>`;
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
function fogFront(x0, t) {
  let s = '';
  FOG.forEach((L, k) => {
    const xk = x0 - k * 80, top = 800 + k * 50;
    s += `<rect x="-300" y="${top + 60}" width="${xk + 300 - 40}" height="${H}" fill="${L.c}"/>`;
    for (let i = -1; i < 7; i++) s += `<ellipse cx="${-100 + i * 150 + (xk + 100) * .0}" cy="${top + 35 * Math.sin(t * 1.4 + i + L.ph)}" rx="150" ry="110" fill="${L.c}" opacity="${-100 + i * 150 < xk ? 1 : 0}"/>`;
    for (let j = 0; j < 9; j++) s += `<ellipse cx="${xk - 30 + 25 * Math.sin(t * 1.6 + j + L.ph)}" cy="${top + 60 + j * 125}" rx="120" ry="100" fill="${L.c}"/>`;
  });
  return s;
}

// ---------- Carte et téléphone ----------
const PTS = A.points;
const PIN = 'M0 0 C-12 -16 -15 -24 -15 -30 A15 15 0 1 1 15 -30 C15 -24 12 -16 0 0Z';
function pinMarkup(p, sc, on, glow) {
  if (sc <= 0) return '';
  const col = on > 0.5 ? COL.ambre : COL.grisSombre;
  const halo = on > 0.5 ? `<circle cx="0" cy="-30" r="40" fill="${COL.ambre}" opacity="${(0.14 * glow).toFixed(3)}"/><circle cx="0" cy="-30" r="24" fill="${COL.ambre}" opacity="${(0.22 * glow).toFixed(3)}"/>` : '';
  return `<g transform="translate(${p.x} ${p.y}) scale(${sc})">${halo}<path d="${PIN}" fill="${col}"/><circle cx="0" cy="-30" r="5.5" fill="${on > 0.5 ? '#fff3d6' : '#8b93a7'}"/></g>`;
}
function phoneScene(pinsFn, overlay = '') {
  const pins = PTS.map((p, i) => { const s = pinsFn(p, i); return pinMarkup(p, s.sc, s.on, s.glow); }).join('');
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

// ---------- Les 13 plans ----------
const PLANS = [];
const plan = (d, fn) => PLANS.push({ d, fn });

// 1 - L'accroche (2 s)
plan(2.0, t => {
  const v = t < 0.45 ? 1 : 0.35 + 0.65 * Math.abs(Math.sin(t * 13));
  let fac = op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', v), 'halo', v);
  const sc = A.decor['rue-nuit'] + `<g transform="translate(90 480)">${fac}</g>`;
  return cam(sc, t, 2, { z0: 1.9, z1: 1.2, f0: [445, 1270], f1: [540, 1050] }) + caption('Hier, cette boulangerie existait.', t, { hl: ['boulangerie'] });
});

// 2 - La brume avale la boutique (2,5 s)
plan(2.5, t => {
  const level = t < 1.2 ? easeIn(t / 1.2) : (t < 1.5 ? 1 : lerp(1, 0.04, ease(clamp((t - 1.5) / 1.0))));
  const wall = t >= 1.15;
  let fac = wall ? A.decor['facade-mur-nuit'] : op(op(A.decor['facade-boulangerie-nuit'], 'lumiere', 0.9), 'halo', 0.9);
  const sc = A.decor['rue-nuit'] + `<g transform="translate(90 480)">${fac}</g>` + fogBank(level, t);
  return cam(sc, t, 2.5, { z0: 1.06, z1: 1.16, f0: [540, 900], f1: [540, 940] }) + caption("Ce matin, il n'y a plus qu'un mur.", t, { hl: ['mur'] });
});

// 3 - Noé s'arrête net devant le mur (3,5 s)
plan(3.5, t => {
  const stop = 1.0, marche = t < stop;
  const cx = marche ? lerp(-200, 410, t / stop) : 410;
  const bob = marche ? Math.abs(Math.sin(t * 11)) * 16 : 0;
  const saut = t >= stop ? 26 * Math.exp(-(t - stop) * 7) * Math.abs(Math.cos((t - stop) * 9)) : 0;
  const expr = t < stop + 0.05 ? 'neutre-sans-telephone' : 'surpris-sans-telephone';
  const sc = A.decor['rue-jour'] + `<g transform="translate(90 480)">${A.decor['facade-mur-jour']}</g>` +
    hero(expr, cx, 1450 - bob - saut, 1.15, { t, rot: marche ? Math.sin(t * 11) * 2.2 : 0 });
  const shake = t > stop ? 16 * Math.exp(-(t - stop) * 4) : 0;
  return cam(sc, t, 3.5, { z0: 1.04, z1: 1.14, f0: [540, 980], f1: [470, 1000], shake }) + caption("Et personne ne s'en souvient.", t, { t0: 0.15, hl: ['personne'] });
});

// 4 - Le passant (3,5 s)
plan(3.5, t => {
  const parle = t > 0.4 && t < 3.0 && Math.floor(t * 5) % 2 === 0;
  const sc = A.decor['rue-jour'] + `<g transform="translate(90 480)">${A.decor['facade-mur-jour']}</g>` +
    hero('surpris-sans-telephone', 300, 1450, 1.1, { t }) +
    perso(parle ? A.passant.parle : A.passant.neutre, 735, 1450, 1.05, { t });
  const k = clamp((t - 0.15) / 0.3), e = easeBack(k);
  const lines = wrap("Une boulangerie ? Ici ? Il n'y a jamais rien eu, mon garçon.", 54, 700, 700);
  const bh = lines.length * 68 + 56, by = 380;
  const bulle = k <= 0 ? '' : `<g opacity="${k}" transform="translate(510 ${by + bh / 2}) scale(${0.85 + 0.15 * e}) translate(-510 ${-(by + bh / 2)})">
    <rect x="110" y="${by}" width="800" height="${bh}" rx="46" fill="#fff" stroke="${COL.nuit}" stroke-width="8"/>
    <path d="M660 ${by + bh - 4} L730 ${by + bh - 4} L736 ${by + bh + 150} Z" fill="#fff" stroke="${COL.nuit}" stroke-width="8" stroke-linejoin="round"/>
    <rect x="652" y="${by + bh - 12}" width="86" height="14" fill="#fff"/>
    ${lines.map((l, i) => `<text x="510" y="${by + 70 + i * 68}" text-anchor="middle" font-family='${FONT}' font-weight="700" font-size="54" fill="#0b1330">${esc(l)}</text>`).join('')}</g>`;
  if (by + bh > 700) viol.add('bulle trop basse');
  return cam(sc, t, 3.5, { z0: 1.0, z1: 1.08, f0: [540, 960], f1: [560, 1000] }) + bulle;
});

// 5 - Souvenir (3,5 s)
plan(3.5, t => {
  let motes = '';
  for (let i = 0; i < 16; i++) motes += `<circle cx="${(i * 197 + t * 14) % 1080}" cy="${(1700 - ((t * 40 + i * 113) % 1500))}" r="${3 + (i % 4) * 2}" fill="#fff" opacity=".45"/>`;
  const croix = Math.sin(t * 2.4) * 6;
  const sc = A.decor['boulangerie-interieur'] +
    perso(A.boulangere['tend-croissant'], 770, 1325, 1.05, { t, rot: croix * 0.15 }) + A.decor['boulangerie-comptoir'] +
    hero('content-sans-telephone', 250, 1400, 1.1, { t });
  const doux = `<rect width="${W}" height="${H}" fill="#fff4dc" opacity=".26"/><rect width="${W}" height="${H}" fill="url(#vig)"/>${motes}`;
  return cam(sc, t, 3.5, { z0: 1.0, z1: 1.1, f0: [540, 960], f1: [600, 1050] }) + doux + caption("Pourtant, hier encore, j'y achetais mon pain.", t, { t0: 0.15, hl: ['pain'] });
});

// 6 - Le téléphone s'allume tout seul (3,5 s)
plan(3.5, t => {
  const on = clamp((t - 0.45) / 0.18);
  const vib = on * Math.sin(t * 70) * 1.8, dx = on * Math.sin(t * 57) * 3;
  const pc = [800, 976];
  const glow = [420, 300, 200].map((r, i) => `<circle cx="${pc[0]}" cy="${pc[1]}" r="${r * (1 + Math.sin(t * 6 + i) * 0.03)}" fill="${COL.clair}" opacity="${(0.07 + i * 0.05) * on}"/>`).join('');
  let lignes = '';
  for (let i = 1; i <= 3; i++) {
    const o = on * (Math.sin(t * 22 + i) > -0.3 ? 0.85 - i * 0.2 : 0.2);
    lignes += `<path d="M${-330 - i * 46} -110 Q${-375 - i * 46} 0 ${-330 - i * 46} 110 M${330 + i * 46} -110 Q${375 + i * 46} 0 ${330 + i * 46} 110" fill="none" stroke="${COL.clair}" stroke-width="18" stroke-linecap="round" opacity="${o.toFixed(2)}"/>`;
  }
  const ecran = `<g clip-path="url(#ecran)"><rect x="-260" y="-480" width="520" height="960" fill="${COL.clair}" opacity="${on}"/>
    <circle cx="0" cy="0" r="${170 + Math.sin(t * 9) * 8}" fill="#fff" opacity="${0.25 * on}"/>
    <g transform="translate(0 70) scale(4.2)" opacity="${on}"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="6" fill="#fff"/></g></g>`;
  const tel = `<g transform="translate(${pc[0] + dx} ${pc[1]}) rotate(${-5 + vib}) scale(.34)">${A.decor.telephone}${ecran}${lignes}</g>`;
  const sc = A.decor['chambre-nuit'] + `<rect width="${W}" height="${H}" fill="${COL.bleu}" opacity="${0.10 * on}"/>` + glow + tel;
  return cam(sc, t, 3.5, { z0: 1.0, z1: 1.45, f0: [540, 960], f1: [690, 1020], shake: on * 1.2 }) + caption("Cette nuit-là, mon téléphone s'est allumé tout seul.", t, { t0: 0.1, hl: ['tout', 'seul'] });
});

// 7 - La carte (5,5 s) : deux plans (0-2,5 puis 2,5-5,5)
plan(5.5, t => {
  if (t < 2.5) {
    const pins = (p, i) => ({ sc: i < 14 ? popScale(t, 0.45 + i * 0.12) : 0, on: 1, glow: 0.8 + 0.2 * Math.sin(t * 5 + i) });
    return fondNuit(t) + phoneCam(phoneScene(pins), t, 2.5, 0.95, 1.32, [0, -10], [0, -20], 900) + caption('Des lumières. Partout dans la ville.', t, { t0: 0.2, hl: ['lumières'] });
  }
  const u = t - 2.5;
  const pins = (p, i) => ({ sc: i < 14 ? 1 : popScale(u, 0.05 + (i - 14) * 0.1), on: 1, glow: 0.8 + 0.2 * Math.sin(t * 5 + i) });
  return fondNuit(t, 2) + phoneCam(phoneScene(pins), u, 3.0, 1.85, 2.15, [-60, -180], [30, 40]) + caption("Chaque lumière... c'est un commerce.", u, { t0: 0.1, hl: ['commerce'] });
});

// 8 - Certaines s'éteignent (4 s) : deux plans (0-2 puis 2-4)
plan(4.0, t => {
  const pins = (p, i) => { const e = etatPin(p, t, t); return { sc: 1, on: e.on, glow: e.glow * (0.85 + 0.15 * Math.sin(t * 5 + i)) }; };
  const A_ = PTS[idxOf('A')], B_ = PTS[idxOf('B')];
  let fumee = '';
  const puff = (p, t0) => { const k = clamp((t - t0) / 1.2); return k > 0 ? `<ellipse cx="${p.x}" cy="${p.y - 34 - k * 30}" rx="${12 + k * 36}" ry="${8 + k * 26}" fill="${COL.gris}" opacity="${(0.5 * (1 - k)).toFixed(2)}"/>` : ''; };
  fumee = puff(A_, 1.4) + puff(B_, 3.2);
  const scn = phoneScene(pins, fumee);
  const cap = caption("Et certaines s'éteignent.", t, { t0: 0.1, hl: ["s'éteignent"] });
  if (t < 2.0) return fondNuit(t) + phoneCam(scn, t, 2.0, 2.3, 2.6, [A_.x + 20, A_.y - 60], [A_.x, A_.y - 30]) + cap;
  return fondNuit(t, 1) + phoneCam(scn, t - 2, 2.0, 2.2, 2.5, [B_.x - 40, B_.y - 80], [B_.x, B_.y - 30]) + cap;
});

// 9 - Le message (4,5 s) : deux plans (0-2 puis 2-4,5)
const MSG1 = 'Ils disparaissent quand plus personne ne vient.';
const MSG2 = 'Tu les vois. Tu es Gardien, maintenant.';
function messageSvg(text, y0, nChars, t) {
  ctx.font = `700 34px ${FONT}`;
  const lines = wrap(text, 34, 370, 700);
  let reste = Math.max(0, Math.floor(nChars)), s = '', yLast = y0, wLast = 0;
  const x0 = -165;
  s += `<g transform="translate(-205 ${y0 - 8}) scale(.9)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="5.5" fill="#fff3d6"/></g>`;
  lines.forEach((l, i) => {
    const n = Math.min(l.length, reste); reste -= n;
    if (n > 0) { const sh = l.slice(0, n); s += `<text x="${x0}" y="${y0 + i * 46}" font-family='${FONT}' font-weight="700" font-size="34" fill="${COL.clair}">${esc(sh)}</text>`; yLast = y0 + i * 46; wLast = ctx.measureText(sh).width; }
  });
  const fini = nChars >= text.length;
  if (!fini && nChars > 0 || (fini && Math.floor(t * 3) % 2 === 0 && false)) s += `<rect x="${x0 + wLast + 4}" y="${yLast - 28}" width="14" height="34" fill="${COL.clair}"/>`;
  return s;
}
plan(4.5, t => {
  const e1 = (t - 0.15) * 30, e2 = (t - 2.3) * 30;
  const pins = (p, i) => { const e = etatPin(p, 99, 99); return { sc: 1, on: e.on, glow: e.glow * 0.8 }; };
  const ov = `<rect x="-260" y="-480" width="520" height="960" fill="${COL.nuit}" opacity=".84"/>` + messageSvg(MSG1, -190, e1, t) + (e2 > 0 ? messageSvg(MSG2, 10, e2, t) : '');
  const scn = phoneScene(pins, ov);
  if (t < 2.0) return fondNuit(t) + phoneCam(scn, t, 2.0, 1.95, 2.05, [0, -130], [0, -125]);
  return fondNuit(t, 1) + phoneCam(scn, t - 2, 2.5, 2.0, 2.18, [10, -60], [0, 10]);
});

// 10 - Noé regarde par la fenêtre (3,5 s)
plan(3.5, t => {
  const regarde = t >= 1.2;
  const pop = regarde ? 1 + 0.05 * Math.exp(-(t - 1.2) * 8) : 1;
  const sc = A.decor['chambre-fenetre'] + hero(regarde ? 'determine-regard-droite' : 'neutre-regard-bas', 380, 1480, 1.3 * pop, { t });
  return cam(sc, t, 3.5, { z0: 1.0, z1: 1.32, f0: [540, 960], f1: [700, 880] }) + caption('Celle-ci, au coin de ma rue...', t, { t0: 0.15, hl: ['rue'] });
});

// 11 - La brume avance (2,5 s), coupure nette à la fin
plan(2.5, t => {
  const bump = (c, w) => Math.exp(-Math.pow((t - c) / w, 2));
  const v = clamp(1 - 0.85 * bump(0.5, 0.09) - 0.85 * bump(1.05, 0.09) - 0.6 * bump(1.7, 0.08));
  const vit = op(op(A.decor['vitrine-coin'], 'lumiere', v), 'halo', v);
  const sc = A.decor['rue-nuit'] + `<g transform="translate(120 468) scale(1.2)">${vit}</g>` + fogFront(-700 + 440 * t, t);
  return cam(sc, t, 2.5, { z0: 1.0, z1: 1.18, f0: [540, 960], f1: [470, 960], rot0: 0, rot1: -4 });
});

// 12 - Suite au prochain épisode (2 s)
plan(2.0, t => {
  const z = 1 + 0.04 * (t / 2);
  const g = `<g transform="translate(510 960) scale(${z}) translate(-510 -960)">` +
    caption('Suite au prochain épisode.', t, { size: 84, center: 900, t0: 0.05 }) +
    caption("Épisode 1 - La boulangerie qui n'a jamais existé", t, { size: 44, center: 1130, t0: 0.25, maxW: 780 }) + '</g>';
  return `<rect width="${W}" height="${H}" fill="#000"/>` + g;
});

// 13 - Fin (1,5 s)
plan(1.5, t => {
  const z = 1 + 0.05 * Math.sin(t * 2.0) + 0.04 * t;
  const pulse = 1 + 0.06 * Math.sin(t * 6);
  const pin = `<g transform="translate(510 900) scale(${z})">
    <circle cx="0" cy="-200" r="${470 * pulse}" fill="${COL.bleu}" opacity=".16"/><circle cx="0" cy="-200" r="${340 * pulse}" fill="${COL.ambre}" opacity=".12"/><circle cx="0" cy="-200" r="${240 * pulse}" fill="${COL.ambre}" opacity=".16"/>
    <g transform="scale(8)"><path d="${PIN}" fill="${COL.ambre}"/><circle cx="0" cy="-30" r="7" fill="#fff3d6"/></g></g>`;
  return `<rect width="${W}" height="${H}" fill="${COL.nuit}"/>` + pin +
    caption('La carte existe vraiment.', t, { size: 76, center: 1250, t0: 0.05, hl: ['vraiment'] }) + caption('Lien en bio.', t, { size: 52, center: 1440, t0: 0.3 });
});

PLANS[2].split = { at: 2.0, z: 2.1, f: [410, 949], rot: -2 };          // gros plan sur Noé surpris
PLANS[3].split = { at: 2.0, z: 1.9, f: [300, 975], rot: 2 };             // réaction de Noé
PLANS[4].split = { at: 1.5, z: 1.8, f: [400, 1040], f2: [470, 1060], rot: 0 }; // Noé et le croissant
PLANS[5].split = { at: 1.5, z: 2.6, f: [800, 990], rot: -3 };            // gros plan sur le téléphone
PLANS[9].split = { at: 2.0, z: 2.0, f: [782, 930], rot: 0 };             // la vitrine par la fenêtre
PLANS[1].fx = t => flash(t, 1.15, .55);
PLANS[2].fx = t => flash(t, 1.0, .4) + speedLines(410, 949, t, 1.0);
PLANS[5].fx = t => flash(t, .45, .5);
PLANS[7].fx = t => flash(t, 1.35, .3) + flash(t, 3.2, .3);
PLANS[9].fx = t => flash(t, 1.2, .22);
PLANS[11].fx = t => { const w = 560 * easeOut(clamp((t - .3) / .5)); return `<rect x="${510 - w / 2}" y="1000" width="${w}" height="10" rx="5" fill="${COL.ambre}"/>`; };
PLANS[12].fx = t => etincelles(t, 16);
let _t0 = 0; PLANS.forEach(p => { p.t0 = _t0; _t0 += p.d; });
const TOTAL = Math.round(_t0 * FPS);
function render(f, guides) {
  const T = f / FPS;
  let i = PLANS.findIndex(p => T < p.t0 + p.d - 1e-6); if (i < 0) i = PLANS.length - 1;
  const P = PLANS[i];
  let g = '';
  if (guides) g = `<g fill="#ff0000" opacity=".25"><rect x="940" y="0" width="140" height="1920"/><rect x="0" y="1670" width="1080" height="250"/></g>`;
  const tl = T - P.t0;
  CURSPLIT = P.split || null;
  const tc = tl - (P.split && tl >= P.split.at ? P.split.at : 0), k = clamp(tc / 0.16);
  const punch = 1 + 0.09 * (1 - easeOut(k));                       // zoom "coup" à chaque coupe
  const cut = i === 11 ? '' : `<rect width="${W}" height="${H}" fill="#fff" opacity="${(0.2 * (1 - k) * (1 - k)).toFixed(3)}"/>`;
  document.getElementById('c').innerHTML = `<g transform="translate(540 960) scale(${punch}) translate(-540 -960)">${P.fn(tl)}</g>${cut}${P.fx ? P.fx(tl) : ''}` + g;
  return i;
}
window.render = render; window.PLANS = PLANS; window.TOTAL = TOTAL;
