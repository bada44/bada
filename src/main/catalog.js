// src/main/catalog.js
const { ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

function setupCatalog() {
  ipcMain.handle('catalog:load', () => {
    const catalogPath = path.join(__dirname, '..', '..', 'catalog.json');
    try {
      const data = fs.readFileSync(catalogPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('catalog.json okunamadi:', err.message);
      return { games: [] };
    }
  });

  ipcMain.handle('catalog:open', async (event, url) => {
    if (url && url.startsWith('http')) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false, error: 'Gecersiz URL' };
  });
}

module.exports = { setupCatalog };
