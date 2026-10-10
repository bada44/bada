// tools/fetch-codes.js
const fs = require('fs');
const path = require('path');
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
    try { execSync(`git -C "${dest}" pull --quiet`, { stdio: 'pipe' }); } catch(e) {}
  } else {
    execSync(`git clone --depth 1 "${url}" "${dest}"`, { stdio: 'inherit' });
  }
}

// ==================== PS2 ====================
function fetchPS2FromPCSX2() {
  console.log('\n[PS2-1] PCSX2 resmi yama deposu...');
  const tmp = path.join(ROOT, '.tmp', 'ps2-official');
  try {
    gitClone('https://github.com/PCSX2/pcsx2_patches.git', tmp);
  } catch (e) { console.warn('  Alinamadi:', e.message); return; }

  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.pnach')) {
        const content = fs.readFileSync(full, 'utf8');
        // 60 FPS içeren tüm pnach dosyalarını al
        if (/60\s*FPS/i.test(content) || /\[60\s*FPS/i.test(content)) {
          // pnach dosya adı formatı: SLUS-21503_6FB69282.pnach
          const idMatch = entry.name.match(/_([0-9A-F]{8})\.pnach$/i);
          if (idMatch) {
            fs.copyFileSync(full, path.join(PS2_DIR, entry.name));
            count++;
          }
        }
      }
    }
  }
  walk(tmp);
  console.log(`  -> ${count} pnach kopyalandi.`);
}

function fetchPS2FromPeterDelta() {
  console.log('\n[PS2-2] PeterDelta topluluk deposu...');
  const tmp = path.join(ROOT, '.tmp', 'ps2-peterdelta');
  try {
    gitClone('https://github.com/PeterDelta/PCSX2-Patch.git', tmp);
  } catch (e) { console.warn('  Alinamadi:', e.message); return; }

  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.pnach')) {
        const content = fs.readFileSync(full, 'utf8');
        if (/60\s*FPS/i.test(content)) {
          const idMatch = entry.name.match(/_([0-9A-F]{8})\.pnach$/i);
          if (idMatch) {
            const dest = path.join(PS2_DIR, entry.name);
            if (!fs.existsSync(dest)) {  // resmi depodan geleni ezme
              fs.copyFileSync(full, dest);
              count++;
            }
          }
        }
      }
    }
  }
  walk(tmp);
  console.log(`  -> ${count} ek pnach kopyalandi.`);
}

// ==================== GameCube ====================
function fetchGCFromLibretro() {
  console.log('\n[GC-1] Libretro Database...');
  const tmp = path.join(ROOT, '.tmp', 'libretro-db');
  try {
    gitClone('https://github.com/libretro/libretro-database.git', tmp);
  } catch (e) { console.warn('  Alinamadi:', e.message); return; }

  // RetroArch cheat dosyaları: cheats/GameCube/*.cht
  const cheatDir = path.join(tmp, 'cht', 'Nintendo - GameCube');
  if (!fs.existsSync(cheatDir)) {
    console.warn('  GameCube cheat klasoru yok:', cheatDir);
    return;
  }

  let count = 0;
  for (const file of fs.readdirSync(cheatDir)) {
    if (!file.endsWith('.cht')) continue;
    const content = fs.readFileSync(path.join(cheatDir, file), 'utf8');

    // 60 FPS içeren cheat'leri al
    if (!/60\s*FPS/i.test(content)) continue;

    // Oyun ID'sini çıkar
    const idMatch = file.match(/\(([A-Z0-9]{6})\)/) || content.match(/gameid\s*=\s*"?([A-Z0-9]{6})/i);
    if (!idMatch) continue;

    const gameId = idMatch[1];
    // Cheat içeriğini basit Gecko formatına çevir
    // (cheat dosyası RetroArch .cht formatında, içindeki kod satırlarını çek)
    const codeLines = [];
    const lines = content.split(/\r?\n/);
    let inCode = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^cheat\d+_desc\s*=\s*".*60\s*FPS/i.test(t)) { inCode = true; continue; }
      if (inCode && /^cheat\d+_code\s*=\s*"([^"]+)"/.test(t)) {
        const m = t.match(/^cheat\d+_code\s*=\s*"([^"]+)"/);
        // RetroArch formatı: "04123456 789ABCDE" veya "+04123456 789ABCDE"
        const code = m[1].replace(/^\+/, '').trim();
        if (/^[0-9A-F]{8}\s+[0-9A-F]{8}$/i.test(code)) {
          codeLines.push(code);
        }
      }
      if (inCode && /^cheat\d+_desc/.test(t) && !/60\s*FPS/i.test(t)) {
        if (codeLines.length > 0) break;
      }
    }

    if (codeLines.length > 0) {
      const out = path.join(GC_DIR, `${gameId}.txt`);
      fs.writeFileSync(out, `$60 FPS\n${codeLines.join('\n')}\n`);
      count++;
    }
  }
  console.log(`  -> ${count} GameCube kodu yazildi.`);
}

function fetchGCFromEnhancement() {
  console.log('\n[GC-2] Enhancement-Codes deposu...');
  const tmp = path.join(ROOT, '.tmp', 'gc-enhancement');
  try {
    gitClone('https://github.com/Admentus64/Enhancement-Codes.git', tmp);
  } catch (e) { console.warn('  Alinamadi:', e.message); return; }

  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ini')) {
        const gameId = entry.name.replace('.ini', '');
        if (!/^[A-Z0-9]{6}$/.test(gameId)) continue;
        const content = fs.readFileSync(full, 'utf8');

        // $60 FPS bölümünü çek
        const lines = content.split(/\r?\n/);
        let collecting = false, codeLines = [];
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('$') && /60\s*FPS/i.test(t)) {
            collecting = true;
            codeLines = [];
          } else if (collecting) {
            if (/^\$/.test(t)) {
              if (codeLines.length > 0) {
                const out = path.join(GC_DIR, `${gameId}.txt`);
                if (!fs.existsSync(out)) {
                  fs.writeFileSync(out, `$60 FPS\n${codeLines.join('\n')}\n`);
                  count++;
                }
              }
              collecting = false;
            } else if (/^[0-9A-F]{8}\s+[0-9A-F]{8}$/i.test(t)) {
              codeLines.push(t);
            }
          }
        }
        if (collecting && codeLines.length > 0) {
          const out = path.join(GC_DIR, `${gameId}.txt`);
          if (!fs.existsSync(out)) {
            fs.writeFileSync(out, `$60 FPS\n${codeLines.join('\n')}\n`);
            count++;
          }
        }
      }
    }
  }
  walk(tmp);
  console.log(`  -> ${count} ek GameCube kodu yazildi.`);
}

// ==================== Ana ====================
(async () => {
  try {
    // PS2
    fetchPS2FromPCSX2();
    fetchPS2FromPeterDelta();

    // GameCube
    fetchGCFromLibretro();
    fetchGCFromEnhancement();

    // Temizlik
    const tmpDir = path.join(ROOT, '.tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

    // index oluştur
    console.log('\nindex.json olusturuluyor...');
    execSync('node tools/make-index.js', { stdio: 'inherit', cwd: ROOT });

    // Özet
    const gcCount = fs.readdirSync(GC_DIR).filter(f => f.endsWith('.txt')).length;
    const ps2Count = fs.readdirSync(PS2_DIR).filter(f => f.endsWith('.pnach')).length;
    console.log(`\nOZET: GC=${gcCount}, PS2=${ps2Count}`);
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
})();
