const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = window.retrohub;

const TABS = ['all', 'recent', 'fav', 'gamecube', 'ps2'];
const state = {
  games: [], filter: 'all', query: '', sel: 0,
  settings: {}, playing: null, drawerGameId: null,
  modalResolve: null, padLockUntil: 0, view: 'library', sort: 'name', pageGameId: null
};

// ---------- Yardimcilar ----------
const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtDuration(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk`;
  return `${sec} sn`;
}
function fmtDate(iso) {
  if (!iso) return 'Hiç oynanmadı';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fileUrl(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23'); }
function hueOf(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function gradientFor(g) {
  const h = hueOf(g.title);
  return `linear-gradient(145deg, hsl(${h} 65% 38%), hsl(${(h + 50) % 360} 70% 18%))`;
}
function coverStyle(g) { return g.cover ? `url("${fileUrl(g.cover)}")` : gradientFor(g); }
const platName = (g) => (g.platform === 'gamecube' ? 'GAMECUBE' : 'PS2');

// ---------- Ses ----------
let audio;
function beep(freq = 520, dur = 0.05, vol = 0.04) {
  if (!state.settings.sounds) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audio.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur); o.stop(audio.currentTime + dur);
  } catch (e) { /* ses yoksa sorun degil */ }
}

// ---------- Bildirim ve pencere ----------
function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 7000 : 4000);
}

// buttons: [{label, value, primary}] ; ilk dugme odakta, B/Esc = null
function ask(title, text, buttons = [{ label: 'Tamam', value: true, primary: true }]) {
  return new Promise((resolve) => {
    $('#modalTitle').textContent = title;
    $('#modalText').textContent = text;
    const box = $('#modalButtons');
    box.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn focusable' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => closeModal(b.value));
      box.appendChild(btn);
    }
    state.modalResolve = resolve;
    $('#modal').classList.remove('hidden');
    box.querySelector('button')?.focus();
  });
}
function closeModal(value) {
  $('#modal').classList.add('hidden');
  const r = state.modalResolve; state.modalResolve = null;
  if (r) r(value ?? null);
}
const confirmBox = (title, text, yes = 'Evet') =>
  ask(title, text, [{ label: yes, value: true, primary: true }, { label: 'Vazgeç', value: false }]);

// ---------- Katmanlar ----------
const layer = () => {
  if (!$('#modal').classList.contains('hidden')) return 'modal';
  if (!$('#settings').classList.contains('hidden')) return 'settings';
  if (!$('#drawer').classList.contains('hidden')) return 'drawer';
  return 'home';
};

// ---------- Kutuphane ----------
async function loadLibrary(keepId) {
  const prevId = keepId ?? currentGame()?.id;
  state.games = await api.library.list();
  const list = visible();
  const idx = list.findIndex((g) => g.id === prevId);
  state.sel = idx >= 0 ? idx : Math.min(state.sel, Math.max(0, list.length - 1));
  renderAll();
}

function visible() {
  const q = state.query.trim().toLowerCase();
  let l = state.games.filter((g) => !q || g.title.toLowerCase().includes(q));
  switch (state.filter) {
    case 'gamecube': case 'ps2': l = l.filter((g) => g.platform === state.filter); break;
    case 'fav': l = l.filter((g) => g.favorite); break;
    case 'recent':
      return l.filter((g) => g.lastPlayed).sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
  }
  return l.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
}
const currentGame = () => visible()[state.sel] || null;

function renderAll() {
  const list = visible();
  const empty = $('#emptyState'), hero = $('#hero'), railWrap = $('#railWrap');
  const noLibrary = state.games.length === 0;
  empty.classList.toggle('hidden', !noLibrary);
  hero.classList.toggle('hidden', list.length === 0);
  railWrap.classList.toggle('hidden', list.length === 0);

  const rail = $('#rail');
  rail.innerHTML = '';
  list.forEach((g, i) => {
    const t = document.createElement('div');
    t.className = 'tile' + (i === state.sel ? ' sel' : '');
    t.style.background = coverStyle(g);
    t.style.backgroundSize = 'cover';
    t.style.backgroundPosition = 'center';
    t.innerHTML = `
      ${g.cover ? '' : `<div class="tile-initial">${esc(g.title.charAt(0).toUpperCase())}</div>`}
      <span class="tile-plat ${g.platform}">${platName(g)}</span>
      ${g.favorite ? '<span class="tile-star">★</span>' : ''}
      <div class="tile-title">${esc(g.title)}</div>`;
    t.addEventListener('click', () => { if (state.sel === i) play(); else { state.sel = i; updateSelection(); beep(480); } });
    t.addEventListener('dblclick', () => play());
    rail.appendChild(t);
  });
  if (!noLibrary && list.length === 0) {
    $('#emptyNote').textContent = '';
  }
  updateHero();
  scrollToSel(false);
  $$('#tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.filter === state.filter));
  if (typeof renderSteam === 'function') renderSteam();
}

function updateSelection() {
  $$('#rail .tile').forEach((t, i) => t.classList.toggle('sel', i === state.sel));
  updateHero();
  scrollToSel(true);
}
function scrollToSel(smooth) {
  const t = $$('#rail .tile')[state.sel];
  if (t) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
}

function updateHero() {
  const g = currentGame();
  if (!g) { $('#bg').style.background = 'none'; return; }
  $('#bg').style.background = coverStyle(g);
  $('#bg').style.backgroundSize = 'cover';
  $('#bg').style.backgroundPosition = 'center';
  $('#heroTitle').textContent = g.title;
  $('#heroBadges').innerHTML =
    `<span class="chip ${g.platform}">${platName(g)}</span>` +
    (g.patched ? '<span class="chip ok">✓ TÜRKÇE YAMALI</span>' : '') +
    (g.favorite ? '<span class="chip fav">★ FAVORİ</span>' : '') +
    (!isMobile() && state.settings.autoFps && g.autoFps !== false ? '<span class="chip">⚡ OTO FPS</span>' : '');
  $('#heroMeta').textContent = `${fmtDuration(g.totalPlaySeconds)} oynandı  •  Son: ${fmtDate(g.lastPlayed)}`;
  $('#heroFavText').textContent = g.favorite ? 'Favoriden çıkar' : 'Favori';
}

// ---------- Oyun islemleri ----------
async function play(g = currentGame()) {
  if (!g || state.playing) return;
  if (!isMobile()) {
    const s = await api.settings.get();
    state.settings = s;
    const need = g.platform === 'gamecube' ? s.dolphinPath : s.pcsx2Path;
    if (!need) {
      const go = await ask('Emülatör bulunamadı',
        `${g.platform === 'gamecube' ? 'Dolphin' : 'PCSX2'} yolu ayarlı değil. Ayarlar'da "Otomatik Bul"a basabilir ya da .exe dosyasını elle seçebilirsin.`,
        [{ label: 'Ayarlara git', value: true, primary: true }, { label: 'Vazgeç', value: false }]);
      if (go) openSettings('emus');
      return;
    }
  }
  state.playing = g.id;
  $('#playingTitle').textContent = g.title;
  $('#playingTime').textContent = 'Başlatılıyor...';
  $('#playing').classList.remove('hidden');
  beep(660, 0.12);
  try {
    const ok = await api.game.play(g.id);
    if (!ok) endPlaying();
  } catch (err) {
    toast(err.message, 'err');
    endPlaying();
  }
}
function endPlaying() {
  state.playing = null;
  state.padLockUntil = performance.now() + 700;
  $('#playing').classList.add('hidden');
}
api.on('game:tick', ({ elapsed }) => { $('#playingTime').textContent = fmtDuration(elapsed) + ' oynanıyor'; });
api.on('game:exit', async ({ failed }) => {
  endPlaying();
  await loadLibrary();
  if (failed) toast('Emülatör beklenmedik şekilde kapandı.', 'err');
});
api.on('library:changed', async ({ added, reason }) => {
  await loadLibrary();
  if (added > 0) toast(`${added} yeni oyun bulundu (${reason})`, 'ok');
});
api.on('toast', ({ message, type }) => toast(message, type));

