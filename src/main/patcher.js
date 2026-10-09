const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const store = require('./store');
const { matchScore } = require('./scanner');

// Turkce fan-yamalari genelde iki formattan biriyle dagitilir:
//  - .ppf  (PPF1.0 / PPF2.0 / PPF3.0)  -> cogunlukla PS2 yamalarinda
//  - .xdelta / .vcdiff                  -> cogunlukla GameCube (Dolphin) yamalarinda
//
// Her iki durumda da ISO once yedeklenir (<isim>.orig.iso), sonra yama uygulanir.

const RAW_PATCHABLE = ['.iso', '.gcm', '.bin'];

function backupOriginal(filePath) {
  const backupPath = filePath.replace(/(\.[^.]+)$/, '.orig$1');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

function applyPpf(isoPath, ppfPath) {
  const ppf = fs.readFileSync(ppfPath);
  const magic = ppf.toString('ascii', 0, 5);
  if (magic !== 'PPF30' && magic !== 'PPF20' && magic !== 'PPF10') {
    throw new Error('Taninmayan PPF formati');
  }
  const version = parseInt(magic[3], 10); // PPF10 -> 1, PPF20 -> 2, PPF30 -> 3

  // Ortak baslik: magic(5) + encoding(1) + aciklama(50) = 56 bayt
  let offset = 56;
  let hasUndo = false;

  if (version === 3) {
    // imagetype(1) + blockcheck(1) + undo(1) + dummy(1)
    const blockCheck = ppf.readUInt8(offset + 1);
    hasUndo = ppf.readUInt8(offset + 2) === 1;
    offset += 4;
    if (blockCheck === 1) offset += 1024; // dogrulama blogu
  } else if (version === 2) {
    offset += 4;     // hedef imaj boyutu
    offset += 1024;  // dogrulama blogu
  }
  // version 1: ek baslik yok

  // PPF2/3 dosyalarinin sonuna FILE_ID.DIZ eklenmis olabilir; kayit okumayi orada kes.
  let end = ppf.length;
  const diz = ppf.lastIndexOf('@BEGIN_FILE_ID.DIZ', ppf.length, 'latin1');
  if (diz !== -1 && diz >= offset) end = diz;

  const fd = fs.openSync(isoPath, 'r+');
  try {
    while (offset < end) {
      let patchOffset;
      if (version === 3) {
        patchOffset = Number(ppf.readBigUInt64LE(offset));
        offset += 8;
      } else {
        patchOffset = ppf.readUInt32LE(offset);
        offset += 4;
      }
      const length = ppf.readUInt8(offset);
      offset += 1;
      const data = Buffer.from(ppf.subarray(offset, offset + length));
      offset += length;
      if (hasUndo) offset += length; // geri-alma verisi, uygulamada gerekmiyor
      fs.writeSync(fd, data, 0, data.length, patchOffset);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function applyXdelta(isoPath, xdeltaPath, outputPath) {
  return new Promise((resolve, reject) => {
    const settings = store.get('settings');
    const exePath = settings.xdelta3Path;
    if (!exePath) {
      reject(new Error(
        'xdelta3 araci ayarlanmamis. .xdelta uzantili yamalar icin Ayarlar sekmesinden ' +
        'xdelta3.exe yolunu sec (https://github.com/jmacd/xdelta adresinden indirilebilir).'
      ));
      return;
    }
    const args = ['-d', '-s', isoPath, xdeltaPath, outputPath];
    const child = spawn(exePath, args);
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('xdelta3 hata verdi: ' + stderr));
    });
  });
}

// game: store'daki oyun kaydi, patchFilePath: kullanicinin sectigi .ppf/.xdelta dosyasi
async function applyPatch(game, patchFilePath, patchLabel) {
  const ext = path.extname(patchFilePath).toLowerCase();

  // Yama sadece ham (sikistirilmamis) imajlara uygulanabilir. Sikistirilmis
  // formatlarda bayt ofsetleri tutmaz, dosya bozulur -> baslamadan reddet.
  const gameExt = path.extname(game.filePath).toLowerCase();
  if (!RAW_PATCHABLE.includes(gameExt)) {
    throw new Error(
      `${gameExt} formatina yama uygulanamaz (sikistirilmis imaj). ` +
      'Once oyunu ham .iso\'ya cevir (GameCube: Dolphin -> sag tik -> Convert File; ' +
      'PS2 .chd: chdman extractcd/extracthd ile), yamayi uygula, istersen sonra tekrar sikistir.'
    );
  }
  backupOriginal(game.filePath);

  if (ext === '.ppf') {
    applyPpf(game.filePath, patchFilePath);
  } else if (ext === '.xdelta' || ext === '.vcdiff') {
    const tmpOut = game.filePath + '.patched.tmp';
    await applyXdelta(game.filePath, patchFilePath, tmpOut);
    fs.rmSync(game.filePath, { force: true });
    fs.renameSync(tmpOut, game.filePath);
  } else {
    throw new Error('Desteklenmeyen yama formati: ' + ext + ' (sadece .ppf ve .xdelta destekleniyor)');
  }

  const games = store.get('games');
  const g = games[game.id];
  if (g) {
    g.patched = true;
    g.patchNote = patchLabel || path.basename(patchFilePath);
    games[game.id] = g;
    store.set('games', games);
  }
  return g;
}

function restoreOriginal(game) {
  const backupPath = game.filePath.replace(/(\.[^.]+)$/, '.orig$1');
  if (!fs.existsSync(backupPath)) {
    throw new Error('Yedek dosya bulunamadi, geri alinamiyor.');
  }
  fs.copyFileSync(backupPath, game.filePath);
  const games = store.get('games');
  const g = games[game.id];
  if (g) {
    g.patched = false;
    g.patchNote = null;
    games[game.id] = g;
    store.set('games', games);
  }
  return g;
}

// patchesFolder icindeki .ppf/.xdelta dosyalarini, dosya adi oyun basligina
// benzeyen oyunlarla otomatik eslestirir. Dosya uygulanmadan ONCE sadece
// oneri listesini dondurur; gercek uygulama applyPatch ile, kullanici onayindan
// sonra yapilir (sessizce ISO'lari degistirmemek icin).
function findAutoMatches(patchesFolder, games) {
  if (!patchesFolder || !fs.existsSync(patchesFolder)) return [];

  const files = fs.readdirSync(patchesFolder).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.ppf' || ext === '.xdelta' || ext === '.vcdiff';
  });

  const suggestions = [];
  for (const file of files) {
    const fileTitle = path.basename(file, path.extname(file));
    let best = null;
    for (const game of games) {
      if (game.patched) continue; // zaten yamali oyunlari tekrar onerme
      const score = matchScore(fileTitle, game.title);
      if (score >= 0.6 && (!best || score > best.score)) {
        best = { game, score };
      }
    }
    if (best) {
      suggestions.push({
        patchFilePath: path.join(patchesFolder, file),
        patchFileName: file,
        gameId: best.game.id,
        gameTitle: best.game.title,
        score: best.score
      });
    }
  }
  // En yuksek eslesmeden dusuge sirala
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}

module.exports = { applyPatch, restoreOriginal, findAutoMatches };
