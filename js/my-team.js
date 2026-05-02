/* my-team.js — Gestión del equipo propio */

Auth.requireAuth();
if (!Auth.canEdit()) window.location.href = 'alliance.html';
Auth.initNavbar();

const ELEMENT_ICONS   = { fire:'🔥', ice:'❄️', nature:'🌿', dark:'💜', holy:'✨' };
const ELEMENT_LABELS  = { fire:'Fuego', ice:'Hielo', nature:'Naturaleza', dark:'Oscuridad', holy:'Sagrado' };
const RARITY_LABELS   = { '3':'⭐⭐⭐ Raro','4':'⭐⭐⭐⭐ Épico','5':'⭐⭐⭐⭐⭐ Legendario' };

/* ¿Admin editando equipo de otro usuario? */
const params     = new URLSearchParams(window.location.search);
const targetUser = params.get('user') || Auth.getUsername();
const isOwnTeam  = targetUser === Auth.getUsername();

if (!isOwnTeam && !Auth.isAdmin()) window.location.href = 'alliance.html';
if (!isOwnTeam) {
  document.getElementById('team-title').textContent = `⚔ Equipo de ${targetUser}`;
}

let currentTeam  = { username: targetUser, heroes: [] };
let bestiario    = [];
let currentSlot  = null;
let teamHeroData = null; /* datos del héroe que se está añadiendo */
let teamImgBlob  = null;

/* ---- CARGAR EQUIPO ---- */
async function loadTeam() {
  try {
    const [teamRes, heroesRes] = await Promise.all([
      fetch(`/api/teams?username=${targetUser}`, { headers: { 'x-username': Auth.getUsername() } }),
      fetch('/api/heroes')
    ]);
    currentTeam = await teamRes.json();
    const data  = await heroesRes.json();
    bestiario   = data.heroes || [];
    renderSlots();
  } catch {
    showToast('Error al cargar el equipo', 'error');
  }
}

/* ---- RENDER SLOTS ---- */
function renderSlots() {
  const container = document.getElementById('team-slots');
  container.innerHTML = '';

  for (let pos = 1; pos <= 5; pos++) {
    const slot = currentTeam.heroes?.find(h => h.position === pos);
    const div  = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.4rem;';

    if (slot) {
      let hero = null;
      if (slot.heroId) hero = bestiario.find(h => h.id === slot.heroId);
      const data    = hero || slot.heroData || {};
      const imgPath = data.imagePath || null;
      const name    = data.name || '?';
      const element = ELEMENT_ICONS[data.element] || '⚔';

      div.innerHTML = `
        <div style="position:relative;width:80px;cursor:pointer;" onclick="openSlot(${pos})">
          ${imgPath
            ? `<img src="${imgPath}" style="width:80px;height:100px;object-fit:cover;object-position:top;border-radius:var(--radius-md);border:2px solid var(--border-gold);">`
            : `<div style="width:80px;height:100px;background:var(--bg-surface);border-radius:var(--radius-md);border:2px solid var(--border-gold);display:flex;align-items:center;justify-content:center;font-size:2rem;">${element}</div>`
          }
          <div style="position:absolute;inset:0;background:rgba(0,0,0,0);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;opacity:0;transition:all 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.5)';this.style.opacity='1';" onmouseout="this.style.background='rgba(0,0,0,0)';this.style.opacity='0';">
            <span style="color:white;font-size:0.75rem;font-weight:600;">Cambiar</span>
          </div>
          <button onclick="event.stopPropagation();removeHero(${pos})" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <span style="font-size:0.72rem;color:var(--text-secondary);text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</span>`;
    } else {
      div.innerHTML = `
        <div onclick="openSlot(${pos})" style="width:80px;height:100px;background:var(--bg-surface);border:2px dashed var(--border-subtle);border-radius:var(--radius-md);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:0.25rem;transition:all var(--transition);" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-subtle)'">
          <span style="font-size:1.5rem;color:var(--text-muted);">+</span>
        </div>
        <span style="font-size:0.72rem;color:var(--text-muted);">Slot ${pos}</span>`;
    }

    container.appendChild(div);
  }
}

/* ---- ABRIR SLOT ---- */
function openSlot(pos) {
  currentSlot  = pos;
  teamHeroData = null;
  teamImgBlob  = null;

  document.getElementById('team-hero-name').value = '';
  document.getElementById('team-wiki-status').style.display = 'none';
  document.getElementById('team-hero-preview').style.display = 'none';
  document.getElementById('team-manual-fields').style.display = 'none';
  document.getElementById('team-img-preview').style.display = 'none';
  document.getElementById('team-img-placeholder').style.display = 'flex';
  document.getElementById('modal-position-label').textContent = pos;
  document.getElementById('team-save-hero-btn').disabled = true;
  document.getElementById('modal-add-hero').style.display = 'block';
}