async function toggleFav(g = currentGame()) {
  if (!g) return;
  await api.game.toggleFav(g.id);
  beep(760, 0.07);
  await loadLibrary(g.id);
  if (layer() === 'drawer') openDrawer(g.id);
}
function randomGame() {
  const list = visible();
  if (!list.length) return;
  state.sel = Math.floor(Math.random() * list.length);
  updateSelection();
  beep(900, 0.08);
}
function setFilter(f) {
  state.filter = f; state.sel = 0;
  renderAll();
  beep(420);
}
function cycleTab(dir) {
  const i = TABS.indexOf(state.filter);
  setFilter(TABS[(i + dir + TABS.length) % TABS.length]);
}

const isMobile = () => window.retrohubPlatform === 'mobile';

// ---------- Detay cekmecesi ----------
async function openDrawer(gameId) {
  const g = state.games.find((x) => x.id === gameId);
  if (!g) return;
  state.drawerGameId = gameId;
  const idInfo = await api.game.identify(gameId).catch(() => ({}));
  const drawer = $('#drawer');
  $('#drawerContent').innerHTML = `
    <div class="d-cover" style="background:${coverStyle(g)};background-size:cover;background-position:center">${g.cover ? '' : esc(g.title.charAt(0))}</div>
    <h2 class="d-title">${esc(g.title)}</h2>
    <div class="stat"><span class="l">Platform</span><span>${g.platform === 'gamecube' ? 'GameCube' : 'PlayStation 2'}</span></div>
    <div class="stat"><span class="l">Oynama süresi</span><span>${fmtDuration(g.totalPlaySeconds)}</span></div>
    <div class="stat"><span class="l">Son oynama</span><span>${fmtDate(g.lastPlayed)}</span></div>
    <div class="stat"><span class="l">Türkçe yama</span><span>${g.patched ? '✓ ' + esc(g.patchNote || 'Uygulandı') : 'Yok'}</span></div>
    <div class="stat"><span class="l">${esc(idInfo.kind || 'Kimlik')}</span><span>${esc(idInfo.id || (idInfo.error ? 'okunamadı' : '—'))}</span></div>
    ${idInfo.region ? `<div class="stat"><span class="l">Bölge</span><span>${esc(idInfo.region)}</span></div>` : ''}
    ${codeStatusHtml(idInfo)}
    <div class="d-actions">
      <button class="btn primary focusable" data-d="play">▶ Oyna</button>
      <button class="btn focusable" data-d="fav">${g.favorite ? '★ Favoriden çıkar' : '☆ Favoriye ekle'}</button>
      ${isMobile() ? '' : `<button class="btn focusable" data-d="fps">⚡ Oto FPS: ${g.autoFps !== false ? 'AÇIK' : 'KAPALI'}</button>`}
      ${isMobile() ? '' : `<button class="btn focusable" data-d="patch">🩹 Türkçe yama kur (dosya seç)</button>
      ${g.patched ? '<button class="btn danger focusable" data-d="restore">↩ Orijinale döndür</button>' : ''}
      <button class="btn focusable" data-d="code">🧩 Elle kod ekle (ileri düzey)</button>`}
      <button class="btn focusable" data-d="close"><span class="key">B</span> Kapat</button>
    </div>`;
  drawer.classList.remove('hidden');
  $$('[data-d]', drawer).forEach((b) => b.addEventListener('click', () => drawerAction(b.dataset.d, g)));
  $$('.focusable', drawer)[0]?.focus();
  beep(560);
}
function codeStatusHtml(i) {
  if (!i || !i.codeStatus) return '';
  if (i.codeStatus === 'var') return '<div class="stat"><span class="l">60 FPS kodu</span><span class="ok-text">✓ Depoda var (oyun açılırken kurulur)</span></div>';
  const other = (i.otherRegions || []).length
    ? `<div class="region-warn">Bu bölge (${esc(i.region)}) için kod yok; ${esc(i.otherRegions.join(' / '))} için var. Yanlış bölgenin kodu oyunu çökertebilir, bu yüzden kurulmaz. Performans profili yine uygulanır.</div>` : '';
  return `<div class="stat"><span class="l">60 FPS kodu</span><span class="muted">Depoda yok</span></div>${other}`;
}
function closeDrawer() { $('#drawer').classList.add('hidden'); state.drawerGameId = null; }

