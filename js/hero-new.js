/* ============================================================
   hero-new.js — Formulario de nuevo/editar héroe
   ============================================================ */

Auth.requireEditor();
Auth.initNavbar();

const params = new URLSearchParams(window.location.search);
const editId = params.get('edit');
const isEdit = !!editId;

let compressedBlob    = null;
let existingImagePath = null;
let allHeroes         = [];
let duplicateWarned   = false; /* el usuario ya vio el aviso y aceptó continuar */

/* ---- CARGAR LISTA DE HÉROES PARA VALIDACIÓN ---- */
async function loadAllHeroes() {
  try {
    const res  = await fetch('/api/heroes');
    const data = await res.json();
    allHeroes  = data.heroes || [];
  } catch { allHeroes = []; }
}

/* ---- NORMALIZAR NOMBRE (para comparar) ---- */
function normalizeName(str) {
  return str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/* ---- BUSCAR DUPLICADO ---- */
function findDuplicate(name) {
  const input = normalizeName(name);
  if (!input) return null;

  /* Primero: coincidencia exacta */
  const exact = allHeroes.find(h => {
    if (isEdit && h.id === editId) return false;
    return normalizeName(h.name) === input;
  });
  if (exact) return { type: 'exact', hero: exact };

  /* Segundo: coincidencia parcial (uno contiene al otro) */
  const partial = allHeroes.find(h => {
    if (isEdit && h.id === editId) return false;
    const existing = normalizeName(h.name);
    return existing.includes(input) || input.includes(existing);
  });
  if (partial) return { type: 'partial', hero: partial };

  return null;
}

/* ---- VALIDACIÓN AL SALIR DEL CAMPO (blur) ---- */
document.getElementById('hero-name').addEventListener('blur', async (e) => {
  duplicateWarned = false;
  const name = e.target.value.trim();
  if (!name || name.length < 2) return;

  /* 1. Comprobar duplicado */
  const match = findDuplicate(name);
  if (match && match.type === 'exact') {
    const nameInput = document.getElementById('hero-name');
    const errEl     = document.getElementById('err-name');
    nameInput.classList.add('error');
    errEl.textContent = `Ya existe un héroe llamado "${match.hero.name}". Cambia el nombre.`;
    errEl.classList.add('visible');
    return;
  }
  if (match && match.type === 'partial') {
    showDuplicateModal(match.hero);
    /* wiki lookup se lanzará desde dup-continue si el usuario acepta */
    return;
  }

  /* 2. Sin duplicado → buscar en wiki */
  await wikiLookup(name);
});

/* Limpiar aviso mientras escribe */
document.getElementById('hero-name').addEventListener('input', () => {
  const errEl = document.getElementById('err-name');
  document.getElementById('hero-name').classList.remove('error');
  errEl.textContent = '';
  errEl.classList.remove('visible');
});

function checkNameDuplicate(value) {
  const nameInput  = document.getElementById('hero-name');
  const errEl      = document.getElementById('err-name');
  const warnBanner = document.getElementById('duplicate-warning');

  /* Limpiar estado previo */
  nameInput.classList.remove('error');
  errEl.textContent = '';
  errEl.classList.remove('visible');
  if (warnBanner) warnBanner.classList.add('hidden');

  if (!value.trim() || value.trim().length < 2) return;

  const match = findDuplicate(value);
  if (!match) return;

  if (match.type === 'exact') {
    nameInput.classList.add('error');
    errEl.textContent = `Ya existe un héroe llamado "${match.hero.name}". Cambia el nombre.`;
    errEl.classList.add('visible');
  } else {
    /* Coincidencia parcial → solo modal, sin error inline */
    nameInput.classList.remove('error');
    errEl.textContent = '';
    errEl.classList.remove('visible');
    showDuplicateModal(match.hero);
  }
}

/* ---- MODAL DE DUPLICADO PARCIAL ---- */
function showDuplicateModal(hero) {
  const modal    = document.getElementById('modal-duplicate');
  const heroName = document.getElementById('dup-hero-name');
  const heroImg  = document.getElementById('dup-hero-img');
  const heroEl   = document.getElementById('dup-hero-element');

  heroName.textContent = hero.name;
  document.getElementById('dup-hero-name-2').textContent = hero.name;

  const ELEMENT_LABELS = {
    fire: '🔥 Fuego', ice: '❄️ Hielo', nature: '🌿 Naturaleza',
    dark: '💜 Oscuridad', holy: '✨ Sagrado'
  };
  heroEl.textContent = ELEMENT_LABELS[hero.element] || hero.element || '';

  const noImg = document.getElementById('dup-hero-noimg');
  if (hero.imagePath) {
    heroImg.src = hero.imagePath;
    heroImg.classList.remove('hidden');
    if (noImg) noImg.style.display = 'none';
  } else {
    heroImg.classList.add('hidden');
    if (noImg) noImg.style.display = 'flex';
  }

  modal.style.display = 'block';
}

/* Botón "Es otro héroe, continuar" */
document.getElementById('dup-continue').addEventListener('click', async () => {
  document.getElementById('modal-duplicate').style.display = 'none';
  duplicateWarned = true;
  /* Quitar aviso del campo */
  document.getElementById('hero-name').classList.remove('error');
  document.getElementById('err-name').textContent = '';
  document.getElementById('err-name').classList.remove('visible');
  /* Buscar en wiki ahora que confirmamos que es otro héroe */
  const name = document.getElementById('hero-name').value.trim();
  if (name) await wikiLookup(name);
});

/* Botón "Cancelar, es el mismo" */
document.getElementById('dup-cancel').addEventListener('click', () => {
  document.getElementById('modal-duplicate').style.display = 'none';
  document.getElementById('hero-name').value = '';
  document.getElementById('hero-name').focus();
  duplicateWarned = false;
});

/* ---- CARGA DATOS PARA EDICIÓN ---- */
if (isEdit) {
  document.getElementById('form-title').textContent      = 'Editar infame';
  document.getElementById('submit-btn').textContent      = '💾 Guardar cambios';
  loadHeroForEdit();
}

async function loadHeroForEdit() {
  try {
    const hero = await HeroesAPI.getById(editId);

    /* Verificar permisos: editor solo puede editar sus propios héroes */
    if (!Auth.isAdmin() && hero.createdBy !== Auth.getUsername()) {
      showToast('No puedes editar un héroe de otro usuario', 'error');
      setTimeout(() => window.location.href = `hero-detail.html?id=${editId}`, 1500);
      return;
    }

    existingImagePath = hero.imagePath || null;

    document.getElementById('hero-name').value         = hero.name || '';
    document.getElementById('hero-element').value      = hero.element || '';
    document.getElementById('hero-family').value       = hero.family || '';
    document.getElementById('hero-rarity').value       = hero.rarity || '';
    document.getElementById('hero-class').value        = hero.heroClass || '';
    document.getElementById('hero-mana').value         = hero.manaSpeed || '';
    document.getElementById('hero-power').value        = hero.power || '';
    document.getElementById('hero-atk').value          = hero.attack || '';
    document.getElementById('hero-def').value          = hero.defense || '';
    document.getElementById('hero-hp').value           = hero.health || '';
    document.getElementById('hero-special-name').value = hero.specialName || '';
    document.getElementById('hero-special-desc').value = hero.specialDesc || '';
    document.getElementById('hero-notes').value        = hero.notes || '';
    document.getElementById('hero-howtobeat').value    = hero.howToBeat || '';

    setRating('rate-hard', hero.ratingHard || 0);
    setRating('rate-cool', hero.ratingCool || 0);

    if (hero.imagePath) {
      const preview = document.getElementById('upload-preview');
      preview.src   = hero.imagePath;
      preview.classList.add('visible');
    }
  } catch (err) {
    showToast('Error al cargar héroe', 'error');
  }
}

function setRating(containerId, value) {
  const container = document.getElementById(containerId);
  container.dataset.value = value;
  container.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('filled', i < value);
  });
}

