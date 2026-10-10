const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

// Windows'ta "Belgeler" klasoru OneDrive'a tasinmis olabilir; hepsini dener.
const docsRoots = [
  path.join(home, 'Documents'),
  path.join(home, 'OneDrive', 'Documents'),
  path.join(home, 'OneDrive', 'Belgeler'),
  appdata
];

function findUserDir(name) {
  for (const root of docsRoots) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(docsRoots[0], name);
}

// Ayarlardaki emulator yollari (main.js verir). Portable kurulumlari tanimak icin gerekli.
let emuPaths = {};
function configure(settings) { emuPaths = { dolphinPath: settings.dolphinPath, pcsx2Path: settings.pcsx2Path }; }

// Dolphin: exe yaninda portable.txt varsa veri klasoru "User"; yoksa Belgeler/AppData.
function dolphinUserDir() {
  const exe = emuPaths.dolphinPath;
  if (exe) {
    const d = path.dirname(exe);
    if (fs.existsSync(path.join(d, 'portable.txt'))) return path.join(d, 'User');
  }
  return findUserDir('Dolphin Emulator');
}
// PCSX2: exe yaninda portable.ini (veya portable.txt) varsa veri klasoru exe klasoru.
function pcsx2Dir() {
  const exe = emuPaths.pcsx2Path;
  if (exe) {
    const d = path.dirname(exe);
    if (fs.existsSync(path.join(d, 'portable.ini')) || fs.existsSync(path.join(d, 'portable.txt'))) return d;
  }
  return findUserDir('PCSX2');
}
// Teshis icin: hangi klasor kullaniliyor ve gercekten bir emulator klasoru gibi mi?
function describeDirs() {
  const pc = pcsx2Dir(), dl = dolphinUserDir();
  return {
    pcsx2: { dir: pc, exists: fs.existsSync(path.join(pc, 'inis')) },
    dolphin: { dir: dl, exists: fs.existsSync(path.join(dl, 'Config')) || fs.existsSync(path.join(dl, 'GameSettings')) }
  };
}

// Emulatorleri tipik yerlerde (ve Masaustu/Indirilenler altinda 3 seviye) arar.
function walkFind(dir, matchers, depth, out) {
  if (depth < 0) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(node_modules|\$Recycle\.Bin|Windows|AppData)$/i.test(e.name)) continue;
      walkFind(full, matchers, depth - 1, out);
    } else {
      for (const [key, re] of Object.entries(matchers)) {
        if (!out[key] && re.test(e.name)) out[key] = full;
      }
    }
  }
}

function detectEmulators() {
  const out = {};
  const matchers = {
    dolphinPath: /^dolphin\.exe$/i,
    pcsx2Path: /^pcsx2(-qt)?(-avx2)?(-x64)?(-avx2)?\.exe$|^pcsx2.*\.exe$/i
  };
  const pf = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], 'C:\\', 'D:\\']
    .filter(Boolean);
  const roots = [
    ...pf,
    path.join(home, 'Desktop'),
    path.join(home, 'Downloads'),
    path.join(home, 'Documents'),
    path.join(home, 'Masaüstü'),
    path.join(home, 'İndirilenler')
  ];
  for (const r of roots) {
    walkFind(r, matchers, r.length <= 3 ? 2 : 3, out);
    if (out.dolphinPath && out.pcsx2Path) break;
  }
  return out;
}

module.exports = { dolphinUserDir, pcsx2Dir, detectEmulators, configure, describeDirs };
