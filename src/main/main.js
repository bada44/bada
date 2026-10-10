const { app, BrowserWindow, ipcMain, dialog, net } = require('electron');
const { setupCatalog } = require('./catalog');
const path = require('path');
const fs = require('fs');

const store = require('./store');
const scanner = require('./scanner');
const launcher = require('./launcher');
const patcher = require('./patcher');
const sync = require('./sync');
const cheats = require('./cheats');
const fps = require('./fps');
const paths = require('./paths');
const codes = require('./codes');
const covers = require('./covers');

let mainWindow;
let playingId = null;

function createWindow() {
  const s = store.get('settings');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#07080f',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    title: 'RetroHub',
    autoHideMenuBar: true,
    fullscreen: !!s.startFullscreen,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // arka planda da gamepad/sure dogru calissin
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    setupCatalog();

    // --- Mağaza penceresi ---
    ipcMain.handle('catalog:openStore', () => {
      const storeWin = new BrowserWindow({
        width: 1000,
        height: 700,
        title: 'RetroHub Mağaza',
        parent: mainWindow,
        modal: false,
        backgroundColor: '#1b2838',
        webPreferences: {
          preload: path.join(__dirname, '..', 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      storeWin.loadFile(path.join(__dirname, '..', 'renderer', 'store.html'));
    });
    // --- Mağaza penceresi sonu ---

    createWindow();
    paths.configure(store.get('settings'));
    initCodeRepo();
    applyLoginItem(store.get('settings'));
    mainWindow.webContents.once('did-finish-load', () => { autoScan('acilis'); refreshCodes(false); });
    watchLibraryFolders();
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });


// ---------- Kod deposu (internetten) ----------
let codeRepo;
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    if (!/^https:\/\//i.test(url)) return reject(new Error('Sadece https adresleri desteklenir'));
    const req = net.request({ url, redirect: 'follow' });
    const chunks = [];
    const timer = setTimeout(() => { req.abort(); reject(new Error('Zaman asimi')); }, 60000);
    req.on('response', (res) => {
      if (res.statusCode !== 200) { clearTimeout(timer); return reject(new Error('HTTP ' + res.statusCode)); }
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      res.on('error', (e) => { clearTimeout(timer); reject(e); });
    });
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}
let coverRepo;
let coverRunning = false;
// Kapagi olmayan oyunlar icin arka planda kapak indirir (internet yoksa sessizce vazgecer).
async function fetchMissingCovers() {
  if (coverRunning || !coverRepo) return;
  coverRunning = true;
  try {
    let changed = 0;
    const games = Object.values(store.get('games')).filter((g) => !g.cover);
    for (const g of games) {
      let region = null;
      try { region = fps.identify(g).region; } catch (e) { /* kimlik okunamadi */ }
      const p = await coverRepo.fetchFor(g, region).catch(() => null);
      if (p) {
        const all = store.get('games');
        if (all[g.id]) { all[g.id].cover = p; store.set('games', all); changed++; }
        if (changed % 5 === 0) send('library:changed', { count: Object.keys(all).length, added: 0, reason: 'kapak' });
      }
    }
    if (changed) send('library:changed', { count: Object.keys(store.get('games')).length, added: 0, reason: 'kapak' });
  } finally { coverRunning = false; }
}
function initCodeRepo() {
  coverRepo = covers.create({ dir: path.join(app.getPath('userData'), 'covers'), fetchBuffer });
  codeRepo = codes.create({ cacheDir: path.join(app.getPath('userData'), 'codes-cache'), fetchBuffer });
  fps.setRepo(codeRepo);
}
async function refreshCodes(force) {
  try {
    const r = await codeRepo.updateIndex(store.get('settings'), { force });
    if (force) {
      if (r.errors.length) toast(r.errors.join(' | '), 'warn');
      else toast(`Kod deposu guncellendi (${r.index} kayit, ${r.ps2} PS2 yamasi)`, 'ok');
    }
    return r;
  } catch (err) {
    if (force) toast('Kod deposu guncellenemedi: ' + err.message, 'warn');
    return { errors: [err.message] };
  }
}

// ---------- Otomatik tarama ----------
let scanTimer = null;
let watchers = [];
function autoScan(reason) {
  const s = store.get('settings');
  if (!s.autoScan || (!s.gcFolder && !s.ps2Folder)) return;
  try {
    const before = Object.keys(store.get('games')).length;
    const list = scanner.syncLibrary();
    send('library:changed', { count: list.length, added: Math.max(0, list.length - before), reason });
    fetchMissingCovers();
  } catch (err) { toast('Otomatik tarama basarisiz: ' + err.message, 'warn'); }
}
function watchLibraryFolders() {
  watchers.forEach((w) => { try { w.close(); } catch (e) { /* kapali */ } });
  watchers = [];
  const s = store.get('settings');
  for (const dir of [s.gcFolder, s.ps2Folder]) {
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      // recursive: Windows ve macOS'ta var; Linux'ta sadece ust klasoru izler
      const w = fs.watch(dir, { recursive: true }, () => {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => autoScan('klasor degisti'), 3000); // kopyalama bitsin diye bekle
      });
      w.on('error', () => {});
      watchers.push(w);
    } catch (e) { /* izleme desteklenmiyorsa acilis taramasi yeterli */ }
  }
}
function applyLoginItem(s) {
  if (!app.isPackaged) return; // gelistirme modunda kayit etme
  try { app.setLoginItemSettings({ openAtLogin: !!s.startWithWindows }); } catch (e) { /* sessiz */ }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}
const toast = (message, type = 'info') => send('toast', { message, type });

function getGame(id) {
  const g = store.get('games')[id];
  if (!g) throw new Error('Oyun bulunamadi');
  return g;
}
function updateGame(id, patch) {
  const games = store.get('games');
  if (!games[id]) return null;
  games[id] = { ...games[id], ...patch };
  store.set('games', games);
  return games[id];
}

// ---------- Ayarlar ----------
ipcMain.handle('settings:get', () => store.get('settings'));
ipcMain.handle('settings:set', (_e, partial) => {
  store.set('settings', { ...store.get('settings'), ...partial });
  const s = store.get('settings');
  if ('dolphinPath' in partial || 'pcsx2Path' in partial) paths.configure(s);
  if ('gcFolder' in partial || 'ps2Folder' in partial || 'autoScan' in partial) {
    watchLibraryFolders();
    if ('gcFolder' in partial || 'ps2Folder' in partial) autoScan('klasor secildi');
  }
  if ('startWithWindows' in partial) applyLoginItem(s);
  if ('codeRepoUrl' in partial || 'pcsx2PatchesUrl' in partial || 'usePcsx2Patches' in partial || 'useCommunityPatches' in partial) refreshCodes(true);
  return s;
});
ipcMain.handle('settings:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});
ipcMain.handle('settings:pickFile', async (_e, filters) => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: filters || [] });
  return res.canceled ? null : res.filePaths[0];
});
ipcMain.handle('setup:autodetect', () => {
  const found = paths.detectEmulators();
  const s = store.get('settings');
  const patch = {};
  if (!s.dolphinPath && found.dolphinPath) patch.dolphinPath = found.dolphinPath;
  if (!s.pcsx2Path && found.pcsx2Path) patch.pcsx2Path = found.pcsx2Path;
  if (Object.keys(patch).length) store.set('settings', { ...s, ...patch });
  return { found, applied: patch };
});

