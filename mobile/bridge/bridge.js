// Mobil kopru: masaustundeki preload.js'in yerine gecer, ayni window.retrohub arayuzunu sunar.
// Kutuphane/ayarlar WebView localStorage'inda tutulur; oyunlar Android'de Dolphin / NetherSX2 ile acilir.
// Mobilde olmayanlar: Turkce yama, otomatik FPS kodu, bulut klasoru (emulator verisine erisim yok).
(function () {
  window.retrohubPlatform = 'mobile';

  const Cap = window.Capacitor;
  const Native = Cap && Cap.registerPlugin ? Cap.registerPlugin('EmuLauncher') : null;
  const AppPlugin = Cap && Cap.registerPlugin ? Cap.registerPlugin('App') : null;

  const KEY = 'retrohub-mobile-v1';
  const DEFAULTS = {
    gcFolder: '', ps2Folder: '', coverFolder: '',
    autoScan: true, autoFps: false, fullscreenEmu: true, hideOnPlay: true, sounds: true,
    // Emulator ayarlari (gerekirse degistirilebilir)
    dolphinPackage: 'org.dolphinemu.dolphinemu',
    dolphinActivity: 'org.dolphinemu.dolphinemu.ui.main.MainActivity',
    dolphinExtra: 'AutoStartFile',
    ps2Package: 'xyz.aethersx2.android',
    ps2Activity: 'xyz.aethersx2.android.EmulationActivity',
    ps2Extra: 'bootPath'
  };
  const GC_EXT = ['.iso', '.gcm', '.rvz', '.wia', '.ciso', '.gcz'];
  const PS2_EXT = ['.iso', '.bin', '.chd', '.cso', '.zso'];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  const db = load();
  db.settings = { ...DEFAULTS, ...(db.settings || {}) };
  db.games = db.games || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* dolu */ } };

  const listeners = {};
  const emit = (ch, data) => (listeners[ch] || []).forEach((cb) => cb(data));
  const toast = (message, type = 'info') => emit('toast', { message, type });

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0') + str.length.toString(16);
  }
  function cleanTitle(fileName) {
    let name = fileName.replace(/\.[^.]+$/, '');
    name = name.replace(/[\[(][^\])]*[\])]/g, ' ');
    name = name.replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim();
    return name || fileName;
  }
  function need() {
    if (!Native) throw new Error('Bu ozellik sadece Android uygulamasinda calisir.');
    return Native;
  }

  async function scanFolder(uri, platform, exts) {
    if (!uri) return [];
    const res = await need().scan({ uri, exts });
    return res.files.map((f) => ({ filePath: f.uri, platform, title: cleanTitle(f.name), fileName: f.name }));
  }

  async function syncLibrary(reason) {
    const s = db.settings;
    let found = [];
    try {
      found = [...(await scanFolder(s.gcFolder, 'gamecube', GC_EXT)), ...(await scanFolder(s.ps2Folder, 'ps2', PS2_EXT))];
    } catch (e) {
      toast('Tarama basarisiz: ' + e.message, 'warn');
      return Object.values(db.games);
    }
    const before = Object.keys(db.games).length;
    const next = {};
    for (const it of found) {
      const id = hash(it.filePath);
      const prev = db.games[id] || {};
      next[id] = {
        id, title: prev.title || it.title, platform: it.platform, filePath: it.filePath, cover: null,
        totalPlaySeconds: prev.totalPlaySeconds || 0, lastPlayed: prev.lastPlayed || null,
        favorite: !!prev.favorite, autoFps: false, patched: false, patchNote: null
      };
    }
    db.games = next;
    save();
    const list = Object.values(next);
    emit('library:changed', { count: list.length, added: Math.max(0, list.length - before), reason });
    return list;
  }

  // ---------- Oynama ----------
  let playing = null;
  async function play(id) {
    const g = db.games[id];
    if (!g) throw new Error('Oyun bulunamadi');
    if (playing) throw new Error('Zaten acik bir oyun var.');
    const s = db.settings;
    const gc = g.platform === 'gamecube';
    const pkg = gc ? s.dolphinPackage : s.ps2Package;
    const inst = await need().isInstalled({ package: pkg });
    if (!inst.installed) {
      throw new Error(gc ? 'Dolphin (Android) yuklu degil. Once Dolphin\'i kur.' : 'PS2 emulatoru (NetherSX2/AetherSX2) yuklu degil. Once onu kur.');
    }
    await need().launch({
      package: pkg,
      activity: gc ? s.dolphinActivity : s.ps2Activity,
      extraKey: gc ? s.dolphinExtra : s.ps2Extra,
      uri: g.filePath
    });
    playing = { id, startedAt: Date.now() };
    return true;
  }

  // RetroHub on plana donunca oyun bitmis sayilir (Android'de emulator sureci izlenemez).
  function onResume() {
    if (!playing) return;
    const { id, startedAt } = playing;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsed < 5) return; // emulator henuz acilmadi, uygulama yeni arka plana gitmedi
    playing = null;
    const g = db.games[id];
    if (g && elapsed >= 30) {
      g.totalPlaySeconds = (g.totalPlaySeconds || 0) + elapsed;
      g.lastPlayed = new Date().toISOString();
      save();
    }
    emit('game:exit', { gameId: id, elapsed, failed: false });
  }
  if (AppPlugin) {
    AppPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) { onResume(); if (db.settings.autoScan) syncLibrary('uygulama acildi'); }
    });
  }

  // Android geri tusu: acik sayfa/pencere varsa onu kapat, yoksa uygulamadan cik.
  if (AppPlugin) {
    AppPlugin.addListener('backButton', () => {
      const open = document.querySelector('#modal:not(.hidden), #settings:not(.hidden), #drawer:not(.hidden), #sPage:not(.hidden)');
      if (open) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (AppPlugin.exitApp) AppPlugin.exitApp();
    });
  }

  const noPatch = () => { throw new Error('Mobilde Turkce yama desteklenmiyor (masaustu uygulamasini kullan).'); };

  window.retrohub = {
    on: (ch, cb) => { (listeners[ch] = listeners[ch] || []).push(cb); },
    settings: {
      get: async () => db.settings,
      set: async (partial) => {
        db.settings = { ...db.settings, ...partial };
        save();
        if ('gcFolder' in partial || 'ps2Folder' in partial) syncLibrary('klasor secildi');
        return db.settings;
      },
      pickFolder: async () => {
        try { return (await need().pickFolder()).uri; } catch (e) { return null; }
      },
      pickFile: async () => null
    },
    setup: { autodetect: async () => ({ found: {}, applied: {} }) },
    app: { toggleFullscreen: async () => false, quit: async () => {} },
    library: {
      scan: () => syncLibrary('elle'),
      list: async () => Object.values(db.games)
    },
    game: {
      play,
      toggleFav: async (id) => { const g = db.games[id]; g.favorite = !g.favorite; save(); return g; },
      setAutoFps: async (id, value) => { db.games[id].autoFps = !!value; save(); return db.games[id]; },
      identify: async () => ({ id: null, kind: 'Kimlik', region: null })
    },
    patch: { apply: noPatch, restore: noPatch, autoScan: async () => [], autoApply: async () => [] },
    cheats: { installGecko: noPatch, installPnach: noPatch },
    codes: { refresh: async () => ({}) },
    cloud: { syncNow: async () => ({ down: 0, up: 0 }), localSaves: async () => [] }
  };

  // Acilista otomatik tara
  window.addEventListener('load', () => {
    setTimeout(() => { if (db.settings.autoScan && (db.settings.gcFolder || db.settings.ps2Folder)) syncLibrary('acilis'); }, 400);
  });
})();