function refreshDetail(id) { return state.pageGameId ? openGamePage(id) : openDrawer(id); }
async function drawerAction(action, g) {
  try {
    if (action === 'close') return closeDrawer();
    if (action === 'play') { closeDrawer(); return play(g); }
    if (action === 'fav') return toggleFav(g);
    if (action === 'fps') {
      await api.game.setAutoFps(g.id, g.autoFps === false);
      await loadLibrary(g.id); return refreshDetail(g.id);
    }
    if (action === 'patch') {
      const f = await api.settings.pickFile([{ name: 'Yama', extensions: ['ppf', 'xdelta', 'vcdiff'] }]);
      if (!f) return;
      const ok = await confirmBox('Yama uygulansın mı?',
        'Orijinal dosyanın yedeği (.orig) alınır. Büyük oyunlarda bu işlem birkaç dakika sürebilir.', 'Uygula');
      if (!ok) return;
      toast('Yama uygulanıyor...');
      await api.patch.apply(g.id, f);
      toast('Yama uygulandı!', 'ok');
      await loadLibrary(g.id); return refreshDetail(g.id);
    }
    if (action === 'restore') {
      if (!(await confirmBox('Orijinale dön', 'Oyun yamasız haline döndürülsün mü?'))) return;
      await api.patch.restore(g.id);
      await loadLibrary(g.id); return refreshDetail(g.id);
    }
    if (action === 'code') {
      if (g.platform === 'gamecube') {
        const f = await api.settings.pickFile([{ name: 'Gecko kod (.txt)', extensions: ['txt', 'ini'] }]);
        if (!f) return;
        const r = await api.cheats.installGecko(g.id, f);
        toast(`Kod kuruldu: ${r.codeName} (${r.gameId})`, 'ok');
      } else {
        const f = await api.settings.pickFile([{ name: 'PCSX2 patch', extensions: ['pnach'] }]);
        if (!f) return;
        await api.cheats.installPnach(f);
        toast('Pnach dosyası PCSX2 patches klasörüne kopyalandı.', 'ok');
      }
    }
  } catch (err) {
    ask('Hata', err.message);
  }
}

