// src/renderer/store.js
let allGames = [];

async function loadCatalog() {
  try {
    const data = await window.retrohub.catalog.load();
    allGames = data.games || [];
    render(allGames);
  } catch (err) {
    console.error('Katalog yuklenemedi:', err);
    document.getElementById('games').innerHTML =
      '<div class="empty">Katalog yuklenemedi: ' + err.message + '</div>';
  }
}

function render(games) {
  const container = document.getElementById('games');
  if (!games.length) {
    container.innerHTML = '<div class="empty">Oyun bulunamadi.</div>';
    return;
  }
  container.innerHTML = games.map(g => `
    <div class="game-card">
      <img src="${g.cover}" alt="${g.title}">
      <div class="game-info">
        <div class="game-title">${g.title}</div>
        <div class="game-meta">
          <span>${g.size || '?'}</span>
          <span>⭐ ${g.rating || '?'}/5</span>
        </div>
      </div>
      <button class="download-btn" data-url="${g.url}">INDIR</button>
    </div>
  `).join('');

  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      btn.textContent = 'Aciliyor...';
      await window.retrohub.catalog.open(url);
      setTimeout(() => { btn.textContent = 'INDIR'; }, 1000);
    });
  });
}

document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  render(allGames.filter(g => g.title.toLowerCase().includes(q)));
});

loadCatalog();
