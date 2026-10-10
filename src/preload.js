const { contextBridge, ipcRenderer } = require('electron');

const inv = (ch, arg) => ipcRenderer.invoke(ch, arg);
const CHANNELS = ['toast', 'game:tick', 'game:exit', 'library:changed'];

contextBridge.exposeInMainWorld('retrohub', {
  on: (channel, cb) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_e, data) => cb(data));
  },
  settings: {
    get: () => inv('settings:get'),
    set: (partial) => inv('settings:set', partial),
    pickFolder: () => inv('settings:pickFolder'),
    pickFile: (filters) => inv('settings:pickFile', filters)
  },
  setup: { autodetect: () => inv('setup:autodetect') },
  app: { toggleFullscreen: () => inv('app:toggleFullscreen'), quit: () => inv('app:quit') },
  library: { scan: () => inv('library:scan'), list: () => inv('library:list') },
  game: {
    play: (id) => inv('game:play', id),
    toggleFav: (id) => inv('game:toggleFav', id),
    setAutoFps: (id, value) => inv('game:setAutoFps', { id, value }),
    identify: (id) => inv('game:identify', id)
  },
  patch: {
    apply: (gameId, patchFilePath) => inv('patch:apply', { gameId, patchFilePath }),
    restore: (id) => inv('patch:restore', id),
    autoScan: () => inv('patch:autoScan'),
    autoApply: (matches) => inv('patch:autoApply', matches)
  },
  cheats: {
    installGecko: (gameId, codeFilePath) => inv('cheats:installGecko', { gameId, codeFilePath }),
    installPnach: (pnachFilePath) => inv('cheats:installPnach', { pnachFilePath })
  },
  codes: {
    refresh: () => inv('codes:refresh'),
    save: (gameId, text) => inv('codes:save', { gameId, text }),
    remove: (gameId) => inv('codes:remove', gameId),
    coverage: () => inv('codes:coverage')
  },
  cloud: { syncNow: () => inv('cloud:syncNow'), localSaves: () => inv('cloud:localSaves') }
});