// ---------- Ayarlar ----------
async function openSettings(cat) {
  await loadSettings();
  if (typeof setSettingsCat === 'function') setSettingsCat(typeof cat === 'string' ? cat : (state.setCat || 'library'));
  $('#settings').classList.remove('hidden');
  $$('#settings .focusable')[0]?.focus();
  beep(500);
}
function closeSettings() {
  $('#settings').classList.add('hidden');
  if (typeof renderStatus === 'function') renderStatus();
}

async function loadSettings() {
  state.settings = await api.settings.get();
  const s = state.settings;
  ['gcFolder', 'ps2Folder', 'coverFolder', 'dolphinPath', 'pcsx2Path', 'xdelta3Path',
    'patchesFolder', 'cloudFolder', 'fpsCodesFolder', 'codeRepoUrl'].forEach((k) => { $('#' + k).value = s[k] || ''; });
  $$('[data-toggle]').forEach((b) => b.classList.toggle('on', !!s[b.dataset.toggle]));
  api.cloud.localSaves().then((l) => {
    $('#saveInfo').textContent = l.length
      ? `Bilgisayarında ${l.length} kayıt dosyası bulundu ve eşitlenecek.`
      : 'Henüz hafıza kartı dosyası bulunamadı (oyunu bir kez oynayıp kaydedince oluşur).';
  }).catch(() => {});
}

$$('[data-pick]').forEach((btn) => btn.addEventListener('click', async () => {
  const key = btn.dataset.pick;
  const value = btn.dataset.type === 'folder'
    ? await api.settings.pickFolder()
    : await api.settings.pickFile([{ name: 'Uygulama', extensions: ['exe'] }]);
  if (!value) return;
  $('#' + key).value = value;
  state.settings = await api.settings.set({ [key]: value });
  if (key === 'cloudFolder') loadSettings();
}));

$$('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
  const key = btn.dataset.toggle;
  const value = !state.settings[key];
  state.settings = await api.settings.set({ [key]: value });
  btn.classList.toggle('on', value);
  beep(value ? 700 : 400);
  if (key === 'autoFps') updateHero();
}));

