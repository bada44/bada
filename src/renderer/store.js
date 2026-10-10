// src/renderer/store.js
// Mağaza modalı: uygulama içinde açar, ayrı pencere yok.

let storeGames = [];

window.openStore = async function() {
  const modal = document.getElementById('storeModal');
  modal.classList.remove('hidden');
  document.getElementById('storeSearch').value = '';

  if (storeGames.length === 0) {
    document.getElementById('storeList').innerHTML = '<div class="store-empty">Yükleniyor...</div>';
    try {
      const data = await window.retrohub.catalog.load();
      storeGames = data.games || [];
    } catch (e) {
      document.getElementById('storeList').innerHTML =
        '<div class="store-empty">Katalog yüklenemedi: ' + e.message + '</div>';
      return;
    }
  }
  renderStore(storeGames);
};

function renderStore(games) {
  const list = document.getElementById('storeList');
  if (!games.length) {
    list.innerHTML = '<div class="store-empty">Oyun bulunamadı.</div>';
    return;
  }
  list.innerHTML = games.map(g => `
    <div class="store-item">
      <img src="${g.cover}" alt="" onerror="this.style.visibility='hidden'">
      <div class="info">
        <div class="name">${g.title}</div>
        <div class="meta">${g.size || '?'} &nbsp;·&nbsp; ⭐ ${g.rating || '?'}/5</div>
      </div>
      <button class="dl" data-url="${g.url}">İNDİR</button>
    </div>
  `).join('');

  list.querySelectorAll('.dl').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      btn.textContent = 'Açılıyor...';
      await window.retrohub.catalog.open(url);
      setTimeout(() => { btn.textContent = 'İNDİR'; }, 1000);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('storeClose').addEventListener('click', () => {
    document.getElementById('storeModal').classList.add('hidden');
  });

  document.getElementById('storeSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderStore(storeGames.filter(g => g.title.toLowerCase().includes(q)));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('storeModal').classList.contains('hidden')) {
      document.getElementById('storeModal').classList.add('hidden');
    }
  });
});