/* ---- BÚSQUEDA AL PULSAR BOTÓN ---- */
async function searchHero() {
  const name   = document.getElementById('team-hero-name').value.trim();
  const status = document.getElementById('team-wiki-status');
  if (!name || name.length < 2) {
    status.style.display = 'block';
    status.style.color   = 'var(--text-muted)';
    status.textContent   = 'Escribe al menos 2 caracteres';
    return;
  }

  /* 1. Buscar en bestiario */
  const found = bestiario.find(h => h.name.toLowerCase() === name.toLowerCase());
  if (found) {
    teamHeroData = { ...found, fromBestiario: true };
    showTeamHeroPreview(found);
    status.style.display = 'block';
    status.style.color   = '#70d470';
    status.textContent   = '✓ Encontrado en el bestiario';
    document.getElementById('team-manual-fields').style.display = 'none';
    document.getElementById('team-save-hero-btn').disabled = false;
    return;
  }

  /* 2. Buscar en wiki */
  status.style.display = 'block';
  status.style.color   = 'var(--gold)';
  status.textContent   = `Buscando "${name}" en la wiki...`;

  try {
    const res  = await fetch(`/api/hero-lookup?name=${encodeURIComponent(name)}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      status.style.color  = 'var(--text-muted)';
      status.textContent  = 'No encontrado en la wiki. Rellena manualmente.';
      teamHeroData        = { name };
      document.getElementById('team-manual-fields').style.display = 'block';
      document.getElementById('team-hero-preview').style.display  = 'none';
      return;
    }

    teamHeroData = { ...data, name };
    showTeamHeroPreview(data);
    status.style.color  = '#70d470';
    status.textContent  = '✓ Datos importados desde la wiki';
    document.getElementById('team-manual-fields').style.display = 'none';
    document.getElementById('team-save-hero-btn').disabled = false;

  } catch {
    status.style.color  = 'var(--text-muted)';
    status.textContent  = 'Error al conectar con la wiki. Rellena manualmente.';
    teamHeroData        = { name };
    document.getElementById('team-manual-fields').style.display = 'block';
  }
}

/* Botón buscar y Enter en el input */
document.getElementById('team-search-btn').addEventListener('click', searchHero);
document.getElementById('team-hero-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchHero(); }
});

function showTeamHeroPreview(data) {
  const preview  = document.getElementById('team-hero-preview');
  const nameEl   = document.getElementById('team-preview-name');
  const metaEl   = document.getElementById('team-preview-meta');
  const imgWrap  = document.getElementById('team-preview-img-wrap');

  nameEl.textContent = data.name || '';
  const parts = [];
  if (data.element)   parts.push(ELEMENT_LABELS[data.element] || data.element);
  if (data.rarity)    parts.push(RARITY_LABELS[data.rarity]   || data.rarity);
  if (data.heroClass) parts.push(data.heroClass);
  metaEl.textContent = parts.join(' · ');

  if (data.imageUrl || data.imagePath) {
    const img = document.createElement('img');
    img.src   = data.imageUrl || data.imagePath;
    img.style.cssText = 'width:48px;height:60px;object-fit:cover;object-position:top;border-radius:var(--radius-sm);';
    imgWrap.innerHTML = '';
    imgWrap.appendChild(img);
  } else {
    imgWrap.textContent = ELEMENT_ICONS[data.element] || '⚔';
  }

  preview.style.display = 'flex';
}

/* ---- UPLOAD IMAGEN MANUAL ---- */
document.getElementById('team-img-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('team-img-preview');
    preview.src   = ev.target.result;
    preview.style.display = 'block';
    document.getElementById('team-img-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
  teamImgBlob = file;
});

/* ---- GUARDAR HÉROE EN SLOT ---- */
document.getElementById('team-save-hero-btn').addEventListener('click', async () => {
  const name = document.getElementById('team-hero-name').value.trim();
  if (!name) return showToast('Escribe el nombre del héroe', 'info');
  if (!teamHeroData) return showToast('Busca primero el héroe', 'info');

  const btn = document.getElementById('team-save-hero-btn');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    const fd = new FormData();

    let payload = {
      position:      currentSlot,
      targetUsername: targetUser,
      name
    };

    if (teamHeroData?.fromBestiario) {
      /* Usar referencia al bestiario */
      payload.heroId = teamHeroData.id;
    } else {
      /* Datos propios */
      payload = {
        ...payload,
        element:     teamHeroData?.element     || document.getElementById('team-hero-element').value,
        rarity:      teamHeroData?.rarity      || document.getElementById('team-hero-rarity').value,
        heroClass:   teamHeroData?.heroClass   || '',
        manaSpeed:   teamHeroData?.manaSpeed   || '',
        family:      teamHeroData?.family      || '',
        specialName: teamHeroData?.specialName || '',
        imagePath:   teamHeroData?.imageUrl    || teamHeroData?.imagePath || null,
      };
    }

    fd.append('data', JSON.stringify(payload));
    if (teamImgBlob) fd.append('image', teamImgBlob);

    const res = await fetch('/api/teams', {
      method:  'POST',
      headers: { 'x-username': Auth.getUsername() },
      body:    fd
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al guardar');
    }

    const data = await res.json();
    currentTeam = data.team;
    renderSlots();
    document.getElementById('modal-add-hero').style.display = 'none';
    showToast('¡Héroe añadido al equipo!', 'success');

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '⚔ Añadir al equipo';
  }
});

/* ---- ELIMINAR HÉROE ---- */
async function removeHero(pos) {
  try {
    const res = await fetch(`/api/teams/${targetUser}/${pos}`, {
      method:  'DELETE',
      headers: { 'x-username': Auth.getUsername() }
    });
    if (!res.ok) throw new Error();
    currentTeam.heroes = currentTeam.heroes.filter(h => h.position !== pos);
    renderSlots();
    showToast('Héroe eliminado del equipo', 'success');
  } catch {
    showToast('Error al eliminar', 'error');
  }
}

document.getElementById('team-cancel-btn').addEventListener('click', () => {
  document.getElementById('modal-add-hero').style.display = 'none';
});

loadTeam();
