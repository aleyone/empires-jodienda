/* ============================================================
   heroes.js — Capa de acceso a datos de héroes
   ============================================================ */

const HeroesAPI = (() => {

  /* Devuelve todos los héroes */
  async function getAll() {
    const res = await fetch('/api/heroes');
    if (!res.ok) throw new Error('Error al cargar héroes');
    const data = await res.json();
    return data.heroes || [];
  }

  /* Devuelve un héroe por ID */
  async function getById(id) {
    const res = await fetch(`/api/heroes/${id}`);
    if (!res.ok) throw new Error('Héroe no encontrado');
    return res.json();
  }

  /* Crea un héroe nuevo (multipart: imagen + JSON) */
  async function create(heroData, imageBlob) {
    const session = Auth.getSession();
    const formData = new FormData();
    formData.append('data', JSON.stringify(heroData));
    if (imageBlob) formData.append('image', imageBlob, 'hero.jpg');

    const res = await fetch('/api/heroes', {
      method: 'POST',
      headers: { 'x-username': session.username },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear héroe');
    }
    return res.json();
  }

  /* Actualiza un héroe */
  async function update(id, heroData, imageBlob) {
    const session = Auth.getSession();
    const formData = new FormData();
    formData.append('data', JSON.stringify(heroData));
    if (imageBlob) formData.append('image', imageBlob, 'hero.jpg');

    const res = await fetch(`/api/heroes/${id}`, {
      method: 'PUT',
      headers: { 'x-username': session.username },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar héroe');
    }
    return res.json();
  }

  /* Elimina un héroe */
  async function remove(id) {
    const session = Auth.getSession();
    const res = await fetch(`/api/heroes/${id}`, {
      method: 'DELETE',
      headers: { 'x-username': session.username }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar héroe');
    }
    return res.json();
  }

  /* Renderiza una card de héroe */
  function renderCard(hero) {
    const elementMap = {
      fire:   { label: '🔥 Fuego',      cls: 'element-fire'   },
      ice:    { label: '❄️ Hielo',       cls: 'element-ice'    },
      nature: { label: '🌿 Naturaleza',  cls: 'element-nature' },
      dark:   { label: '💜 Oscuridad',   cls: 'element-dark'   },
      holy:   { label: '✨ Sagrado',     cls: 'element-holy'   }
    };
    const el = elementMap[hero.element] || { label: hero.element, cls: '' };

    const img = hero.imagePath
      ? `<img class="hero-card-image" src="${hero.imagePath}" alt="${hero.name}" loading="lazy">`
      : `<div class="hero-card-image-placeholder">⚔</div>`;

    const hardStars  = renderStarsHtml(hero.ratingHard || 0, 'red');
    const coolStars  = renderStarsHtml(hero.ratingCool || 0, 'gold');

    return `
      <div class="hero-card" onclick="window.location.href='hero-detail.html?id=${hero.id}'">
        ${img}
        <div class="hero-card-body">
          <div class="hero-card-name">${escapeHtml(hero.name)}</div>
          <div class="hero-card-meta">
            <span class="element-badge ${el.cls}">${el.label}</span>
            ${hero.family ? `<span class="badge role-badge">${escapeHtml(hero.family)}</span>` : ''}
          </div>
          <div class="hero-card-footer">
            <div title="Qué jodido es" style="display:flex;gap:1px;">${hardStars}</div>
            <div title="Qué mola" style="display:flex;gap:1px;">${coolStars}</div>
          </div>
        </div>
      </div>`;
  }

  function renderStarsHtml(value, type) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const cls = i <= value ? (type === 'red' ? 'filled-red' : 'filled') : '';
      html += `<span class="star stars-sm ${cls}" style="cursor:default;">★</span>`;
    }
    return html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { getAll, getById, create, update, remove, renderCard };

})();
