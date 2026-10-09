// "FPS Unlocker" - oyun acilmadan hemen once OTOMATIK calisir, dosya secmek gerekmez.
//
// Iki katman:
//  1) Performans profili (her oyunda calisir): Dolphin'de oyuna ozel .ini'ye CPU
//     overclock + hizli disk yazar; PCSX2'de yama/cheat sistemini acar. Bu,
//     emulatorun yavaslamasindan kaynaklanan FPS dususlerini giderir.
//  2) Oyuna ozel 60 FPS kodu: oyunun ID'si (GC) / CRC'si (PS2) bulunur, codes/
//     klasorunde (veya Ayarlar'daki kendi kod klasorunde) eslesen dosya varsa
//     otomatik kurulur. Gercek "30 -> 60" acma islemi oyuna ozel koddur;
//     evrensel bir yolu yoktur, bu yuzden kod havuzu buyudukce kapsam artar.
const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const { setKeys, addValues } = require('./ini');
const cheats = require('./cheats');
const codes = require('./codes');

const BUNDLED = path.join(__dirname, '..', '..', 'codes');

// ---- PS2: oyunun CRC'sini (PCSX2'nin pnach dosya adi) ISO'dan hesapla ----
function readDirEntry(fd, lba, size, wanted) {
  const buf = Buffer.alloc(size);
  fs.readSync(fd, buf, 0, size, lba * 2048);
  let o = 0;
  while (o < size) {
    const len = buf[o];
    if (len === 0) { o = (Math.floor(o / 2048) + 1) * 2048; continue; }
    const nameLen = buf[o + 32];
    const name = buf.toString('latin1', o + 33, o + 33 + nameLen).replace(/;\d+$/, '');
    if (name.toLowerCase() === wanted.toLowerCase()) {
      return { lba: buf.readUInt32LE(o + 2), size: buf.readUInt32LE(o + 10) };
    }
    o += len;
  }
  return null;
}

function readPs2Info(isoPath) {
  if (path.extname(isoPath).toLowerCase() !== '.iso') return null;
  const fd = fs.openSync(isoPath, 'r');
  try {
    const pvd = Buffer.alloc(2048);
    fs.readSync(fd, pvd, 0, 2048, 16 * 2048);
    if (pvd.toString('latin1', 1, 6) !== 'CD001') return null;
    const rootLba = pvd.readUInt32LE(158);
    const rootSize = pvd.readUInt32LE(166);

    const cnf = readDirEntry(fd, rootLba, rootSize, 'SYSTEM.CNF');
    if (!cnf) return null;
    const cb = Buffer.alloc(cnf.size);
    fs.readSync(fd, cb, 0, cnf.size, cnf.lba * 2048);
    const m = cb.toString('latin1').match(/BOOT2\s*=\s*cdrom0:\\?([^;\s]+)/i);
    if (!m) return null;
    const elfName = m[1].split(/[\\/]/).pop();
    const serial = elfName.toUpperCase();

    const elf = readDirEntry(fd, rootLba, rootSize, elfName);
    if (!elf) return null;
    let crc = 0;
    const chunk = Buffer.alloc(1 << 20);
    let done = 0;
    while (done < elf.size) {
      const want = Math.min(chunk.length, elf.size - done);
      const n = fs.readSync(fd, chunk, 0, want, elf.lba * 2048 + done);
      if (n <= 0) break;
      const words = Math.floor(n / 4);
      for (let i = 0; i < words; i++) crc ^= chunk.readUInt32LE(i * 4);
      done += words * 4;
      if (words === 0) break;
    }
    return { crc: (crc >>> 0).toString(16).toUpperCase().padStart(8, '0'), serial };
  } finally {
    fs.closeSync(fd);
  }
}

function computePs2Crc(isoPath) {
  const info = readPs2Info(isoPath);
  return info ? info.crc : null;
}

let repo = null;
function setRepo(r) { repo = r; }

function searchFolders(sub, settings) {
  const list = [path.join(BUNDLED, sub)];
  if (settings.fpsCodesFolder) list.push(settings.fpsCodesFolder, path.join(settings.fpsCodesFolder, sub));
  return list;
}

