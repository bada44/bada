const { spawn } = require('child_process');
const store = require('./store');

// Bir oyunu baslatir, kapanana kadar sureyi sayar, kapaninca store'a toplam
// oynama suresini ve son oynama tarihini yazar.
function playGame(game, { onTick, onExit, onError } = {}) {
  const settings = store.get('settings');
  const emuPath = game.platform === 'gamecube' ? settings.dolphinPath : settings.pcsx2Path;

  if (!emuPath) {
    onError && onError(game.platform === 'gamecube'
      ? 'Dolphin yolu ayarli degil. Ayarlar > Emulatorler.'
      : 'PCSX2 yolu ayarli degil. Ayarlar > Emulatorler.');
    return null;
  }

  // Dolphin: -b (batch) -e (dosya) ; "-C" ile ayar ezme (tam ekran)
  // PCSX2 (Qt): -batch [-fullscreen] -- <dosya>
  let args;
  if (game.platform === 'gamecube') {
    args = ['-b'];
    if (settings.fullscreenEmu) args.push('-C', 'Dolphin.Display.Fullscreen=True');
    args.push('-e', game.filePath);
  } else {
    args = ['-batch'];
    if (settings.fullscreenEmu) args.push('-fullscreen');
    args.push('--', game.filePath);
  }

  let child;
  try {
    child = spawn(emuPath, args, { detached: false });
  } catch (e) {
    onError && onError('Emulator baslatilamadi: ' + e.message);
    return null;
  }

  const startedAt = Date.now();
  const tick = setInterval(() => onTick && onTick(Math.floor((Date.now() - startedAt) / 1000)), 1000);
  let finished = false;

  const finish = (failed) => {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const games = store.get('games');
    const g = games[game.id];
    // 5 sn'den kisa "oynamalar" (emulator hemen cokerse) sureye yazilmaz
    if (g && !failed && elapsed >= 5) {
      g.totalPlaySeconds = (g.totalPlaySeconds || 0) + elapsed;
      g.lastPlayed = new Date().toISOString();
      games[game.id] = g;
      store.set('games', games);
    }
    onExit && onExit(elapsed, g, failed);
  };

  child.on('error', (err) => {
    onError && onError('Emulator hatasi: ' + err.message);
    finish(true);
  });
  child.on('exit', () => finish(false));
  return child;
}

module.exports = { playGame };
