const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const d = 'export/photo-de-profil';
  const noms = [['A','epingle'],['B','heros'],['C','commerce']];
  const page = async (css) => { const p = await b.newPage({ viewport:{width:1024,height:1024} }); return p; };
  for (const [l,n] of noms) {
    const svg = fs.readFileSync(`${d}/sources/pdp-${l}-${n}.svg`,'utf8').replace('<svg ','<svg style="width:1024px;height:1024px;display:block" ');
    const p = await page();
    await p.setContent(`<body style="margin:0">${svg}</body>`);
    await p.screenshot({ path:`${d}/pdp-${l}-${n}.png`, clip:{x:0,y:0,width:1024,height:1024} });
    await p.setContent(`<body style="margin:0;background:transparent"><div style="width:1024px;height:1024px;border-radius:50%;overflow:hidden">${svg}</div></body>`);
    await p.screenshot({ path:`${d}/pdp-${l}-${n}-apercu-rond.png`, omitBackground:true, clip:{x:0,y:0,width:1024,height:1024} });
    await p.close();
  }
  // planche comparative : rond 360px + rond 100px + rond 48px, sur fond sombre type TikTok
  const imgs = noms.map(([l,n]) => fs.readFileSync(`${d}/pdp-${l}-${n}-apercu-rond.png`).toString('base64'));
  const col = (s) => imgs.map(i=>`<img src="data:image/png;base64,${i}" style="width:${s}px;height:${s}px">`).join('');
  const p = await b.newPage({ viewport:{width:1300,height:640} });
  await p.setContent(`<body style="margin:0;background:#161823;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;height:640px">
    <div style="display:flex;gap:60px">${col(360)}</div>
    <div style="display:flex;gap:60px;align-items:center">${col(100)}<span style="width:60px"></span>${col(48)}</div></body>`);
  await p.screenshot({ path:`${d}/comparatif-ronds.png` });
  await b.close();
})();
