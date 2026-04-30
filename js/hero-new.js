/* ============================================================
   hero-new.js — Formulario de nuevo/editar héroe
   ============================================================ */

Auth.requireEditor();
Auth.initNavbar();

const params = new URLSearchParams(window.location.search);
const editId = params.get('edit');
const isEdit = !!editId;

let compressedBlob = null;
let existingImagePath = null;

if (isEdit) {
  document.getElementById('form-title').textContent = 'Editar infame';
  document.getElementById('submit-btn').textContent = '💾 Guardar cambios';
  loadHeroForEdit();
}

/* ---- CARGA DATOS PARA EDICIÓN ---- */
async function loadHeroForEdit() {
  try {
    const hero = await HeroesAPI.getById(editId);
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

    /* Ratings */
    setRating('rate-hard', hero.ratingHard || 0);
    setRating('rate-cool', hero.ratingCool || 0);

    /* Preview de imagen existente */
    if (hero.imagePath) {
      const preview = document.getElementById('upload-preview');
      preview.src = hero.imagePath;
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
    const result = await compressImage(file, 400);
    compressedBlob = result.blob;

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
    const dt = new DataTransfer();
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

  /* Validación mínima */
  let valid = true;
  if (!name)    { showErr('err-name', 'El nombre es obligatorio'); valid = false; }
  if (!element) { showErr('err-element', 'Selecciona un elemento'); valid = false; }
  if (!rarity)  { showErr('err-rarity', 'Selecciona la rareza'); valid = false; }
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
    ratingHard:  parseInt(document.getElementById('rate-hard').dataset.value) || 0,
    ratingCool:  parseInt(document.getElementById('rate-cool').dataset.value) || 0,
  };

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
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
    btn.disabled = false;
    btn.textContent = isEdit ? '💾 Guardar cambios' : '⚔ Añadir infame';
  }
});

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}
