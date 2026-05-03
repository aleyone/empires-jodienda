/* ============================================================
   index.js — Página principal: listado, filtros, búsqueda
   ============================================================ */

Auth.requireAuth(true);
Auth.initNavbar();

let allHeroes = [];
let filters = {
  element: 'all',
  family:  'all',
  search:  '',
  sort:    'newest'
};

/* ---- CARGA INICIAL ---- */
async function loadHeroes() {
  try {
    allHeroes = await HeroesAPI.getAll();
    buildFamilyFilter();
    applyFilters();
    const tc = document.getElementById('total-count');
    if (tc) tc.textContent = allHeroes.length;
  } catch (err) {
    showToast('Error al cargar héroes', 'error');
    console.error(err);
  }
}

/* ---- CONSTRUYE EL SELECT DE FAMILIAS ---- */
function buildFamilyFilter() {
  const families = [...new Set(allHeroes.map(h => h.family).filter(Boolean))].sort();
  const sel = document.getElementById('filter-family');
  sel.innerHTML = '<option value="all">Todas</option>';
  families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    sel.appendChild(opt);
  });
}

/* ---- APLICA FILTROS Y RENDERIZA ---- */
function applyFilters() {
  let heroes = [...allHeroes];

  /* Filtro elemento */
  if (filters.element !== 'all') {
    heroes = heroes.filter(h => h.element === filters.element);
  }

  /* Filtro familia */
  if (filters.family !== 'all') {
    heroes = heroes.filter(h => h.family === filters.family);
  }

  /* Búsqueda por nombre */
  if (filters.search) {
    const q = filters.search.toLowerCase();
    heroes = heroes.filter(h => h.name.toLowerCase().includes(q));
  }

  /* Ordenación */
  switch (filters.sort) {
    case 'hardest':  heroes.sort((a,b) => (b.ratingHard||0) - (a.ratingHard||0)); break;
    case 'easiest':  heroes.sort((a,b) => (a.ratingHard||0) - (b.ratingHard||0)); break;
    case 'coolest':  heroes.sort((a,b) => (b.ratingCool||0) - (a.ratingCool||0)); break;
    case 'lamest':   heroes.sort((a,b) => (a.ratingCool||0) - (b.ratingCool||0)); break;
    case 'name':     heroes.sort((a,b) => a.name.localeCompare(b.name, 'es')); break;
    case 'newest':
    default:
      heroes.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  renderHeroes(heroes);
}

/* ---- RENDER ---- */
function renderHeroes(heroes) {
  const grid  = document.getElementById('heroes-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('hero-count');

  if (!heroes.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    count.textContent = 'Ningún infame encontrado';
    return;
  }

  empty.classList.add('hidden');
  count.textContent = `${heroes.length} ${heroes.length === 1 ? 'infame' : 'infames'}`;
  grid.innerHTML = heroes.map(HeroesAPI.renderCard).join('');
}

/* ---- EVENTOS: FILTROS DE ELEMENTO ---- */
document.querySelectorAll('[data-filter="element"]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter="element"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filters.element = btn.dataset.value;
    applyFilters();
  });
});

/* ---- EVENTOS: FAMILIA Y SORT ---- */
document.getElementById('filter-family').addEventListener('change', (e) => {
  filters.family = e.target.value;
  applyFilters();
});

document.getElementById('sort-by').addEventListener('change', (e) => {
  filters.sort = e.target.value;
  applyFilters();
});

/* ---- BÚSQUEDA ---- */
let searchTimer;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    filters.search = e.target.value.trim();
    applyFilters();
  }, 250);
});

/* ---- INIT ---- */
loadHeroes();
