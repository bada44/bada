// Basit bulut senkronu: kullanicinin sectigi bir klasore (Google Drive masaustu,
// Dropbox, OneDrive, Syncthing...) hafiza kartlarini kopyalar. API anahtari,
// giris, token YOK. "En yeni dosya kazanir"; ustune yazilan yerel dosyanin
// yedegi (.retrohub-bak) alinir.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const paths = require('./paths');

function localRoots() {
  return [
    { prefix: 'dolphin', dir: path.join(paths.dolphinUserDir(), 'GC'),
      match: (rel) => /\.(raw|gci|sav)$/i.test(rel) && !/^(backup|dump)/i.test(rel) },
    { prefix: 'pcsx2', dir: path.join(paths.pcsx2Dir(), 'memcards'),
      match: (rel) => /\.(ps2|mcd|mc2)$/i.test(rel) }
  ];
}

function walk(dir, match, depth = 0, base = dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth < 3) walk(full, match, depth + 1, base, out);
    } else {
      const rel = path.relative(base, full).split(path.sep).join('/');
      if (match(rel)) out.push({ full, rel });
    }
  }
  return out;
}

function cloudRoot() {
  const s = store.get('settings');
  if (!s.cloudFolder) throw new Error('Bulut klasoru secilmemis (Ayarlar > Bulut Kayit).');
  if (!fs.existsSync(s.cloudFolder)) throw new Error('Bulut klasoru bulunamadi: ' + s.cloudFolder);
  return path.join(s.cloudFolder, 'RetroHub-Saves');
}

function copyKeepTime(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = dst + '.rh-tmp';
  fs.copyFileSync(src, tmp);
  const st = fs.statSync(src);
  fs.utimesSync(tmp, st.atime, st.mtime);
  fs.renameSync(tmp, dst);
}

const isNewer = (a, b) => fs.statSync(a).mtimeMs > fs.statSync(b).mtimeMs + 2000;

// Oyun baslamadan once: bulutta daha yeni olan kayitlari yerel klasore al.
function syncDown(log) {
  const root = cloudRoot();
  let count = 0;
  for (const r of localRoots()) {
    const cdir = path.join(root, r.prefix);
    if (!fs.existsSync(cdir)) continue;
    for (const f of walk(cdir, (rel) => !rel.endsWith('.rh-tmp'))) {
      const local = path.join(r.dir, f.rel);
      if (!fs.existsSync(local) || isNewer(f.full, local)) {
        if (fs.existsSync(local)) fs.copyFileSync(local, local + '.retrohub-bak');
        copyKeepTime(f.full, local);
        count++;
        log && log(`Buluttan alindi: ${f.rel}`);
      }
    }
  }
  return count;
}

// Oyun kapandiktan sonra: yerelde daha yeni olan kayitlari buluta yaz.
function syncUp(log) {
  const root = cloudRoot();
  let count = 0;
  for (const r of localRoots()) {
    for (const f of walk(r.dir, r.match)) {
      const remote = path.join(root, r.prefix, f.rel);
      if (!fs.existsSync(remote) || isNewer(f.full, remote)) {
        copyKeepTime(f.full, remote);
        count++;
        log && log(`Buluta yuklendi: ${f.rel}`);
      }
    }
  }
  return count;
}

function listLocalSaves() {
  return localRoots().flatMap((r) => walk(r.dir, r.match).map((f) => `${r.prefix}/${f.rel}`));
}

module.exports = { syncDown, syncUp, listLocalSaves };
