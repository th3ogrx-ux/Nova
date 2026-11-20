// Rend l'épisode 1. Usage (depuis le dossier gardiens-de-la-carte) :
//   node episodes/episode-01/episode-01.cjs stills   -> 13 images PNG (une par plan) dans episodes/episode-01/apercus
//   node episodes/episode-01/episode-01.cjs video    -> export/episode-01.mp4 (30 i/s, 1080x1920, sans son)
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const lire = p => fs.readFileSync(path.join(root, p), 'utf8');
const inner = s => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
const charger = (d, prefixe, filtre) => Object.fromEntries(fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.svg') && f.startsWith(prefixe)).map(f => [f.slice(prefixe.length, -4), inner(lire(`${d}/${f}`))]));
const A = {
  hero: charger('personnages/heros', 'heros-'),
  passant: charger('personnages/passant', 'passant-'),
  boulangere: charger('personnages/boulangere', 'boulangere-'),
  decor: charger('decors', ''),
  points: JSON.parse(lire('decors/carte-points.json')),
};
const html = `<html><body style="margin:0;background:#000"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" style="display:block">
<defs><radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#fff4dc" stop-opacity="0"/><stop offset="100%" stop-color="#fff4dc" stop-opacity=".75"/></radialGradient></defs>
<g id="c"></g></svg><script>const A=${JSON.stringify(A)};${lire('episodes/episode-01/scenes.js')}</script></body></html>`;

(async () => {
  const mode = process.argv[2] || 'stills';
  const guides = process.argv.includes('--guides');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERREUR PAGE:', e.message));
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  const total = await p.evaluate(() => window.TOTAL);
  const plans = await p.evaluate(() => window.PLANS.map(x => [x.t0, x.d]));
  if (mode === 'stills') {
    const dir = path.join(root, 'episodes/episode-01/apercus'); fs.mkdirSync(dir, { recursive: true });
    const tStill = [1.4, 1.8, 2.4, 2.0, 2.0, 2.2, 4.4, 2.8, 3.6, 2.8, 1.9, 1.2, 1.0];
    for (let i = 0; i < plans.length; i++) {
      const f = Math.round((plans[i][0] + Math.min(tStill[i], plans[i][1] - 0.05)) * 30);
      await p.evaluate(([f, g]) => window.render(f, g), [f, guides]);
      await p.screenshot({ path: path.join(dir, `plan-${String(i + 1).padStart(2, '0')}.png`) });
    }
    console.log('apercus ok;', 'violations:', JSON.stringify(await p.evaluate(() => [...window.__viol])));
  } else {
    const tmp = process.argv[3]; fs.mkdirSync(tmp, { recursive: true });
    for (let f = 0; f < total; f++) {
      await p.evaluate(f => window.render(f), f);
      await p.screenshot({ path: path.join(tmp, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (f % 150 === 0) console.log('image', f, '/', total);
    }
    console.log('violations:', JSON.stringify(await p.evaluate(() => [...window.__viol])));
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(tmp, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', '30', '-movflags', '+faststart', '-an', process.argv[4] || path.join(root, 'export/episode-01.mp4')]);
    console.log('video ok');
  }
  await b.close();
})();
