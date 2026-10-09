const fs = require('fs');
const path = require('path');

const paths = require('./paths');
const dolphinGameSettingsDir = () => path.join(paths.dolphinUserDir(), 'GameSettings');
const pcsx2PatchesDir = () => path.join(paths.pcsx2Dir(), 'patches');

// GameCube oyun ID'sini (orn. "GALE01") okur. Dolphin, oyuna ozel ayar/kodlari
// bu ID'ye gore eslestirir. Dosya formatina gore ID'nin yeri degisir:
//   .iso / .gcm : diskin ilk 6 bayti (ham imaj)
//   .rvz / .wia : dosya basligi "RVZ"/"WIA" ile baslar; orijinal disk basligi
//                 (ilk 0x80 bayt) dosyanin 0x58 ofsetinde saklanir
//   .ciso       : 0x8000 bayt baslik, sonra disk verisi baslar
//   .gcz        : blok-sikistirmali, ID dogrudan okunamaz -> dosya adindaki
//                 [GALE01] gibi etikete bakilir, yoksa acik hata verilir
function isGameId(str) {
  return /^[A-Z0-9]{6}$/.test(str);
}

function readAscii(fd, position, length) {
  const buf = Buffer.alloc(length);
  const n = fs.readSync(fd, buf, 0, length, position);
  return buf.subarray(0, n).toString('latin1');
}

function readGameCubeId(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const fd = fs.openSync(imagePath, 'r');
  try {
    const magic = readAscii(fd, 0, 4);
    let id = '';

    if (magic.startsWith('RVZ') || magic.startsWith('WIA')) {
      id = readAscii(fd, 0x58, 6);
    } else if (magic === 'CISO') {
      id = readAscii(fd, 0x8000, 6);
    } else if (ext === '.gcz') {
      id = '';
    } else {
      id = readAscii(fd, 0, 6);
    }

    if (isGameId(id)) return id;

    // Son care: dosya adinda [GALE01] / (GALE01) gibi bir ID etiketi var mi?
    const tagged = path.basename(imagePath).match(/[\[(]([A-Z0-9]{6})[\])]/);
    if (tagged) return tagged[1];

    throw new Error(
      ext === '.gcz'
        ? 'GCZ dosyalarindan oyun ID\'si okunamiyor. Dolphin\'de sag tik -> "Convert File" ile RVZ\'ye cevir, ya da dosya adina [GALE01] gibi ID etiketi ekle.'
        : 'Gecerli bir GameCube imaji degil, oyun ID\'si okunamadi.'
    );
  } finally {
    fs.closeSync(fd);
  }
}

// Var olan bir Dolphin GameSettings .ini metnine [Gecko]/[Gecko_Enabled]
// bolumlerini ekler ya da gunceller. Diger ayarlari (varsa) korur.
function mergeGeckoSection(existingText, codeName, codeLines) {
  const lines = existingText ? existingText.split(/\r?\n/) : [];
  const sectionStart = (name) => lines.findIndex((l) => l.trim() === `[${name}]`);
  const nextSectionIdx = (from) => {
    for (let i = from + 1; i < lines.length; i++) {
      if (/^\[.+\]$/.test(lines[i].trim())) return i;
    }
    return lines.length;
  };

  function upsertSection(sectionName, contentLines) {
    let idx = sectionStart(sectionName);
    if (idx === -1) {
      if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
      lines.push(`[${sectionName}]`, ...contentLines);
    } else {
      const end = nextSectionIdx(idx);
      const before = lines.slice(0, idx + 1);
      const after = lines.slice(end);
      lines.length = 0;
      lines.push(...before, ...contentLines, ...after);
    }
  }

  upsertSection('Gecko', [`$${codeName}`, ...codeLines, '']);
  upsertSection('Gecko_Enabled', [`$${codeName}`]);

  return lines.join('\n');
}

// GameCube icin: kullanicinin sectigi Gecko kod dosyasini (.txt, genelde
// 60fps/widescreen "cheat" iceren toplulukca paylasilan kod metni) Dolphin'in
// o oyuna ait GameSettings .ini dosyasina kurar ve etkinlestirir.
function installGeckoCode(game, codeFilePath) {
  const gameId = readGameCubeId(game.filePath);
  const raw = fs.readFileSync(codeFilePath, 'utf8');

  // Kod dosyasi hex kod satirlarindan olusur (orn. "0450XXXX 00000001").
  // $ ile baslayan bir baslik satiri varsa onu isim olarak kullan, yoksa
  // dosya adindan turet.
  const rawLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let codeName = path.basename(codeFilePath, path.extname(codeFilePath));
  let codeLines = rawLines;
  if (rawLines[0]?.startsWith('$')) {
    codeName = rawLines[0].slice(1).trim();
    codeLines = rawLines.slice(1);
  }
  // Sadece gecerli hex-kod gorunumlu satirlari al (guvenlik: rastgele metin yazilmasin)
  codeLines = codeLines.filter((l) => /^[0-9A-Fa-f]{8}\s+[0-9A-Fa-f]{8}$/.test(l));
  if (codeLines.length === 0) {
    throw new Error('Secilen dosyada gecerli bir Gecko kodu bulunamadi (hex satir formati beklenir).');
  }

  fs.mkdirSync(dolphinGameSettingsDir(), { recursive: true });
  const iniPath = path.join(dolphinGameSettingsDir(), `${gameId}.ini`);
  const existing = fs.existsSync(iniPath) ? fs.readFileSync(iniPath, 'utf8') : '';
  const merged = mergeGeckoSection(existing, codeName, codeLines);
  fs.writeFileSync(iniPath, merged, 'utf8');

  return { gameId, iniPath, codeName };
}

// PS2 icin: kullanicinin sectigi .pnach dosyasini (CRC'ye gore adlandirilmis,
// toplulukca paylasilan standart PCSX2 yama formati) PCSX2'nin patches
// klasorune kopyalar. PCSX2 ayarlarinda "Enable Cheats/Patches" kullanicinin
// bir kere elle acmasi gerekir (emulator surumune gore ayar yeri degisebildigi
// icin burada guvenli sekilde otomatik degistirilmiyor).
function installPnach(pnachFilePath) {
  fs.mkdirSync(pcsx2PatchesDir(), { recursive: true });
  const destName = path.basename(pnachFilePath);
  const destPath = path.join(pcsx2PatchesDir(), destName);
  fs.copyFileSync(pnachFilePath, destPath);
  return { destPath };
}

module.exports = { readGameCubeId, installGeckoCode, installPnach, dolphinGameSettingsDir, pcsx2PatchesDir };
