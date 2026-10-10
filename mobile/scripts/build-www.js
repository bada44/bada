// Masaustu arayuzunu (src/renderer) mobil www klasorune kopyalar ve mobil koprusunu ekler.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, '..', 'src', 'renderer');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['styles.css', 'renderer.js', 'steam.js']) fs.copyFileSync(path.join(src, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'bridge', 'bridge.js'), path.join(out, 'bridge.js'));
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
if (!html.includes('src="renderer.js"')) throw new Error('index.html beklenen yapida degil');
html = html.replace('<script src="renderer.js"></script>', '<script src="bridge.js"></script>\n  <script src="renderer.js"></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www hazir:', out);
