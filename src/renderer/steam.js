// Steam tarzi kutuphane gorunumu: sol menu, kapak izgarasi, oyun sayfasi.
// renderer.js'teki state, play, toggleFav, drawerAction vb. fonksiyonlari kullanir.

const STEAM_FILTERS = ['all', 'fav', 'recent', 'gamecube', 'ps2'];
let pageSig = '';

function initSteam() {
  state.view = state.settings.viewMode || 'bigpicture';
  state.sort = state.settings.sortMode || 'name';
  $('#sSort').value = state.sort;
  const size = Number(state.settings.tileSize) || 170;
  $('#sSize').value = size;
  document.documentElement.style.setProperty('--tile', size + 'px');
  applyView();

  $$('#sNav button').forEach((b) => b.addEventListener('click', () => { closeGamePage(); setFilter(b.dataset.filter); }));
  $('#sSearch').addEventListener('input', (e) => { state.query = e.target.value; state.sel = 0; renderAll(); });
  $('#sSort').addEventListener('change', (e) => { state.sort = e.target.value; api.settings.set({ sortMode: state.sort }); renderAll(); });
  $('#sSize').addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--tile', e.target.value + 'px');
  });
  $('#sSize').addEventListener('change', (e) => api.settings.set({ tileSize: Number(e.target.value) }));
  $('#sSettings').addEventListener('click', openSettings);
  $('#sEmptySettings').addEventListener('click', openSettings);
  $('#sBig').addEventListener('click', () => setView('bigpicture'));
  $('#btnLibrary').addEventListener('click', () => setView('library'));

  // L: konsol menusu <-> kutuphane
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'l' && e.key !== 'L') || e.ctrlKey || e.metaKey || e.altKey || state.playing || isMobile()) return;
    if (document.activeElement && document.activeElement.matches('input, textarea, select')) return;
    if (layer() !== 'home') return;
    setView(state.view === 'library' ? 'bigpicture' : 'library');
  });

  // Ayarlar kategorileri
  $$('#setNav button').forEach((b) => b.addEventListener('click', () => setSettingsCat(b.dataset.cat)));
  $$('#settings [data-view]').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); setSettingsCat('view'); }));
  setSettingsCat('library');
  // fare kullaninca klavye secim cercevesini kaldir
  document.addEventListener('mousemove', () => { if (document.body.dataset.kbnav === '1') { document.body.dataset.kbnav = '0'; $$('#sGrid .s-tile.kb').forEach((t) => t.classList.remove('kb')); } });
}