/* ---- ESTRELLAS INTERACTIVAS ---- */
initStarRating(document.getElementById('rate-hard'));
initStarRating(document.getElementById('rate-cool'));

/* ---- UPLOAD DE IMAGEN ---- */
document.getElementById('hero-image-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const progressWrap = document.getElementById('upload-progress');
  const progressBar  = document.getElementById('progress-bar');
  const hint         = document.getElementById('img-size-hint');
  const preview      = document.getElementById('upload-preview');

  progressWrap.classList.remove('hidden');
  progressBar.style.width = '30%';
  hint.textContent = 'Comprimiendo imagen...';

  try {
    const result  = await compressImage(file, 400);
    compressedBlob = result.blob;
    compressedBlob._ext = result.isPng ? 'png' : 'jpg';

    progressBar.style.width = '100%';
    const kb = Math.round(result.size / 1024);
    hint.textContent = `✓ Imagen lista · ${kb} KB`;

    preview.src = result.url;
    preview.classList.add('visible');

    setTimeout(() => progressWrap.classList.add('hidden'), 800);
  } catch (err) {
    hint.textContent = '⚠️ Error al procesar la imagen';
    progressWrap.classList.add('hidden');
  }
});

/* ---- DRAG & DROP ---- */
const uploadArea = document.getElementById('upload-area');
uploadArea.addEventListener('dragover',  (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', ()  => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const input = document.getElementById('hero-image-input');
    const dt    = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  }
});