// ---------- Pencere ----------
ipcMain.handle('app:toggleFullscreen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});
ipcMain.handle('app:quit', () => app.quit());

// ---------- Kutuphane ----------
ipcMain.handle('library:scan', () => scanner.syncLibrary());
ipcMain.handle('library:list', () => Object.values(store.get('games')));
ipcMain.handle('game:toggleFav', (_e, id) => {
  const g = getGame(id);
  return updateGame(id, { favorite: !g.favorite });
});
ipcMain.handle('game:setAutoFps', (_e, { id, value }) => updateGame(id, { autoFps: !!value }));
ipcMain.handle('game:identify', (_e, id) => fps.identify(getGame(id)));
ipcMain.handle('codes:refresh', () => refreshCodes(true));

// Kullanicinin yapistirdigi kodu bu oyunun TAM ID/CRC'sine baglayip kaydeder (baska bolgeye uygulanmaz).
ipcMain.handle('codes:save', (_e, { gameId, text }) => {
  const g = getGame(gameId);
  const info = fps.identify(g);
  if (!info.id) throw new Error('Oyunun kimligi okunamadi' + (info.error ? ': ' + info.error : '') + '.');
  const r = codeRepo.saveUserCode(g.platform, info.id, text);
  return { id: r.id, region: info.region, kind: info.kind };
});
ipcMain.handle('codes:remove', (_e, gameId) => {
  const g = getGame(gameId);
  const info = fps.identify(g);
  if (info.id) codeRepo.removeUserCode(g.platform, info.id);
  return true;
});

// Kapsama raporu: kutuphanedeki her oyun icin 60 FPS kodu var mi? (bolgeye gore)
ipcMain.handle('codes:coverage', () => {
  const rows = [];
  for (const g of Object.values(store.get('games'))) {
    let i = {};
    try { i = fps.identify(g); } catch (e) { /* okunamayan imaj */ }
    rows.push({
      title: g.title, platform: g.platform, region: i.region || 'Bilinmiyor', id: i.id || null,
      status: !i.id ? 'bilinmiyor' : (i.codeStatus === 'var' ? 'var' : 'yok'),
      mine: !!(i.id && codeRepo.hasUserCode(g.platform, i.id))
    });
  }
  return rows;
});

// ---------- Oynatma ----------
ipcMain.handle('game:play', async (_e, gameId) => {
  const game = getGame(gameId);
  if (playingId) throw new Error('Zaten acik bir oyun var.');
  const settings = store.get('settings');

  if (settings.cloudFolder && settings.autoSync) {
    try {
      const n = sync.syncDown();
      if (n) toast(`${n} kayit buluttan alindi`, 'ok');
    } catch (err) {
      toast('Bulut senkronu atlandi: ' + err.message, 'warn');
    }
  }

  try {
    const notes = await fps.prepare(game, settings);
    notes.forEach((n) => toast(n, /UYARI|indirilemedi|okunamadi/.test(n) ? 'warn' : 'info'));
    const gs = store.get('games');
    if (gs[gameId]) { gs[gameId].fpsReport = { at: new Date().toISOString(), notes }; store.set('games', gs); send('library:changed', { count: Object.keys(gs).length, added: 0, reason: 'fps' }); }
  } catch (err) {
    toast('FPS ayari uygulanamadi: ' + err.message, 'warn');
  }

  const child = launcher.playGame(game, {
    onTick: (elapsed) => send('game:tick', { gameId, elapsed }),
    onError: (msg) => toast(msg, 'err'),
    onExit: (elapsed, updated, failed) => {
      playingId = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      send('game:exit', { gameId, elapsed, failed: !!failed });
      if (settings.cloudFolder && settings.autoSync) {
        try {
          const n = sync.syncUp();
          if (n) toast(`${n} kayit buluta yuklendi`, 'ok');
        } catch (err) {
          toast('Buluta yuklenemedi: ' + err.message, 'warn');
        }
      }
    }
  });

  if (!child) return false;
  playingId = gameId;
  if (settings.hideOnPlay && mainWindow) mainWindow.minimize();
  return true;
});

// ---------- Yama ----------
ipcMain.handle('patch:apply', async (_e, { gameId, patchFilePath }) =>
  patcher.applyPatch(getGame(gameId), patchFilePath));
ipcMain.handle('patch:restore', (_e, gameId) => patcher.restoreOriginal(getGame(gameId)));
ipcMain.handle('patch:autoScan', () => {
  const s = store.get('settings');
  return patcher.findAutoMatches(s.patchesFolder, Object.values(store.get('games')));
});
ipcMain.handle('patch:autoApply', async (_e, matches) => {
  const results = [];
  for (const m of matches) {
    try {
      await patcher.applyPatch(getGame(m.gameId), m.patchFilePath, m.patchFileName);
      results.push({ ...m, ok: true });
    } catch (err) {
      results.push({ ...m, ok: false, error: err.message });
    }
  }
  return results;
});

// ---------- Elle kod kurma (ileri duzey; normalde otomatik) ----------
ipcMain.handle('cheats:installGecko', (_e, { gameId, codeFilePath }) => {
  const g = getGame(gameId);
  if (g.platform !== 'gamecube') throw new Error('Gecko kodlari sadece GameCube icindir');
  return cheats.installGeckoCode(g, codeFilePath);
});
ipcMain.handle('cheats:installPnach', (_e, { pnachFilePath }) => cheats.installPnach(pnachFilePath));

// ---------- Bulut kayit (klasor tabanli) ----------
ipcMain.handle('cloud:syncNow', () => {
  const down = sync.syncDown();
  const up = sync.syncUp();
  return { down, up };
});
ipcMain.handle('cloud:localSaves', () => sync.listLocalSaves());
