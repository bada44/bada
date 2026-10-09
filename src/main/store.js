const Store = require('electron-store');

const DEFAULT_SETTINGS = {
  dolphinPath: '',
  pcsx2Path: '',
  xdelta3Path: '',
  gcFolder: '',
  ps2Folder: '',
  coverFolder: '',
  patchesFolder: '',
  fpsCodesFolder: '',   // (opsiyonel) kendi kod klasorun: GALE01.txt / 1A2B3C4D.pnach
  codeRepoUrl: '',      // kod deposu index.json adresi (ornek: https://raw.githubusercontent.com/KULLANICI/retrohub-codes/main/index.json)
  pcsx2PatchesUrl: '',  // bos = PCSX2 resmi yama paketi
  usePcsx2Patches: true,
  useCommunityPatches: true, // topluluk 50/60 FPS yama deposu (PeterDelta/PCSX2)
  autoScan: true,       // acilista ve klasor degisince kutuphaneyi otomatik tara
  startWithWindows: false,
  cloudFolder: '',      // Google Drive/Dropbox/OneDrive icindeki herhangi bir klasor
  autoSync: true,       // oyun acilirken indir, kapaninca yukle
  autoFps: true,        // oyun acilirken FPS/performans profilini otomatik uygula
  fullscreenEmu: true,  // emulatoru tam ekran ac
  hideOnPlay: true,     // oyun acikken RetroHub'i gizle
  startFullscreen: false,
  sounds: true
};

const store = new Store({
  name: 'retrohub-data',
  defaults: { settings: DEFAULT_SETTINGS, games: {} }
});

// Eski surumden gelen ayarlari yeni alanlarla birlestir, kullanilmayan Google alanlarini sil.
const merged = { ...DEFAULT_SETTINGS, ...(store.get('settings') || {}) };
for (const k of ['googleClientId', 'googleClientSecret', 'driveTokens', 'driveFolderId', 'savePaths']) {
  delete merged[k];
}
store.set('settings', merged);

module.exports = store;
