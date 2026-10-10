// RetroHub — Wii menü müziği
// Kullanıcı kendi mp3 dosyasını assets/wii-menu.mp3 olarak koyar.
(function () {
  const audio = new Audio('../../assets/wii-menu.mp3');
  audio.loop = true;
  audio.volume = 0.25;

  let started = false;

  function startOnce() {
    if (started) return;
    started = true;
    audio.play().catch(() => { started = false; });
    document.removeEventListener('click', startOnce);
    document.removeEventListener('keydown', startOnce);
  }

  document.addEventListener('click', startOnce);
  document.addEventListener('keydown', startOnce);

  // Global fonksiyon
  window.toggleMusic = function () {
    if (audio.paused) {
      audio.play().catch(() => {});
      return true;
    } else {
      audio.pause();
      return false;
    }
  };

  // Müzik butonu bağlanınca
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnMusic');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = window.toggleMusic();
        btn.textContent = on ? '🔊' : '🔇';
      });
    }
  });
})();
