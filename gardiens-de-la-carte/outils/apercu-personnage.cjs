// Usage : node outils/apercu-personnage.cjs sortie.png fichier1.svg fichier2.svg ...  (aperçu côte à côte sur fond nuit)
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
(async () => {
  const [, , out, ...fichiers] = process.argv;
  const svgs = fichiers.map(f => readFileSync(f, 'utf8').replace('<svg ', '<svg style="height:100%;width:auto" '));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 500 * fichiers.length, height: 760 }, deviceScaleFactor: 2 });
  await p.setContent(`<body style="margin:0;background:#040b1c;display:flex;justify-content:space-around;align-items:center;height:760px;padding:30px;box-sizing:border-box">${svgs.map(s => `<div style="height:700px">${s}</div>`).join('')}</body>`);
  await p.screenshot({ path: out });
  await b.close();
})();
