const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

const GC_EXT = ['.iso', '.gcm', '.rvz', '.wia', '.ciso', '.gcz'];
const PS2_EXT = ['.iso', '.bin', '.chd', '.cso', '.zso'];

function makeId(filePath) {
  return crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 12);
}

function cleanTitle(fileName) {
  let name = path.basename(fileName, path.extname(fileName));
  // Parantez/koseli parantez icindeki bolge-dil etiketlerini temizle: (USA), [!], (Turkce Yama) vs.
  name = name.replace(/[\[(][^\])]*[\])]/g, ' ');
  name = name.replace(/[_\.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name || path.basename(fileName, path.extname(fileName));
}

function scanFolder(folder, platform, extList) {
  const found = [];
  if (!folder || !fs.existsSync(folder)) return found;

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        // Yama oncesi alinan yedekleri (oyun.orig.iso) ve gecici dosyalari kutuphaneye ekleme
        if (/\.orig\.[^.]+$/i.test(entry.name) || /\.tmp$/i.test(entry.name)) continue;
        if (extList.includes(ext)) {
          found.push({ filePath: full, platform, title: cleanTitle(entry.name) });
        }
      }
    }
  };
  walk(folder);
  return found;
}

// Klasorleri tarar, store'daki games listesini gunceller (yeni bulunanlari ekler,
// artik var olmayan dosyalari kaldirir, mevcut playtime/patch bilgisini korur).
function syncLibrary() {
  const settings = store.get('settings');
  const existing = store.get('games');

  const foundGc = scanFolder(settings.gcFolder, 'gamecube', GC_EXT);
  const foundPs2 = scanFolder(settings.ps2Folder, 'ps2', PS2_EXT);
  const allFound = [...foundGc, ...foundPs2];

  const newGames = {};
  for (const item of allFound) {
    const id = makeId(item.filePath);
    const prev = existing[id];
    newGames[id] = {
      id,
      title: prev?.title || item.title,
      platform: item.platform,
      filePath: item.filePath,
      cover: prev?.cover || findCover(item.title, settings.coverFolder),
      totalPlaySeconds: prev?.totalPlaySeconds || 0,
      lastPlayed: prev?.lastPlayed || null,
      favorite: prev?.favorite || false,
      autoFps: prev?.autoFps !== false,
      patched: prev?.patched || false,
      patchNote: prev?.patchNote || null
    };
  }

  store.set('games', newGames);
  return Object.values(newGames);
}

function findCover(title, coverFolder) {
  if (!coverFolder || !fs.existsSync(coverFolder)) return null;
  const candidates = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const ext of candidates) {
    const p = path.join(coverFolder, title + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Baslik karsilastirmasi icin: kucuk harfe cevir, harf/rakam disindaki her seyi
// tek boslukla degistir, "turkce", "yama", "patch" gibi dosya-adi gurultusunu at.
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/turkce|türkçe|yama|patch|translation|ceviri|çeviri/gi, ' ')
    .replace(/[^a-z0-9ığüşöç]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bir dosya adinin (yama/kod dosyasi) hangi oyuna ait oldugunu, kelime
// ortaklamasina bakarak tahmin eder. Esiklenmis basit bir skor dondurur.
function matchScore(fileTitle, gameTitle) {
  const fWords = new Set(normalize(fileTitle).split(' ').filter((w) => w.length > 2));
  const gWords = new Set(normalize(gameTitle).split(' ').filter((w) => w.length > 2));
  if (fWords.size === 0 || gWords.size === 0) return 0;
  let overlap = 0;
  for (const w of fWords) if (gWords.has(w)) overlap++;
  return overlap / Math.min(fWords.size, gWords.size);
}

module.exports = { syncLibrary, makeId, cleanTitle, normalize, matchScore };