/* ---- SUBMIT ---- */
document.getElementById('hero-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name    = document.getElementById('hero-name').value.trim();
  const element = document.getElementById('hero-element').value;
  const rarity  = document.getElementById('hero-rarity').value;

  /* Limpiar errores */
  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = ''; el.classList.remove('visible');
  });

  let valid = true;
  if (!name)    { showErr('err-name',    'El nombre es obligatorio'); valid = false; }
  if (!element) { showErr('err-element', 'Selecciona un elemento');   valid = false; }
  if (!rarity)  { showErr('err-rarity',  'Selecciona la rareza');     valid = false; }

  /* Validar duplicado exacto en submit también */
  if (valid && !duplicateWarned) {
    const match = findDuplicate(name);
    if (match && match.type === 'exact') {
      showErr('err-name', `Ya existe un héroe llamado "${match.hero.name}".`);
      valid = false;
    } else if (match && match.type === 'partial') {
      showDuplicateModal(match.hero);
      return; /* esperar decisión del usuario */
    }
  }

  if (!valid) return;

  const heroData = {
    name,
    element,
    rarity,
    family:      document.getElementById('hero-family').value.trim(),
    heroClass:   document.getElementById('hero-class').value,
    manaSpeed:   document.getElementById('hero-mana').value,
    power:       document.getElementById('hero-power').value,
    attack:      document.getElementById('hero-atk').value,
    defense:     document.getElementById('hero-def').value,
    health:      document.getElementById('hero-hp').value,
    specialName: document.getElementById('hero-special-name').value.trim(),
    specialDesc: document.getElementById('hero-special-desc').value.trim(),
    notes:       document.getElementById('hero-notes').value.trim(),
    howToBeat:   document.getElementById('hero-howtobeat').value.trim(),
    ratingHard:  parseInt(document.getElementById('rate-hard').dataset.value) || 0,
    ratingCool:  parseInt(document.getElementById('rate-cool').dataset.value) || 0,
  };

  const btn = document.getElementById('submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    if (isEdit) {
      await HeroesAPI.update(editId, heroData, compressedBlob);
      showToast('¡Infame actualizado!', 'success');
      setTimeout(() => window.location.href = `hero-detail.html?id=${editId}`, 1000);
    } else {
      const result = await HeroesAPI.create(heroData, compressedBlob);
      showToast('¡Infame añadido al bestiario!', 'success');
      setTimeout(() => window.location.href = `hero-detail.html?id=${result.id}`, 1000);
    }
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled    = false;
    btn.textContent = isEdit ? '💾 Guardar cambios' : '⚔ Añadir infame';
  }
});

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

