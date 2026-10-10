// tools/fetch-codes.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CODES_REPO = path.join(ROOT, 'codes-repo');
const GC_DIR = path.join(CODES_REPO, 'gc');
const PS2_DIR = path.join(CODES_REPO, 'ps2');

[GC_DIR, PS2_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function gitClone(url, dest) {
  if (fs.existsSync(dest)) {
    execSync(`git -C "${dest}" pull --quiet`, { stdio: 'inherit' });
  } else {
    execSync(`git clone --depth 1 "${url}" "${dest}"`, { stdio: 'inherit' });
  }
}

async function fetchPS2Codes() {
  console.log('\nPS2 kodlari cekiliyor...');
  const tmpDir = path.join(ROOT, '.tmp', 'ps2-patches');
  gitClone('https://github.com/PCSX2/pcsx2_patches.git', tmpDir);

  const patchesDir = path.join(tmpDir, 'patches');
  if (!fs.existsSync(patchesDir)) {
    console.warn('patches klasoru yok');
    return;
  }

  const files = fs.readdirSync(patchesDir).filter(f => f.endsWith('.pnach'));
  let count = 0;
  for (const file of files) {
    const src = path.join(patchesDir, file);
    const content = fs.readFileSync(src, 'utf8');
    if (/60\s*FPS/i.test(content) || /\[60\s*FPS\]/i.test(content)) {
      const idMatch = file.match(/^([0-9A-F]{8})/i);
      if (idMatch) {
        fs.copyFileSync(src, path.join(PS2_DIR, file));
        count++;
      }
    }
  }
  console.log(`PS2: ${count} pnach kopyalandi.`);
}

async function fetchGameCubeCodes() {
  console.log('\nGameCube kodlari cekiliyor...');
  const tmpDir = path.join(ROOT, '.tmp', 'gc-codes');
  try {
    gitClone('https://github.com/Admentus64/Enhancement-Codes.git', tmpDir);
  } catch (e) {
    console.warn('GC deposu alinamadi:', e.message);
    return;
  }

  let count = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ini')) {
        const content = fs.readFileSync(full, 'utf8');
        const idFromName = entry.name.replace('.ini', '');
        if (!/^[A-Z0-9]{6}$/.test(idFromName)) continue;

        const lines = content.split(/\r?\n/);
        let collecting = false;
        let codeLines = [];
        let title = '';

        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('$') && /60\s*FPS/i.test(t)) {
            collecting = true;
            title = t.slice(1).trim();
            codeLines = [];
          } else if (collecting) {
            if (/^\$/.test(t)) {
              if (codeLines.length) {
                const outPath = path.join(GC_DIR, `${idFromName}.txt`);
                fs.writeFileSync(outPath, `$${title}\n${codeLines.join('\n')}\n`);
                count++;
              }
              collecting = false;
            } else if (/^[0-9A-F]{8}\s+[0-9A-F]{8}$/i.test(t)) {
              codeLines.push(t);
            }
          }
        }
        if (collecting && codeLines.length) {
          const outPath = path.join(GC_DIR, `${idFromName}.txt`);
          fs.writeFileSync(outPath, `$${title}\n${codeLines.join('\n')}\n`);
          count++;
        }
      }
    }
  }
  walk(tmpDir);
  console.log(`GameCube: ${count} kod kaydedildi.`);
}

(async () => {
  try {
    await fetchGameCubeCodes();
    await fetchPS2Codes();

    const tmpDir = path.join(ROOT, '.tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

    console.log('\nindex.json olusturuluyor...');
    execSync('node tools/make-index.js', { stdio: 'inherit', cwd: ROOT });
    console.log('\nTamamlandi!');
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
})();