function findCodeFile(names, folders) {
  for (const dir of folders) {
    for (const n of names) {
      const p = path.join(dir, n);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// Oyunun kimligini (GC ID / PS2 CRC), bolgesini ve kod durumunu detay panelinde gostermek icin.
function identify(game) {
  const kind = game.platform === 'gamecube' ? 'Game ID' : 'CRC';
  try {
    let id, region, serial = null;
    if (game.platform === 'gamecube') {
      id = cheats.readGameCubeId(game.filePath);
      region = codes.gcRegion(id);
    } else {
      const info = readPs2Info(game.filePath);
      id = info ? info.crc : null;
      serial = info ? info.serial : null;
      region = info ? codes.ps2Region(serial) : 'Bilinmiyor';
    }
    const out = { id, kind, region, serial };
    if (id && repo) {
      const a = repo.availability(game.platform, id);
      out.codeStatus = a.exact ? 'var' : 'yok';
      out.otherRegions = a.otherRegions;
    }
    return out;
  } catch (e) {
    return { id: null, kind, error: e.message };
  }
}

// Oyun acilmadan once cagrilir. Kullaniciya gosterilecek kisa notlari dondurur.
async function prepare(game, settings) {
  const notes = [];
  if (!settings.autoFps || game.autoFps === false) return notes;

  if (game.platform === 'gamecube') {
    const id = cheats.readGameCubeId(game.filePath);
    const dir = cheats.dolphinGameSettingsDir();
    fs.mkdirSync(dir, { recursive: true });
    const iniPath = path.join(dir, `${id}.ini`);
    const before = fs.existsSync(iniPath) ? fs.readFileSync(iniPath, 'utf8') : '';
    const after = setKeys(before, 'Core', { OverclockEnable: 'True', Overclock: '1.5', FastDiscSpeed: 'True' });
    fs.writeFileSync(iniPath, after, 'utf8');
    notes.push('Performans profili uygulandi (CPU x1.5, hizli disk).');

    let codeFile = findCodeFile([`${id}.txt`], searchFolders('gc', settings));
    if (!codeFile && repo) codeFile = await repo.getCodeFile('gamecube', id).catch(() => null);
    if (codeFile) {
      const res = cheats.installGeckoCode(game, codeFile);
      notes.push(`60 FPS kodu kuruldu: ${res.codeName} (${codes.gcRegion(id)})`);
    } else if (repo) {
      const a = repo.availability('gamecube', id);
      if (a.otherRegions.length) {
        notes.push(`Bu bolge (${codes.gcRegion(id)}) icin 60 FPS kodu yok; ${a.otherRegions.join('/')} icin var. Yanlis bolge kodu oyunu cokertir, kurulmadi.`);
      }
    }
  } else {
    const root = paths.pcsx2Dir();
    const iniPath = path.join(root, 'inis', 'PCSX2.ini');
    if (fs.existsSync(iniPath)) {
      const before = fs.readFileSync(iniPath, 'utf8');
      const after = setKeys(before, 'EmuCore', { EnableCheats: 'true', EnablePatches: 'true' });
      if (after !== before) fs.writeFileSync(iniPath, after, 'utf8');
    }
    const info = readPs2Info(game.filePath);
    if (info) {
      const crc = info.crc;
      const files = [];
      const own = findCodeFile([`${crc}.pnach`], searchFolders('ps2', settings));
      if (own) files.push(own);
      if (repo) files.push(...repo.ps2Files(crc));
      if (files.length) {
        const groups = new Set();
        for (const file of files) {
          cheats.installPnach(file);
          codes.pnachGroups(fs.readFileSync(file, 'utf8')).filter(codes.isFpsGroup).forEach((g) => groups.add(g));
        }
        // PCSX2 gruplari oyun basina elle acmayi bekler; 50/60 FPS gruplarini biz aciyoruz.
        if (groups.size) {
          const serial = (info.serial || '').replace('_', '-').replace('.', '');
          const gsDir = path.join(root, 'gamesettings');
          fs.mkdirSync(gsDir, { recursive: true });
          const gsPath = path.join(gsDir, `${serial}_${crc}.ini`);
          const before = fs.existsSync(gsPath) ? fs.readFileSync(gsPath, 'utf8') : '';
          fs.writeFileSync(gsPath, addValues(before, 'Patches', 'Enable', [...groups]), 'utf8');
          notes.push(`60 FPS yamasi kuruldu ve acildi: ${[...groups].join(', ')} (${crc}).`);
        } else {
          notes.push(`Yama kuruldu (${crc}) ama icinde 60 FPS grubu yok (sadece genis ekran vb.).`);
        }
      }
    }
  }
  return notes;
}

module.exports = { prepare, identify, computePs2Crc, readPs2Info, setRepo };
