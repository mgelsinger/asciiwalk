import { readdirSync, writeFileSync } from 'node:fs';
const folder = 'docs/validation/views';
const names = readdirSync(folder)
  .filter((name) => name.endsWith('-color.png'))
  .map((name) => name.replace('-color.png', ''))
  .sort();
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Warsaw visual review</title><style>body{margin:0;padding:32px;background:#0c1716;color:#ced8bc;font:14px monospace}h1{font-weight:400}p{max-width:1000px;line-height:1.7}section{margin:40px 0}h2{font-size:18px;font-weight:400}.views{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;display:block;border:1px solid #384d40}figcaption{padding:8px;color:#9cb394}a{color:inherit} @media(max-width:900px){.views{grid-template-columns:1fr}}</style><h1>Warsaw / fixed street-level views</h1><p>Actual application captures at 1920x1080. September 13, 2026 revision: 14 cameras and 70 captures. Each row uses an identical camera. Source geometry is a developer view; the normal world is entirely ASCII. The unlabeled captures hide the street display, compass and authored signs; mono-unlabeled also removes color. Geographic placement comes from OpenStreetMap and USGS; facade detail combines dated references and estimates.</p>${names.map((name) => `<section><h2>${name.replaceAll('-', ' ')}</h2><div class="views">${['color', 'mono', 'unlabeled', 'mono-unlabeled', 'geometry'].map((mode) => `<figure><a href="views/${name}-${mode}.png"><img loading="lazy" src="views/${name}-${mode}.png" alt="${name} ${mode}"></a><figcaption>${mode === 'geometry' ? 'Source geometry / developer inspection' : mode}</figcaption></figure>`).join('')}</div></section>`).join('')}</html>`;
writeFileSync(
  'docs/validation/gallery.html',
  html.replace(
    '</html>',
    '<section><h2>September 12 walking route (earlier revision)</h2><p>Historical recording from the September 12 production app. It predates the landmark and navigation corrections shown above. Main Street, West Buffalo residential frontage and the hill transition. The benchmark uses the real collision-aware walking controller.</p><video controls preload="metadata" style="width:100%" src="walkthrough.webm"></video></section></html>',
  ),
);
console.log(`Saved visual gallery with ${names.length} camera positions.`);
