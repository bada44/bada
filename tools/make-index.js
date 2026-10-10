// Kod deposu index.json'unu klasorlerden otomatik uretir:  node tools/make-index.js [depo-klasoru]
// gc/<ID>.txt ve ps2/<CRC>.pnach dosyalarini tarar; "version" her calistirmada artar.
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'codes-repo'));
const idxPath = path.join(root, 'index.json');
let version = 0;
try { version = JSON.parse(fs.readFileSync(idxPath, 'utf8')).version || 0; } catch (e) { /* ilk kez */ }

function titleOf(file, kind) {
  const first = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim());
  if (!first) return '';
  if (kind === 'gc') return first.startsWith('$') ? first.slice(1).trim() : '';
  const m = fs.readFileSync(file, 'utf8').match(/^gametitle=(.*)$/im);
  return m ? m[1].trim() : '';
}

const out = { version: version + 1, gc: {}, ps2: {} };
for (const [kind, ext, re] of [['gc', '.txt', /^[A-Z0-9]{6}$/], ['ps2', '.pnach', /^[0-9A-F]{8}$/]]) {
  const dir = path.join(root, kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(ext)) continue;
    const id = f.slice(0, -ext.length);
    if (!re.test(id)) { console.warn('Atlandi (gecersiz ad):', f); continue; }
    out[kind][id] = { title: titleOf(path.join(dir, f), kind), file: `${kind}/${f}` };
  }
}
fs.writeFileSync(idxPath, JSON.stringify(out, null, 2) + '\n');
console.log(`index.json yazildi: ${Object.keys(out.gc).length} GameCube, ${Object.keys(out.ps2).length} PS2 (version ${out.version})`);