$('#codeRepoUrl').addEventListener('change', async (e) => {
  const v = e.target.value.trim();
  if (v && !/^https:\/\//i.test(v)) { toast('Adres https:// ile başlamalı', 'warn'); return; }
  state.settings = await api.settings.set({ codeRepoUrl: v });
});
$('#codesRefresh').addEventListener('click', async () => {
  toast('Kodlar güncelleniyor...');
  await api.codes.refresh();
});

async function scanLibrary() {
  const btn = $('#scanBtn');
  btn.disabled = true; btn.textContent = '🔄 Taranıyor...';
  try {
    const found = await api.library.scan();
    await loadLibrary();
    toast(`${found.length} oyun bulundu`, found.length ? 'ok' : 'warn');
  } catch (err) { ask('Tarama hatası', err.message); }
  btn.disabled = false; btn.textContent = '🔄 Şimdi Tara';
}
$('#scanBtn').addEventListener('click', scanLibrary);

async function detectEmulators() {
  const r = await api.setup.autodetect();
  await loadSettings();
  const names = Object.keys(r.applied).map((k) => (k === 'dolphinPath' ? 'Dolphin' : 'PCSX2'));
  if (names.length) toast(`${names.join(' ve ')} bulundu ve ayarlandı`, 'ok');
  else if (r.found.dolphinPath || r.found.pcsx2Path) toast('Zaten ayarlı', 'info');
  else toast('Otomatik bulunamadı, "Seç" ile elle göster.', 'warn');
}
$('#detectBtn').addEventListener('click', detectEmulators);

$('#cloudNow').addEventListener('click', async () => {
  try {
    const r = await api.cloud.syncNow();
    toast(`Eşitlendi: ${r.down} indirildi, ${r.up} yüklendi`, 'ok');
  } catch (err) { ask('Bulut hatası', err.message); }
});

$('#autoScanBtn').addEventListener('click', async () => {
  try {
    const matches = await api.patch.autoScan();
    const list = $('#autoMatchList');
    list.innerHTML = '';
    if (!matches.length) {
      list.innerHTML = '<p class="muted small">Eşleşme bulunamadı. Klasörü ve dosya adlarının oyun adına benzediğini kontrol et.</p>';
      return;
    }
    const all = document.createElement('button');
    all.className = 'btn primary focusable';
    all.textContent = `✅ Tümünü uygula (${matches.length})`;
    all.addEventListener('click', () => applyMatches(matches));
    list.appendChild(all);
    for (const m of matches) {
      const row = document.createElement('div');
      row.className = 'match';
      row.innerHTML = `<div>${esc(m.gameTitle)}<small>${esc(m.patchFileName)} • eşleşme %${Math.round(m.score * 100)}</small></div>`;
      const b = document.createElement('button');
      b.className = 'btn focusable'; b.textContent = 'Uygula';
      b.addEventListener('click', () => applyMatches([m]));
      row.appendChild(b);
      list.appendChild(row);
    }
  } catch (err) { ask('Tarama hatası', err.message); }
});
async function applyMatches(matches) {
  if (!(await confirmBox('Yamalar uygulansın mı?', `${matches.length} oyunun dosyası değiştirilecek (yedekleri alınır). Uzun sürebilir.`, 'Uygula'))) return;
  toast('Yamalar uygulanıyor...');
  const res = await api.patch.autoApply(matches);
  const fail = res.filter((r) => !r.ok);
  await loadLibrary();
  $('#autoMatchList').innerHTML = '';
  if (fail.length) ask('Bazı yamalar uygulanamadı', fail.map((f) => `${f.gameTitle}: ${f.error}`).join('\n\n'));
  else toast(`${res.length} yama uygulandı`, 'ok');
}

// Bos durum adimlari
$('#emptyFolders').addEventListener('click', openSettings);
$('#emptyDetect').addEventListener('click', detectEmulators);
$('#emptyScan').addEventListener('click', scanLibrary);

// ---------- Ust bar ----------
$('#search').addEventListener('input', (e) => { state.query = e.target.value; state.sel = 0; renderAll(); });
$$('#tabs .tab').forEach((t) => t.addEventListener('click', () => setFilter(t.dataset.filter)));
$('#btnSettings').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', closeSettings);
$('#btnFull').addEventListener('click', () => api.app.toggleFullscreen());
$('#btnRandom').addEventListener('click', randomGame);
$('#heroPlay').addEventListener('click', () => play());
$('#heroFav').addEventListener('click', () => toggleFav());
$('#heroDetail').addEventListener('click', () => { const g = currentGame(); if (g) openDrawer(g.id); });
$('#rail').addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); move(e.deltaY > 0 ? 1 : -1); } }, { passive: false });

