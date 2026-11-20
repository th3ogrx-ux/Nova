(async () => {
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const noms = ['neutre','surpris','determine'];
const svgs = noms.map(n => readFileSync(`personnages/heros/heros-${n}.svg`,'utf8').replace('<svg ','<svg style="height:100%;width:auto" '));
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1500,height:760}, deviceScaleFactor:2 });
await p.setContent(`<body style="margin:0;background:#040b1c;display:flex;justify-content:space-around;align-items:center;height:760px;padding:30px;box-sizing:border-box">${svgs.map(s=>`<div style="height:700px">${s}</div>`).join('')}</body>`);
await p.screenshot({path:'export/apercu-heros-3-expressions.png'});
await b.close();
})();
