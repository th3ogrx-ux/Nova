// Textes de la vidéo (sous-titres, liste à coches vertes) : PNG transparents 1080x1920, superposés au rendu 3D.
// Usage : node scenes/overlay.cjs --times 1.5,4.5,12 --out rendu-tmp/o        (images de contrôle)
//         node scenes/overlay.cjs --frames 0-659 --out rendu-tmp/o            (toutes les images)
const { chromium } = require('playwright');
const a = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const TC = a('--coches', '6.4,8.2,10.0,11.8,13.6').split(',').map(Number);
const out = a('--out', 'rendu-tmp/o');
const page_js = `
const FONT = 'Inter, "DejaVu Sans", sans-serif', NUIT = '#040b1c', AMBRE = '#f5a623', VERT = '#3ddc97';
const TC = ${JSON.stringify(TC)};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ease = t => t * t * (3 - 2 * t);
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const ctx = document.createElement('canvas').getContext('2d'); const viol = [];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function wrap(text, size, maxW, weight = 800) {
  ctx.font = weight + ' ' + size + 'px ' + FONT; const mots = text.replace(/ ([?!:;])/g, '\\u00a0$1').split(' '), lines = []; let cur = '';
  for (const m of mots) { const e = cur ? cur + ' ' + m : m; if (ctx.measureText(e).width > maxW && cur) { lines.push(cur); cur = m; } else cur = e; }
  if (cur) lines.push(cur); return lines;
}
// légende : blanc, contour sombre, mots clés en ambre. Zone sûre : x 110..910, jamais sous y=1670.
function caption(text, t, o = {}) {
  const size = o.size || 72, maxW = o.maxW || 800, cx = 510, lh = size * 1.22, k = clamp((t - (o.t0 ?? 0)) / 0.22);
  const lines = wrap(text, size, maxW), yFirst = (o.bottom || 1612) - (lines.length - 1) * lh, yLast = yFirst + (lines.length - 1) * lh;
  ctx.font = '800 ' + size + 'px ' + FONT; const wMax = Math.max(...lines.map(l => ctx.measureText(l).width));
  if (cx + wMax / 2 > 925 || cx - wMax / 2 < 95 || yLast + size * 0.3 > 1670) viol.push('texte hors zone: ' + text);
  if (k <= 0) return ''; if (o.t1 != null && t >= o.t1) return '';
  const hl = (o.hl || []).map(w => w.toLowerCase()), e = easeBack(k), yc = yFirst + (lines.length - 1) * lh / 2 - size * 0.3;
  const mots = l => l.split(' ').map(w => hl.includes(w.toLowerCase().replace(/[.,?!…:;]/g, '')) ? '<tspan fill="' + AMBRE + '">' + esc(w) + '</tspan>' : esc(w)).join(' ');
  return '<g opacity="' + Math.min(1, k * 2) + '" transform="translate(' + cx + ' ' + yc + ') rotate(' + ((1 - e) * -3) + ') scale(' + (0.7 + 0.3 * e) + ') translate(' + (-cx) + ' ' + (-yc) + ')">' +
    lines.map((l, i) => '<text x="' + cx + '" y="' + (yFirst + i * lh) + '" text-anchor="middle" font-family=\\'' + FONT + '\\' font-weight="800" font-size="' + size + '" fill="#fff" stroke="' + NUIT + '" stroke-width="' + (size * 0.18) + '" word-spacing="' + (size * 0.08) + '" stroke-linejoin="round" paint-order="stroke">' + mots(l) + '</text>').join('') + '</g>';
}
// liste : une ligne après l'autre, coche verte qui "pop" à chaque étape
const ITEMS = ['Ta page est créée', 'Tes horaires sont à jour', 'Tes photos et vidéos sont en ligne', 'Tes bons plans préviennent tes abonnés', 'Ton QR code est en caisse'];
function liste(t) {
  const size = 46, maxW = 640; let y = 1010, s = '', total = 0; const rows = ITEMS.map(tx => wrap(tx, size, maxW, 800));
  total = rows.reduce((a, r) => a + r.length * size * 1.15 + 38, 0); if (1010 + total > 1665) viol.push('liste trop basse: ' + (1010 + total));
  s += '<rect x="96" y="984" width="838" height="' + (total + 34) + '" rx="40" fill="' + NUIT + '" opacity=".55"/>';
  rows.forEach((lines, i) => {
    const h = lines.length * size * 1.15 + 38, k = clamp((t - (TC[i] - 0.25)) / 0.3), kc = clamp((t - TC[i]) / 0.3);
    if (k > 0) {
      const cy = y + h / 2 + 8, e = easeBack(kc), xo = (1 - ease(k)) * -60;
      s += '<g opacity="' + k + '" transform="translate(' + xo + ' 0)">';
      s += '<g transform="translate(152 ' + cy + ') scale(' + (kc > 0 ? 0.4 + 0.6 * e : 0.001) + ')"><circle r="34" fill="' + VERT + '" stroke="' + NUIT + '" stroke-width="5"/><path d="M-15 1 L-4 13 L17 -12" fill="none" stroke="' + NUIT + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>';
      s += lines.map((l, j) => '<text x="210" y="' + (cy + 15 - (lines.length - 1) * size * 0.58 + j * size * 1.15) + '" font-family=\\'' + FONT + '\\' font-weight="800" font-size="' + size + '" fill="#fff" stroke="' + NUIT + '" stroke-width="' + (size * 0.16) + '" stroke-linejoin="round" paint-order="stroke">' + esc(l) + '</text>').join('') + '</g>';
    }
    y += h;
  });
  return s;
}
function draw(t) {
  let s = '';
  if (t < 3) s += caption('Commerçant ? Voici pourquoi on ne te trouve pas.', t, { t0: 0.2, hl: ['trouve'] });
  else if (t < 6) s += caption('Les gens cherchent sur leur téléphone.', t, { t0: 3.1, hl: ['téléphone'] });
  else if (t < 16) s += liste(t);
  else if (t < 19) s += caption('Les clients te trouvent.', t, { t0: 16.1, hl: ['trouvent'] });
  else s += caption('Nooxel World. Crée ta page en 5 minutes. Lien en bio.', t, { t0: 19.2, size: 74, hl: ['Nooxel', 'World.'] });
  document.getElementById('c').innerHTML = s;
}
window.draw = draw; window.viol = viol;`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERREUR PAGE:', e.message));
  await p.setContent('<html><body style="margin:0;background:transparent"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" style="display:block"><g id="c"></g></svg></body></html>');
  await p.addScriptTag({ content: page_js }); await p.evaluate(() => document.fonts.ready);
  const fs = require('node:fs'); fs.mkdirSync(require('node:path').dirname(out), { recursive: true });
  if (process.argv.includes('--times')) {
    for (const t of a('--times', '1').split(',').map(Number)) { await p.evaluate(t => window.draw(t), t); await p.screenshot({ path: `${out}_${t.toFixed(2).padStart(5, '0')}.png`, omitBackground: true }); }
  } else {
    const [f0, f1] = a('--frames', '0-0').split('-').map(Number);
    for (let f = f0; f <= f1; f++) { await p.evaluate(t => window.draw(t), f / 30); await p.screenshot({ path: `${out}${String(f).padStart(5, '0')}.png`, omitBackground: true }); if (f % 100 === 0) console.log('overlay', f); }
  }
  console.log('violations:', JSON.stringify(await p.evaluate(() => [...new Set(window.viol)]))); await b.close();
})();