function tickClock() { $('#clock').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
setInterval(tickClock, 15000); tickClock();

// ---------- Gezinme (klavye + gamepad ortak) ----------
function move(delta) {
  const n = visible().length;
  if (!n) return;
  const next = Math.max(0, Math.min(n - 1, state.sel + delta));
  if (next === state.sel) return;
  state.sel = next;
  updateSelection();
  beep(480 + (state.sel % 5) * 15);
}

function moveFocus(dir, container) {
  const list = $$('.focusable', container).filter((el) => el.offsetParent !== null && !el.disabled);
  if (!list.length) return;
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { list[0].focus(); return; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bd = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    let ok, dist;
    if (dir === 'down') { ok = dy > 8; dist = dy + Math.abs(dx) * 2; }
    else if (dir === 'up') { ok = dy < -8; dist = -dy + Math.abs(dx) * 2; }
    else if (dir === 'right') { ok = dx > 8; dist = dx + Math.abs(dy) * 2; }
    else { ok = dx < -8; dist = -dx + Math.abs(dy) * 2; }
    if (ok && dist < bd) { bd = dist; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); beep(460, 0.03, 0.025); }
}

function act(name) {
  if (state.playing) return;
  const L = layer();
  const dirs = ['left', 'right', 'up', 'down'];

  if (L === 'modal') {
    if (dirs.includes(name)) moveFocus(name, $('#modal'));
    else if (name === 'accept') document.activeElement?.click();
    else if (name === 'back') closeModal(null);
    return;
  }
  if (L === 'settings') {
    if (dirs.includes(name)) moveFocus(name, $('#settings'));
    else if (name === 'accept') { const el = document.activeElement; if (el && el.matches('.focusable')) el.click(); }
    else if (name === 'back' || name === 'start') closeSettings();
    return;
  }
  if (L === 'drawer') {
    if (dirs.includes(name)) moveFocus(name === 'left' || name === 'right' ? 'down' : name, $('#drawer'));
    else if (name === 'accept') document.activeElement?.click();
    else if (name === 'back' || name === 'detail') closeDrawer();
    return;
  }
  if (state.view === 'library') return steamAct(name);
  // home
  if (document.activeElement === $('#search')) {
    if (name === 'back') $('#search').blur();
    return;
  }
  switch (name) {
    case 'left': move(-1); break;
    case 'right': move(1); break;
    case 'up': case 'down': break;
    case 'jumpL': move(-6); break;
    case 'jumpR': move(6); break;
    case 'accept': play(); break;
    case 'fav': toggleFav(); break;
    case 'detail': { const g = currentGame(); if (g) openDrawer(g.id); break; }
    case 'prevTab': cycleTab(-1); break;
    case 'nextTab': cycleTab(1); break;
    case 'random': randomGame(); break;
    case 'start': openSettings(); break;
    case 'back': if (state.query) { $('#search').value = ''; state.query = ''; state.sel = 0; renderAll(); } break;
  }
}

// Klavye
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Enter: 'accept', Escape: 'back', Backspace: 'back',
  f: 'fav', F: 'fav', d: 'detail', D: 'detail', i: 'detail', I: 'detail',
  q: 'prevTab', Q: 'prevTab', e: 'nextTab', E: 'nextTab',
  r: 'random', R: 'random', s: 'start', S: 'start',
  PageUp: 'jumpL', PageDown: 'jumpR'
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') { e.preventDefault(); api.app.toggleFullscreen(); return; }
  if (state.playing) return;
  if (document.activeElement?.matches('input.editable')) { if (e.key === 'Escape' || e.key === 'Enter') document.activeElement.blur(); return; }
  if (document.activeElement?.matches('select, input[type=range]')) return;
  setInputMode('kb');
  const typing = document.activeElement === $('#search') || document.activeElement === $('#sSearch');
  const searchBox = state.view === 'library' ? $('#sSearch') : $('#search');
  if (e.key === '/' && !typing && layer() === 'home') { e.preventDefault(); searchBox.focus(); return; }
  if (typing && e.key === 'Escape') { document.activeElement.blur(); return; }
  if (typing && e.key !== 'Enter') return;
  if (typing && e.key === 'Enter') { document.activeElement.blur(); return; }
  const name = KEYS[e.key];
  if (!name) return;
  if (name === 'accept' && document.activeElement?.matches('button') && layer() !== 'home') return; // buton kendi click'ini tetikler
  if (name === 'accept' && layer() === 'home' && document.activeElement?.matches('.btn')) return;
  e.preventDefault();
  act(name);
});