/* ---- INIT ---- */
loadAllHeroes();


/* ============================================================
   WIKI LOOKUP — busca el héroe al salir del campo nombre
   ============================================================ */

let wikiData = null; /* datos de la wiki para importar */

async function wikiLookup(name) {
  if (!name || name.length < 2) return;

  try {
    const res  = await fetch(`/api/hero-lookup?name=${encodeURIComponent(name)}`);
    if (!res.ok) return; /* no encontrado o error — silencio */
    const data = await res.json();
    if (data.error) return;

    /* Tenemos datos — guardar y mostrar modal */
    wikiData = data;
    showWikiModal(data);

  } catch { /* error de red — silencio */ }
}

function showWikiModal(data) {
  const modal    = document.getElementById('modal-wiki');
  const nameEl   = document.getElementById('wiki-modal-name');
  const metaEl   = document.getElementById('wiki-modal-meta');

  nameEl.textContent = data.name || '';

  /* Meta: elemento + rareza */
  const ELEMENT_LABELS = {
    fire:'🔥 Fuego', ice:'❄️ Hielo', nature:'🌿 Naturaleza',
    dark:'💜 Oscuridad', holy:'✨ Sagrado'
  };
  const RARITY_LABELS = { '3':'⭐⭐⭐ Raro', '4':'⭐⭐⭐⭐ Épico', '5':'⭐⭐⭐⭐⭐ Legendario' };
  const parts = [];
  if (data.element) parts.push(ELEMENT_LABELS[data.element] || data.element);
  if (data.rarity)  parts.push(RARITY_LABELS[data.rarity]  || data.rarity);
  if (data.heroClass) parts.push(data.heroClass);
  metaEl.textContent = parts.join(' · ');

  modal.style.display = 'block';
}

/* ---- Importar datos al formulario ---- */
document.getElementById('wiki-import-btn').addEventListener('click', () => {
  if (!wikiData) return;
  fillFormFromWiki(wikiData);
  document.getElementById('modal-wiki').style.display = 'none';
  wikiData = null;
});

/* ---- Cancelar ---- */
document.getElementById('wiki-cancel-btn').addEventListener('click', () => {
  document.getElementById('modal-wiki').style.display = 'none';
  wikiData = null;
});

function fillFormFromWiki(data) {
  if (data.element)     document.getElementById('hero-element').value      = data.element;
  if (data.rarity)      document.getElementById('hero-rarity').value       = data.rarity;
  if (data.heroClass)   document.getElementById('hero-class').value        = data.heroClass;
  if (data.manaSpeed)   document.getElementById('hero-mana').value         = data.manaSpeed;
  if (data.family)      document.getElementById('hero-family').value       = data.family;
  if (data.power)       document.getElementById('hero-power').value        = data.power;
  if (data.attack)      document.getElementById('hero-atk').value          = data.attack;
  if (data.defense)     document.getElementById('hero-def').value          = data.defense;
  if (data.health)      document.getElementById('hero-hp').value           = data.health;
  if (data.specialName) document.getElementById('hero-special-name').value = data.specialName;
  if (data.specialDesc) document.getElementById('hero-special-desc').value = data.specialDesc;

  /* Limpiar errores de validación */
  document.querySelectorAll('.form-error').forEach(e => {
    e.textContent = ''; e.classList.remove('visible');
  });
  document.querySelectorAll('.form-control.error').forEach(e => e.classList.remove('error'));

  showToast('Datos importados desde la wiki ✓', 'success');
}
