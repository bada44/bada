// tools/make-index.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'codes-repo'));
const idxPath = path.join(root, 'index.json');

let version = 0;
try {
  version = JSON.parse(fs.readFileSync(idxPath, 'utf8')).version || 0;
} catch (e) {}

function titleOf(file, kind) {
  const content = fs.readFileSync(file, 'utf8');
  const first = content.split(/\r?\n/).find(l => l.trim());
  if (!first) return '';
  if (kind === 'gc') {
    return first.startsWith('$') ? first.slice(1).trim() : '';
  }
  const m = content.match(/^gametitle=(.*)$/im);
  return m ? m[1].trim() : '';
}

const out = { version: version + 1, gc: {}, ps2: {} };

for (const [kind, ext, re] of [['gc', '.txt', /^[A-Z0-9]{6}$/], ['ps2', '.pnach', /^[0-9A-F]{8}$/]]) {
  const dir = path.join(root, kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(ext)) continue;
    const id = f.slice(0, -ext.length);
    if (!re.test(id)) continue;
    out[kind][id] = {
      title: titleOf(path.join(dir, f), kind),
      file: `${kind}/${f}`
    };
  }
}

fs.writeFileSync(idxPath, JSON.stringify(out, null, 2) + '\n');
console.log(`index.json yazıldı: ${Object.keys(out.gc).length} GC, ${Object.keys(out.ps2).length} PS2`);
