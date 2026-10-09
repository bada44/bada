// Kod deposu: oyun ID'si / CRC'ye gore 60 FPS kodlarini internetten ceker ve yerelde saklar.
//
// Iki kaynak:
//  1) PS2: PCSX2'nin resmi yama paketi (patches.zip; dosyalar CRC ile adlandirilmis .pnach).
//  2) Senin deponun (GitHub raw vb.): <depo>/index.json + kod dosyalari. GameCube kodlari buradan gelir.
//
// index.json bicimi:
//   { "version": 1,
//     "gc":  { "GALE01": { "title": "Super Smash Bros. Melee", "file": "gc/GALE01.txt" } },
//     "ps2": { "1A2B3C4D": { "title": "Oyun adi", "file": "ps2/1A2B3C4D.pnach" } } }
//
// Bolge kurali: kod bellek adreslerini degistirir, bu yuzden SADECE tam eslesen ID/CRC kurulur.
// Baska bolgenin kodu varsa kurulmaz, sadece kullaniciya bilgi olarak gosterilir.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_PCSX2_ZIP = 'https://github.com/PCSX2/pcsx2_patches/releases/latest/download/patches.zip';
const COMMUNITY_PS2_ZIP = 'https://github.com/PeterDelta/PCSX2/archive/refs/heads/main.zip';
const MAX_AGE_MS = 24 * 3600 * 1000;      // indeksi gunde bir yenile
const ZIP_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const GC_REGIONS = { E: 'USA', P: 'PAL', J: 'JAP', K: 'KOR', U: 'AUS', D: 'PAL', F: 'PAL', S: 'PAL', I: 'PAL', X: 'PAL', Y: 'PAL', H: 'PAL' };

// GameCube ID'sinin 4. harfi bolgeyi verir (GALE01 -> E -> USA).
function gcRegion(id) {
  return (id && GC_REGIONS[id[3]]) || 'Bilinmiyor';
}
// PS2 seri numarasi (SLUS_209.54): SLUS/SCUS=USA, SLES/SCES=PAL, SLPS/SLPM/SCPS/SCAJ=JAP...
function ps2Region(serial) {
  const p = (serial || '').toUpperCase().slice(0, 4);
  if (['SLUS', 'SCUS', 'PBPX', 'PAPX'].includes(p)) return 'USA';
  if (['SLES', 'SCES', 'SCED', 'SLED'].includes(p)) return 'PAL';
  if (['SLPS', 'SLPM', 'SCPS', 'SCPM', 'SIPS', 'SCAJ'].includes(p)) return 'JAP';
  if (['SLKA', 'SCKA'].includes(p)) return 'KOR';
  return 'Bilinmiyor';
}

// "SLUS-20202_F00293CA.pnach" veya "F00293CA.pnach" -> { serial, crc }
function parsePnachName(base) {
  const m = base.match(/^(?:([A-Z]{4}-\d{5})[_ ])?([0-9A-Fa-f]{8})(?:[ _.\-][^/]*)?\.pnach$/);
  return m ? { serial: m[1] || null, crc: m[2].toUpperCase() } : null;
}
// pnach icindeki adli gruplari ([60 FPS], [Widescreen 16:9]...) listeler.
function pnachGroups(text) {
  return [...text.matchAll(/^\s*\[([^\]\r\n]+)\]\s*$/gm)].map((m) => m[1].trim());
}
const isFpsGroup = (name) => /\b(50|60|fps)\b/i.test(name) && !/disable|no[- ]?fps/i.test(name);

// ---------- Minimal ZIP okuyucu (bagimlilik yok) ----------
function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Gecersiz ZIP dosyasi');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bozuk ZIP dizini');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (data) out.push({ name, data });
  }
  return out;
}