function setSettingsCat(cat) {
  state.setCat = cat;
  $$('#setNav button').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  $$('#settings .card').forEach((c) => c.classList.toggle('cat-off', c.dataset.cat !== cat));
  $$('#settings [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
}

// Sol alt: emulatorler hazir mi? Tiklayinca ilgili ayara gider.
async function renderStatus() {
  const box = $('#sStatus');
  if (!box || isMobile()) return;
  const s = await api.settings.get().catch(() => state.settings);
  state.settings = s;
  const chip = (ok, name) => `<button class="s-chip ${ok ? 'ok' : 'bad'}" data-go="emus" title="${ok ? 'Hazır' : 'Yol seçilmedi, tıkla'}">${ok ? '✓' : '!'} ${name}</button>`;
  box.innerHTML = chip(!!s.dolphinPath, 'Dolphin') + chip(!!s.pcsx2Path, 'PCSX2');
  $$('[data-go]', box).forEach((b) => b.addEventListener('click', () => openSettings(b.dataset.go)));
}

// ---------- Klavye / gamepad gezinmesi ----------
let gridSel = 0;
const gridTiles = () => $$('#sGrid .s-tile');
function gridCols() {
  const t = gridTiles();
  if (t.length < 2) return 1;
  const top = t[0].offsetTop;
  let n = 0;
  for (const x of t) { if (x.offsetTop !== top) break; n++; }
  return Math.max(1, n);
}
function markTile() {
  gridTiles().forEach((t, i) => t.classList.toggle('kb', i === gridSel));
}
function selectTile(i, scroll = true) {
  const t = gridTiles();
  if (!t.length) return;
  gridSel = Math.max(0, Math.min(t.length - 1, i));
  document.body.dataset.kbnav = '1';
  state.gridId = t[gridSel].dataset.id;
  markTile();
  if (scroll) { t[gridSel].focus({ preventScroll: true }); t[gridSel].scrollIntoView({ block: 'nearest' }); }
}
const inSide = () => document.activeElement && document.activeElement.closest && document.activeElement.closest('.s-side');

function steamAct(name) {
  const dirs = ['left', 'right', 'up', 'down'];
  document.body.dataset.kbnav = '1';
  const page = state.pageGameId ? state.games.find((g) => g.id === state.pageGameId) : null;

  if (document.activeElement === $('#sSearch')) { if (name === 'back') $('#sSearch').blur(); return; }

  if (page) {                       // oyun sayfasi acik
    if (dirs.includes(name)) moveFocus(name, $('#sPage'));
    else if (name === 'accept') {
      const el = document.activeElement;
      if (el && $('#sPage').contains(el) && el.matches('button')) el.click(); else play(page);
    }
    else if (name === 'fav') pageAction('fav', page);
    else if (name === 'back') closeGamePage();
    else if (name === 'start') openSettings();
    else if (name === 'prevTab') steamCycle(-1);
    else if (name === 'nextTab') steamCycle(1);
    return;
  }
  if (inSide()) {                   // sol menudeyiz
    if (name === 'right' || name === 'back') selectTile(gridSel);
    else if (name === 'up' || name === 'down') moveFocus(name, $('.s-side'));
    else if (name === 'accept') document.activeElement.click();
    else if (name === 'start') openSettings();
    else if (name === 'prevTab') steamCycle(-1);
    else if (name === 'nextTab') steamCycle(1);
    return;
  }
  const cols = gridCols();          // izgara
  const cur = () => { const t = gridTiles()[gridSel]; return t ? state.games.find((g) => g.id === t.dataset.id) : null; };
  switch (name) {
    case 'left':
      if (gridSel % cols === 0) { ($('#sNav .active') || $('#sNav button'))?.focus(); } else selectTile(gridSel - 1);
      break;
    case 'right': selectTile(gridSel + 1); break;
    case 'up': selectTile(gridSel - cols); break;
    case 'down': selectTile(gridSel + cols); break;
    case 'jumpL': selectTile(gridSel - cols * 3); break;
    case 'jumpR': selectTile(gridSel + cols * 3); break;
    case 'accept': case 'detail': { const g = cur(); if (g) openGamePage(g.id); break; }
    case 'fav': { const g = cur(); if (g) toggleFav(g); break; }
    case 'random': { const t = gridTiles(); if (t.length) selectTile(Math.floor(Math.random() * t.length)); break; }
    case 'prevTab': steamCycle(-1); break;
    case 'nextTab': steamCycle(1); break;
    case 'start': openSettings(); break;
    case 'back': if (state.query) { $('#sSearch').value = ''; state.query = ''; renderAll(); } break;
  }
}

function applyView() { document.body.dataset.view = state.view; }
function setView(v) {
  state.view = v;
  applyView();
  state.settings.viewMode = v;
  api.settings.set({ viewMode: v });
  if (v === 'bigpicture') closeGamePage();
  renderAll();
  beep(520);
}
function steamCycle(dir) {
  closeGamePage();
  const i = STEAM_FILTERS.indexOf(state.filter);
  setFilter(STEAM_FILTERS[(i + dir + STEAM_FILTERS.length) % STEAM_FILTERS.length]);
}

function steamList() {
  const l = visible().slice();
  if (state.filter === 'recent') return l;
  if (state.sort === 'recent') l.sort((a, b) => (b.lastPlayed || '').localeCompare(a.lastPlayed || ''));
  else if (state.sort === 'time') l.sort((a, b) => (b.totalPlaySeconds || 0) - (a.totalPlaySeconds || 0));
  return l;
}

function renderSteam() {
  if (!$('#steam')) return;
  const all = state.games;
  $('#cAll').textContent = all.length || '';
  $('#cFav').textContent = all.filter((g) => g.favorite).length || '';
  $('#cGc').textContent = all.filter((g) => g.platform === 'gamecube').length || '';
  $('#cPs2').textContent = all.filter((g) => g.platform === 'ps2').length || '';
  $('#cRecent').textContent = all.filter((g) => g.lastPlayed).length || '';
  renderStatus();
  $$('#sNav button').forEach((b) => b.classList.toggle('active', b.dataset.filter === state.filter));

  const list = steamList();
  const grid = $('#sGrid');
  grid.innerHTML = '';
  $('#sEmpty').classList.toggle('hidden', all.length > 0);
  grid.classList.toggle('hidden', all.length === 0);
  if (all.length > 0 && list.length === 0) {
    grid.innerHTML = '<div class="s-none">Bu filtrede oyun yok.</div>';
  }
  for (const g of list) {
    const t = document.createElement('div');
    t.className = 's-tile';
    t.tabIndex = 0;
    t.dataset.id = g.id;
    t.innerHTML = `
      <div class="s-cover" style="background:${coverStyle(g)};background-size:cover;background-position:center">
        ${g.cover ? '' : `<span class="s-initial">${esc(g.title.charAt(0).toUpperCase())}</span><span class="s-ctitle">${esc(g.title)}</span>`}
        <span class="s-plat ${g.platform}">${platName(g)}</span>
        ${g.favorite ? '<span class="s-fav">★</span>' : ''}
        ${g.patched ? '<span class="s-tr">TR</span>' : ''}
        <button class="s-quick" title="Oyna" aria-label="Oyna">▶</button>
      </div>
      <div class="s-name">${esc(g.title)}</div>`;
    t.addEventListener('click', () => { gridSel = grid.children.length ? [...grid.children].indexOf(t) : 0; openGamePage(g.id); });
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openGamePage(g.id); } });
    $('.s-quick', t).addEventListener('click', (e) => { e.stopPropagation(); play(g); });
    grid.appendChild(t);
  }
  // klavye/gamepad secimini oyun kimligine gore koru
  if (state.gridId) { const k = list.findIndex((x) => x.id === state.gridId); if (k >= 0) gridSel = k; }
  gridSel = Math.min(gridSel, Math.max(0, list.length - 1));
  if (document.body.dataset.kbnav === '1') markTile();
  // acik oyun sayfasi varsa, verisi degistiyse tazele (ornegin FPS raporu geldi)
  if (state.pageGameId) {
    const g = state.games.find((x) => x.id === state.pageGameId);
    if (!g) closeGamePage();
    else {
      const sig = JSON.stringify([g.fpsReport, g.lastPlayed, g.totalPlaySeconds, g.cover, g.favorite, g.autoFps, g.patched]);
      if (sig !== pageSig) openGamePage(g.id);
    }
  }
}

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function fpsStatusBlock(info, g) {
  if (isMobile()) return '<div class="p-pill info">Mobilde otomatik 60 FPS yok. Bu özellik masaüstü uygulamasında çalışır.</div>';
  if (g.autoFps === false) return '<div class="p-pill info">Oto FPS bu oyunda kapalı.</div>';
  if (info.codeStatus === 'var') {
    return `<div class="p-pill ok">✓ Bu oyun için ${info.kind === 'CRC' ? '60 FPS yaması' : '60 FPS kodu'} var. Oyun açılırken otomatik kurulur.</div>`;
  }
  if (info.codeStatus === 'yok') {
    const other = (info.otherRegions || []).length
      ? ` ${info.otherRegions.join(' / ')} sürümü için var ama yanlış bölge kodu oyunu çökertir, kurulmaz.` : '';
    return `<div class="p-pill warn">Depoda bu sürüm için 60 FPS yaması yok.${other} Oyun normal hızında (genelde 30 FPS) çalışır.</div>`;
  }
  return '<div class="p-pill info">Kod durumu bilinmiyor (kod deposu henüz indirilmemiş olabilir).</div>';
}

