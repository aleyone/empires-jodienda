/* ============================================================
   hero-detail.js — Página de detalle de héroe
   ============================================================ */

Auth.requireAuth();
Auth.initNavbar();

const params = new URLSearchParams(window.location.search);
const heroId = params.get('id');

if (!heroId) window.location.href = 'index.html';

const ELEMENT_LABELS = {
  fire:   '🔥 Fuego',
  ice:    '❄️ Hielo',
  nature: '🌿 Naturaleza',
  dark:   '💜 Oscuridad',
  holy:   '✨ Sagrado'
};
const ELEMENT_CLS = {
  fire: 'element-fire', ice: 'element-ice', nature: 'element-nature',
  dark: 'element-dark', holy: 'element-holy'
};

let currentHero = null;

async function loadHero() {
  try {
    currentHero = await HeroesAPI.getById(heroId);
    renderHero(currentHero);
  } catch (err) {
    document.getElementById('hero-loading').querySelector('.empty-state-title').textContent = 'Héroe no encontrado';
  }
}

function renderHero(h) {
  document.getElementById('hero-loading').classList.add('hidden');
  document.getElementById('hero-content').classList.remove('hidden');

  document.title = `${h.name} – Mini Kripta · Empires & Jodienda`;

  /* OG tags */
  const base = window.location.origin;
  setMeta('og-title',       `${h.name} – Mini Kripta · Empires & Jodienda`);
  setMeta('og-description', `${ELEMENT_LABELS[h.element] || ''} · Jodidez: ${'★'.repeat(h.ratingHard||0)} · Mola: ${'★'.repeat(h.ratingCool||0)}`);
  setMeta('og-image',       h.imagePath ? `${base}${h.imagePath}` : '');
  setMeta('og-url',         window.location.href);

  /* Imagen */
  if (h.imagePath) {
    const img = document.getElementById('hero-image');
    img.src = h.imagePath;
    img.alt = h.name;
    document.getElementById('hero-no-image').classList.add('hidden');
  } else {
    document.getElementById('hero-image').classList.add('hidden');
    document.getElementById('hero-no-image').classList.remove('hidden');
  }

  /* Badges */
  const elBadge = document.getElementById('hero-element-badge');
  elBadge.textContent = ELEMENT_LABELS[h.element] || h.element;
  elBadge.className = `element-badge ${ELEMENT_CLS[h.element] || ''}`;

  if (h.family) {
    document.getElementById('hero-family-badge').textContent = h.family;
  } else {
    document.getElementById('hero-family-badge').style.display = 'none';
  }

  document.getElementById('hero-stars-badge').textContent = '⭐'.repeat(parseInt(h.rarity) || 0);
  document.getElementById('hero-name').textContent = h.name;
  document.getElementById('hero-meta').textContent =
    `Añadido por ${h.createdBy || '?'} · ${formatDate(h.createdAt)}`;

  /* Stats */
  const statsGrid = document.getElementById('stats-grid');
  const stats = [
    { label: 'Clase',          value: h.heroClass   },
    { label: 'Velocidad maná', value: h.manaSpeed   },
    { label: 'Poder de equipo',value: h.power       },
    { label: 'Ataque',         value: h.attack      },
    { label: 'Defensa',        value: h.defense     },
    { label: 'Vida',           value: h.health      },
  ].filter(s => s.value);

  statsGrid.innerHTML = stats.map(s => `
    <div class="stat-item">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
    </div>`).join('');

  /* Habilidad especial */
  if (h.specialName || h.specialDesc) {
    document.getElementById('special-name').textContent = h.specialName || '';
    document.getElementById('special-desc').textContent = h.specialDesc || '';
  } else {
    document.getElementById('hero-special').style.display = 'none';
  }

  /* Ratings */
  renderStarsReadonly(document.getElementById('stars-hard'), h.ratingHard || 0, 'red');
  renderStarsReadonly(document.getElementById('stars-cool'), h.ratingCool || 0, 'gold');

  /* Notas */
  if (h.notes) {
    document.getElementById('notes-section').classList.remove('hidden');
    document.getElementById('hero-notes').textContent = h.notes;
  }

  /* Acciones edición */
  if (Auth.canEdit()) {
    document.getElementById('edit-actions').classList.remove('hidden');
    document.getElementById('btn-edit').href = `hero-new.html?edit=${h.id}`;
  }

  /* Botón compartir */
  document.getElementById('share-btn').addEventListener('click', shareHero);
}

function setMeta(id, content) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('content', content);
}

/* ---- COMPARTIR ---- */
function shareHero() {
  if (!currentHero) return;
  const url  = window.location.href;
  const text = `☠️ Nuevo infame en Mini Kripta · Empires & Jodienda:\n*${currentHero.name}*\n${ELEMENT_LABELS[currentHero.element] || ''} · Jodidez: ${'★'.repeat(currentHero.ratingHard||0)}\n${url}`;

  if (navigator.share) {
    navigator.share({ title: `${currentHero.name} – Mini Kripta`, text, url })
      .catch(() => {});
  } else {
    /* Fallback: copiar al portapapeles */
    navigator.clipboard.writeText(text).then(() => {
      showToast('Enlace copiado al portapapeles', 'info');
    });
  }
}

/* ---- ELIMINAR ---- */
document.getElementById('btn-delete').addEventListener('click', () => {
  document.getElementById('modal-delete').classList.add('open');
});

document.getElementById('cancel-delete').addEventListener('click', () => {
  document.getElementById('modal-delete').classList.remove('open');
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
  try {
    await HeroesAPI.remove(heroId);
    showToast('Héroe eliminado', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    document.getElementById('modal-delete').classList.remove('open');
  }
});

loadHero();
