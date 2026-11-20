// Rend un épisode. Usage (depuis gardiens-de-la-carte) :
//   node episodes/rendre-episode.cjs <dossier-episode> stills [--guides]
//   node episodes/rendre-episode.cjs <dossier-episode> video <dossier-images> <sortie.mp4>
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ep = path.resolve(root, process.argv[2]);
const lire = p => fs.readFileSync(path.join(root, p), 'utf8');
const inner = s => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
const charger = (d, prefixe) => Object.fromEntries(fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.svg') && f.startsWith(prefixe)).map(f => [f.slice(prefixe.length, -4), inner(lire(`${d}/${f}`))]));
const A = {
  hero: charger('personnages/heros', 'heros-'), passant: charger('personnages/passant', 'passant-'), boulangere: charger('personnages/boulangere', 'boulangere-'),
  gris: charger('personnages/gris', 'gris-'), boucher: charger('personnages/boucher', 'boucher-'), decor: charger('decors', ''),
  points: JSON.parse(lire('decors/carte-points.json')),
};
const html = `<html><body style="margin:0;background:#000"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" style="display:block">
<defs><radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#fff4dc" stop-opacity="0"/><stop offset="100%" stop-color="#fff4dc" stop-opacity=".75"/></radialGradient></defs>
<g id="c"></g></svg><script>const A=${JSON.stringify(A)};${fs.readFileSync(path.join(ep, 'scenes.js'), 'utf8')}</script></body></html>`;
(async () => {
  const mode = process.argv[3] || 'stills', guides = process.argv.includes('--guides');
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERREUR PAGE:', e.message));
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  const total = await p.evaluate(() => window.TOTAL), plans = await p.evaluate(() => window.PLANS.map(x => [x.t0, x.d]));
  if (mode === 'stills') {
    const dir = path.join(ep, 'apercus'); fs.mkdirSync(dir, { recursive: true });
    const stills = await p.evaluate(() => window.STILLS);
    for (let n = 0; n < stills.length; n++) {
      const [pl, tl] = stills[n], f = Math.round((plans[pl - 1][0] + tl) * 30);
      await p.evaluate(([f, g]) => window.render(f, g), [f, guides]);
      await p.screenshot({ path: path.join(dir, `img-${String(n + 1).padStart(2, '0')}-plan-${String(pl).padStart(2, '0')}.png`) });
    }
    console.log('apercus ok;', 'violations:', JSON.stringify(await p.evaluate(() => [...window.__viol])));
  } else {
    const tmp = process.argv[4]; fs.mkdirSync(tmp, { recursive: true });
    for (let f = 0; f < total; f++) {
      await p.evaluate(f => window.render(f), f);
      await p.screenshot({ path: path.join(tmp, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (f % 200 === 0) console.log('image', f, '/', total);
    }
    console.log('violations:', JSON.stringify(await p.evaluate(() => [...window.__viol])));
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(tmp, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', '30', '-movflags', '+faststart', '-an', path.resolve(process.argv[5])]);
    console.log('video ok');
  }
  await b.close();
})();
