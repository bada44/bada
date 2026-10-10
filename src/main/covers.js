// Kapak resimlerini libretro thumbnails sunucusundan bulur ve yerelde saklar.
// Dosya adlari "Oyun Adi (USA).png" bicimindedir; birkac olasi ada bakilir, bulunamazsa 7 gun sonra tekrar denenir.
const fs = require('fs');
const path = require('path');

const SYSTEMS = { gamecube: 'Nintendo - GameCube', ps2: 'Sony - PlayStation 2' };
const REGION_TAGS = { USA: ['USA', 'USA, Europe', 'USA, Canada'], PAL: ['Europe', 'Europe, Australia'], JAP: ['Japan'], KOR: ['Korea'] };
const RETRY_MS = 7 * 24 * 3600 * 1000;

// Libretro dosya adinda & * / : < > ? \ | karakterleri "_" olur.
const safe = (s) => s.replace(/[&*/:<>?\\|"]/g, '_');

function candidates(game, region, fileBase) {
  const title = game.title;
  const order = [];
  const push = (r) => (REGION_TAGS[r] || []).forEach((t) => order.push(`${title} (${t})`));
  if (region && REGION_TAGS[region]) push(region);
  ['USA', 'PAL', 'JAP'].forEach((r) => { if (r !== region) push(r); });
  const list = [fileBase, ...order];
  return [...new Set(list.filter(Boolean).map(safe))];
}

function create({ dir, fetchBuffer, now = () => Date.now() }) {
  fs.mkdirSync(dir, { recursive: true });
  const filePng = (id) => path.join(dir, id + '.png');
  const marker = (id) => path.join(dir, id + '.none');

  async function fetchFor(game, region) {
    if (fs.existsSync(filePng(game.id))) return filePng(game.id);
    try { if (now() - fs.statSync(marker(game.id)).mtimeMs < RETRY_MS) return null; } catch (e) { /* ilk deneme */ }
    const sys = SYSTEMS[game.platform];
    if (!sys) return null;
    const fileBase = path.basename(game.filePath || '', path.extname(game.filePath || ''));
    for (const name of candidates(game, region, fileBase)) {
      const url = `https://thumbnails.libretro.com/${encodeURIComponent(sys)}/Named_Boxarts/${encodeURIComponent(name)}.png`;
      try {
        const buf = await fetchBuffer(url);
        if (buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50) { fs.writeFileSync(filePng(game.id), buf); return filePng(game.id); }
      } catch (e) { /* 404: siradaki ad */ }
    }
    fs.writeFileSync(marker(game.id), String(now()));
    return null;
  }
  return { fetchFor };
}
module.exports = { create, candidates };