// ---------- Depo ----------
function create({ cacheDir, fetchBuffer, now = () => Date.now() }) {
  const dir = (...p) => path.join(cacheDir, ...p);
  const ensure = (d) => fs.mkdirSync(d, { recursive: true });

  const readIndex = () => {
    try { return JSON.parse(fs.readFileSync(dir('index.json'), 'utf8')); } catch (e) { return { gc: {}, ps2: {} }; }
  };
  const fresh = (file, maxAge) => {
    try { return now() - fs.statSync(file).mtimeMs < maxAge; } catch (e) { return false; }
  };

  async function updateIndex(settings, { force = false } = {}) {
    const report = { index: 0, ps2: 0, errors: [] };
    ensure(cacheDir);

    const repo = (settings.codeRepoUrl || '').trim();
    if (repo && (force || !fresh(dir('index.json'), MAX_AGE_MS))) {
      try {
        const buf = await fetchBuffer(repo);
        const json = JSON.parse(buf.toString('utf8'));
        if (!json || typeof json !== 'object') throw new Error('index.json okunamadi');
        json.gc = json.gc || {}; json.ps2 = json.ps2 || {};
        json.base = repo.replace(/[^/]*$/, '');
        fs.writeFileSync(dir('index.json'), JSON.stringify(json));
        report.index = Object.keys(json.gc).length + Object.keys(json.ps2).length;
      } catch (e) { report.errors.push('Kod deposu: ' + e.message); }
    }

    const sources = [];
    if (settings.usePcsx2Patches !== false) sources.push({ key: 'official', url: settings.pcsx2PatchesUrl || DEFAULT_PCSX2_ZIP, label: 'PCSX2 yama paketi', onlyInPatchesDir: false });
    if (settings.useCommunityPatches !== false) sources.push({ key: 'community', url: COMMUNITY_PS2_ZIP, label: 'Topluluk 60 FPS yamalari', onlyInPatchesDir: true });
    for (const src of sources) {
      const stamp = dir(`ps2-${src.key}.stamp`);
      if (!force && fresh(stamp, ZIP_MAX_AGE_MS)) continue;
      try {
        const entries = readZipEntries(await fetchBuffer(src.url));
        ensure(dir('ps2'));
        for (const e of entries) {
          if (src.onlyInPatchesDir && !/(^|\/)patches\/[^/]+$/.test(e.name)) continue;
          const base = path.basename(e.name);
          const info = parsePnachName(base);
          if (!info) continue;
          fs.writeFileSync(dir('ps2', base), e.data);
          report.ps2++;
        }
        fs.writeFileSync(stamp, String(now()));
      } catch (e) { report.errors.push(src.label + ': ' + e.message); }
    }
    return report;
  }

  // Bir CRC icin onbellekteki tum .pnach dosyalari (resmi + topluluk olabilir).
  function ps2Files(crc) {
    if (!crc) return [];
    try {
      return fs.readdirSync(dir('ps2'))
        .filter((f) => { const i = parsePnachName(f); return i && i.crc === crc.toUpperCase(); })
        .map((f) => dir('ps2', f));
    } catch (e) { return []; }
  }

  // Oyun icin kod dosyasini bulur; yoksa depodan indirir. Yolunu ya da null dondurur.
  async function getCodeFile(platform, id) {
    if (!id) return null;
    const kind = platform === 'gamecube' ? 'gc' : 'ps2';
    const ext = kind === 'gc' ? '.txt' : '.pnach';
    if (kind === 'ps2') return ps2Files(id)[0] || null;
    const local = dir(kind, id + ext);
    if (fs.existsSync(local)) return local;
    const idx = readIndex();
    const entry = idx[kind] && idx[kind][id];
    if (!entry || !entry.file || !idx.base) return null;
    const rel = String(entry.file).replace(/^[/\\]+/, '');
    if (rel.includes('..')) return null;
    const buf = await fetchBuffer(/^https?:/i.test(rel) ? rel : idx.base + rel);
    ensure(dir(kind));
    fs.writeFileSync(local, buf);
    return local;
  }

  // Bolge durumu: bu oyun icin kod var mi, baska bolgelerde var mi?
  function availability(platform, id) {
    const kind = platform === 'gamecube' ? 'gc' : 'ps2';
    const ext = kind === 'gc' ? '.txt' : '.pnach';
    const idx = readIndex();
    const has = (x) => (kind === 'ps2' ? ps2Files(x).length > 0 : fs.existsSync(dir(kind, x + ext)) || !!(idx[kind] && idx[kind][x]));
    const exact = !!id && has(id);
    const others = [];
    if (kind === 'gc' && id) {
      const prefix = id.slice(0, 3);
      const known = new Set([...Object.keys(idx.gc || {})]);
      try { fs.readdirSync(dir('gc')).forEach((f) => known.add(f.replace(/\.txt$/, ''))); } catch (e) { /* bos */ }
      for (const k of known) {
        if (k !== id && k.startsWith(prefix) && /^[A-Z0-9]{6}$/.test(k)) others.push(gcRegion(k));
      }
    }
    return { exact, otherRegions: [...new Set(others)] };
  }

  return { updateIndex, getCodeFile, ps2Files, availability, readIndex, cacheDir };
}

module.exports = { create, readZipEntries, gcRegion, ps2Region, parsePnachName, pnachGroups, isFpsGroup, DEFAULT_PCSX2_ZIP };