async function openGamePage(gameId) {
  const g = state.games.find((x) => x.id === gameId);
  if (!g) return;
  state.pageGameId = gameId;
  pageSig = JSON.stringify([g.fpsReport, g.lastPlayed, g.totalPlaySeconds, g.cover, g.favorite, g.autoFps, g.patched]);
  const info = await api.game.identify(gameId).catch(() => ({}));
  if (state.pageGameId !== gameId) return; // bu arada kapatildi
  const rep = g.fpsReport;
  const notes = rep && rep.notes && rep.notes.length
    ? `<ul class="p-notes">${rep.notes.map((n) => `<li class="${/UYARI|indirilemedi|okunamadi/.test(n) ? 'bad' : ''}">${esc(n)}</li>`).join('')}</ul>`
    : '<p class="muted small">Bu oyun RetroHub üzerinden henüz açılmadı. Açınca burada ne yapıldığı görünecek.</p>';
  const page = $('#sPage');
  const keep = page.scrollTop;
  page.innerHTML = `
    <div class="p-hero" style="--cover:${coverStyle(g)}">
      <div class="p-shade"></div>
      <button class="p-back" data-p="back">← Kütüphane</button>
      <div class="p-head">
        <div class="p-cover" style="background:${coverStyle(g)};background-size:cover;background-position:center">${g.cover ? '' : esc(g.title.charAt(0).toUpperCase())}</div>
        <div class="p-meta">
          <div class="chips"><span class="chip">${g.platform === 'gamecube' ? 'GAMECUBE' : 'PLAYSTATION 2'}</span>${info.region ? `<span class="chip">${esc(info.region)}</span>` : ''}${g.patched ? '<span class="chip">🇹🇷 TÜRKÇE</span>' : ''}</div>
          <h1>${esc(g.title)}</h1>
        </div>
      </div>
    </div>
    <div class="p-bar">
      <button class="s-playbtn" data-p="play">▶ OYNA</button>
      <button class="p-sq ${g.favorite ? 'on' : ''}" data-p="fav" title="Favori" aria-label="Favori">${g.favorite ? '★' : '☆'}</button>
      <div class="p-stats">
        <div><span>SON OYNAMA</span><b>${fmtDate(g.lastPlayed)}</b></div>
        <div><span>OYNAMA SÜRESİ</span><b>${fmtDuration(g.totalPlaySeconds)}</b></div>
      </div>
    </div>
    <div class="p-body">
      ${isMobile() ? '' : `<div class="p-card">
        <h3>⚡ 60 FPS durumu</h3>
        ${fpsStatusBlock(info, g)}
        <div class="p-row">
          <button class="btn" data-p="fps">Oto FPS: ${g.autoFps !== false ? 'AÇIK' : 'KAPALI'}</button>
          <button class="btn" data-p="refresh">⟳ Depoyu güncelle</button>
        </div>
        <h4>Son açılışta ne yapıldı</h4>
        ${rep ? `<p class="muted small">${fmtWhen(rep.at)}</p>` : ''}
        ${notes}
      </div>`}
      <div class="p-card">
        <h3>ℹ Oyun bilgisi</h3>
        <div class="stat"><span class="l">${esc(info.kind || 'Kimlik')}</span><span>${esc(info.id || (info.error ? 'okunamadı' : '—'))}</span></div>
        ${info.serial ? `<div class="stat"><span class="l">Seri no</span><span>${esc(info.serial)}</span></div>` : ''}
        ${info.region ? `<div class="stat"><span class="l">Bölge</span><span>${esc(info.region)}</span></div>` : ''}
        <div class="stat"><span class="l">Türkçe yama</span><span>${g.patched ? '✓ ' + esc(g.patchNote || 'Uygulandı') : 'Yok'}</span></div>
        <div class="stat"><span class="l">Dosya</span><span class="p-path" title="${esc(g.filePath)}">${esc(String(g.filePath).split(/[\\/]/).pop())}</span></div>
      </div>
      ${isMobile() ? '' : `<div class="p-card">
        <h3>🛠 Gelişmiş</h3>
        <div class="p-col">
          <button class="btn" data-p="patch">🩹 Türkçe yama kur (dosya seç)</button>
          ${g.patched ? '<button class="btn danger" data-p="restore">↩ Orijinale döndür</button>' : ''}
          <button class="btn" data-p="paste">📋 60 FPS kodu yapıştır</button>
          <button class="btn" data-p="code">🧩 Elle kod ekle (dosyadan)</button>
        </div>
      </div>`}
    </div>`;
  page.classList.remove('hidden');
  page.scrollTop = keep;
  $$('[data-p]', page).forEach((b) => { b.classList.add('focusable'); b.addEventListener('click', () => pageAction(b.dataset.p, g)); });
  if (document.body.dataset.kbnav === '1') $('.s-playbtn', page)?.focus({ preventScroll: true });
}

async function pageAction(a, g) {
  if (a === 'back') return closeGamePage();
  if (a === 'play') return play(g);
  if (a === 'fav') { await api.game.toggleFav(g.id); beep(760, 0.07); return loadLibrary(g.id); }
  if (a === 'refresh') { toast('Depo güncelleniyor...'); await api.codes.refresh(); return openGamePage(g.id); }
  return drawerAction(a, g); // fps, patch, restore, code
}

function closeGamePage() {
  state.pageGameId = null;
  pageSig = '';
  $('#sPage').classList.add('hidden');
}
