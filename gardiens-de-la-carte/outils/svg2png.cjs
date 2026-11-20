(async () => {
// Usage : node outils/svg2png.mjs entree.svg sortie.png largeur hauteur [fond] [rond]
// Convertit un SVG en PNG avec Chromium (Playwright). fond = couleur CSS ou "transparent".
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const [,, src, out, w = '1024', h = '1024', bg = 'transparent', rond = ''] = process.argv;
const svg = readFileSync(src, 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.setContent(`<html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;${rond ? 'border-radius:50%;overflow:hidden;' : ''}">
<div style="width:${w}px;height:${h}px">${svg.replace(/<svg /, '<svg style="width:100%;height:100%;display:block" ')}</div></body></html>`);
await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: +w, height: +h } });
await b.close();
})();