// Gamepad
const held = {};
const isDir = (k) => ['left', 'right', 'up', 'down'].includes(k);
function setInputMode(mode) {
  if (document.body.dataset.input === mode) return;
  document.body.dataset.input = mode;
  renderHints();
}
function setPadConnected(on) { $('#padStatus').classList.toggle('on', on); }
window.addEventListener('gamepadconnected', (e) => { setPadConnected(true); setInputMode('pad'); toast('Kontrolcü bağlandı: ' + e.gamepad.id.slice(0, 40), 'ok'); beep(800); });
window.addEventListener('gamepaddisconnected', () => { setPadConnected([...navigator.getGamepads()].some(Boolean)); });

function pollPad() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const p = pads[0];
  if (p) {
    const b = (i) => !!p.buttons[i]?.pressed;
    const down = {
      left: b(14) || p.axes[0] < -0.55, right: b(15) || p.axes[0] > 0.55,
      up: b(12) || p.axes[1] < -0.55, down: b(13) || p.axes[1] > 0.55,
      accept: b(0), back: b(1), fav: b(2), detail: b(3),
      prevTab: b(4), nextTab: b(5), jumpL: b(6), jumpR: b(7), random: b(8), start: b(9)
    };
    const blocked = !document.hasFocus() || !!state.playing || performance.now() < state.padLockUntil;
    const now = performance.now();
    for (const [k, v] of Object.entries(down)) {
      if (!v) { delete held[k]; continue; }
      if (blocked) { held[k] = { next: Infinity }; continue; }
      const h = held[k];
      if (!h) {
        held[k] = { next: now + 380 };
        setInputMode('pad');
        act(k);
      } else if (isDir(k) && now > h.next) {
        h.next = now + 105;
        act(k);
      }
    }
  }
  requestAnimationFrame(pollPad);
}

function renderHints() {
  const pad = document.body.dataset.input === 'pad';
  const k = (a, b) => `<span><span class="key">${pad ? a : b}</span>`;
  $('#hints').innerHTML = pad
    ? `${k('A')} Oyna</span>${k('B')} Geri</span>${k('X')} Favori</span>${k('Y')} Detay</span>${k('LB')}/${k('RB')} Sekme</span>${k('SEL')} Rastgele</span>${k('☰')} Ayarlar</span>`
    : `${k('', 'Enter')} Oyna</span>${k('', 'Esc')} Geri</span>${k('', 'F')} Favori</span>${k('', 'D')} Detay</span>${k('', 'Q')}/${k('', 'E')} Sekme</span>${k('', 'R')} Rastgele</span>${k('', 'S')} Ayarlar</span>`;
}

// ---------- Baslangic ----------
(async function init() {
  state.settings = await api.settings.get();
  renderHints();
  if (typeof initSteam === 'function') initSteam();
  if (!state.settings.dolphinPath && !state.settings.pcsx2Path) {
    try { await api.setup.autodetect(); state.settings = await api.settings.get(); } catch (e) { /* sessiz */ }
  }
  document.body.dataset.platform = window.retrohubPlatform || 'desktop';
  await loadLibrary();
  if (state.games.length === 0 && (state.settings.gcFolder || state.settings.ps2Folder) && !state.settings.autoScan) {
    await api.library.scan();
    await loadLibrary();
  }
  setPadConnected([...(navigator.getGamepads?.() || [])].some(Boolean));
  requestAnimationFrame(pollPad);
})();
