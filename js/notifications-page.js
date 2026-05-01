/* ============================================================
   notifications-page.js — Lógica de la página de notificaciones
   ============================================================ */

Auth.requireAuth();
Auth.initNavbar();

const FIELD_LABELS = {
  element:     'Elemento',
  rarity:      'Rareza',
  heroClass:   'Clase',
  manaSpeed:   'Velocidad de maná',
  family:      'Familia',
  power:       'Poder de equipo',
  attack:      'Ataque',
  defense:     'Defensa',
  health:      'Vida',
  specialName: 'Nombre habilidad especial',
  specialDesc: 'Descripción habilidad',
  imageUrl:    'Imagen'
};

let allNotifications = [];
let currentCompareHero = null;
let currentWikiData    = null;

/* ---- CARGAR NOTIFICACIONES ---- */
async function loadNotifications() {
  try {
    const res  = await fetch('/api/notifications', {
      headers: { 'x-username': Auth.getUsername() }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    allNotifications = data.notifications || [];
    renderPage();
  } catch {
    showToast('Error al cargar notificaciones', 'error');
  } finally {
    document.getElementById('notif-loading').classList.add('hidden');
  }
}

/* ---- RENDER PRINCIPAL ---- */
async function renderPage() {
  const list  = document.getElementById('notif-list');
  const empty = document.getElementById('notif-empty');

  if (allNotifications.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  list.classList.remove('hidden');
  list.style.display = 'flex';
  list.innerHTML = '';

  /* Cargar héroes para cruzar estado */
  let heroes = [];
  try {
    const res = await fetch('/api/heroes');
    const d   = await res.json();
    heroes = d.heroes || [];
  } catch {}

  for (const notif of allNotifications) {
    const card = await renderNotifCard(notif, heroes);
    list.appendChild(card);
  }
}

/* ---- RENDER CARD ---- */
async function renderNotifCard(notif, heroes) {
  const card = document.createElement('div');
  card.style.cssText = `background:var(--bg-card);border:1px solid ${notif.read ? 'var(--border-subtle)' : 'var(--border-gold)'};border-radius:var(--radius-lg);overflow:hidden;`;

  /* Cabecera */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:1rem;border-bottom:1px solid var(--border-subtle);';
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;">
      ${!notif.read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;display:inline-block;"></span>' : ''}
      <span style="font-family:\'Cinzel\',serif;font-size:0.9rem;font-weight:600;color:var(--text-primary);">
        ${notif.type === 'wiki_update_summary' ? '📋 Resumen de actualizaciones' : '📖 Datos actualizados disponibles'}
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:0.75rem;">
      <span style="font-size:0.75rem;color:var(--text-muted);">${formatDate(notif.createdAt)}</span>
      ${!notif.read ? `<button onclick="markRead('${notif.id}', this)" class="btn btn-ghost btn-sm" style="font-size:0.75rem;padding:3px 8px;">✓ Leída</button>` : ''}
    </div>`;
  card.appendChild(header);

  /* Contenido según tipo */
  const body = document.createElement('div');
  body.style.cssText = 'padding:1rem;';

  if (notif.type === 'wiki_update_summary') {
    body.innerHTML = `<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">
      El job semanal encontró <strong>${notif.totalCount}</strong> héroe${notif.totalCount > 1 ? 's' : ''} con datos desactualizados:
    </p>`;

    for (const heroInfo of notif.heroes) {
      const hero = heroes.find(h => h.id === heroInfo.id);
      const isUpToDate = hero && !hero.wikiHasUpdates &&
        hero.wikiCheckedAt && new Date(hero.wikiCheckedAt) > new Date(notif.createdAt);

      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:0.65rem 0.85rem;border-radius:var(--radius-md);border:1px solid var(--border-subtle);margin-bottom:0.4rem;background:${isUpToDate ? 'rgba(94,196,94,0.05)' : 'var(--bg-surface)'};`;

      row.innerHTML = `
        <div>
          <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${escapeHtml(heroInfo.name)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">por ${escapeHtml(heroInfo.createdBy)} · ${heroInfo.diffCount} campo${heroInfo.diffCount > 1 ? 's' : ''} diferentes</div>
        </div>
        <div>
          ${isUpToDate
            ? '<span style="font-size:0.8rem;color:#70d470;">✅ Ya actualizado</span>'
            : `<button class="btn btn-secondary btn-sm" onclick="openCompare('${heroInfo.id}')">Revisar →</button>`
          }
        </div>`;
      body.appendChild(row);
    }

  } else if (notif.type === 'wiki_update') {
    const hero = heroes.find(h => h.id === notif.heroId);
    const isUpToDate = hero && !hero.wikiHasUpdates &&
      hero.wikiCheckedAt && new Date(hero.wikiCheckedAt) > new Date(notif.createdAt);

    if (isUpToDate) {
      body.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div style="font-size:1.5rem;">✅</div>
          <div>
            <p style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">${escapeHtml(notif.heroName)}</p>
            <p style="font-size:0.82rem;color:#70d470;">Este héroe ya ha sido actualizado con los datos de la wiki.</p>
          </div>
        </div>`;
    } else {
      body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
          <div>
            <p style="font-size:0.9rem;font-weight:600;color:var(--text-primary);">${escapeHtml(notif.heroName)}</p>
            <p style="font-size:0.82rem;color:var(--text-secondary);">
              Tu héroe tiene ${notif.diffCount} campo${notif.diffCount > 1 ? 's' : ''} con datos diferentes en la wiki.
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" style="flex-shrink:0;" onclick="openCompare('${notif.heroId}')">Revisar →</button>
        </div>`;
    }
  }

  card.appendChild(body);
  return card;
}

/* ---- MARCAR COMO LEÍDA ---- */
async function markRead(id, btn) {
  try {
    await fetch(`/api/notifications/${id}`, {
      method: 'PUT',
      headers: { 'x-username': Auth.getUsername() }
    });
    const n = allNotifications.find(n => n.id === id);
    if (n) n.read = true;
    showToast('Marcada como leída', 'success');
    if (btn) btn.closest('[style*="border:1px"]')?.style?.setProperty('border-color', 'var(--border-subtle)');
    btn?.remove();
  } catch {
    showToast('Error', 'error');
  }
}

/* ---- MARCAR TODAS LEÍDAS ---- */
document.getElementById('mark-all-btn').addEventListener('click', async () => {
  const unread = allNotifications.filter(n => !n.read);
  if (unread.length === 0) return showToast('Todo ya está leído', 'info');
  await Promise.all(unread.map(n =>
    fetch(`/api/notifications/${n.id}`, {
      method: 'PUT',
      headers: { 'x-username': Auth.getUsername() }
    })
  ));
  allNotifications.forEach(n => n.read = true);
  showToast('Todas marcadas como leídas', 'success');
  renderPage();
});

/* ---- ABRIR TABLA COMPARATIVA ---- */
async function openCompare(heroId) {
  try {
    /* Cargar datos del héroe */
    const heroRes = await fetch(`/api/heroes/${heroId}`);
    if (!heroRes.ok) return showToast('Héroe no encontrado', 'error');
    const hero = await heroRes.json();

    /* Llamar a la wiki */
    const wikiRes = await fetch(`/api/hero-lookup?name=${encodeURIComponent(hero.name)}`);
    if (!wikiRes.ok) return showToast('No se pudieron obtener datos de la wiki', 'error');
    const wikiData = await wikiRes.json();
    if (wikiData.error) return showToast(wikiData.error, 'error');

    currentCompareHero = hero;
    currentWikiData    = wikiData;

    renderCompareTable(hero, wikiData);
    document.getElementById('compare-hero-name').textContent = hero.name;
    document.getElementById('modal-wiki-compare').style.display = 'block';

  } catch {
    showToast('Error al cargar datos', 'error');
  }
}

function renderCompareTable(hero, wiki) {
  const table = document.getElementById('compare-table');
  table.innerHTML = '';

  const HERO_MAP = {
    element: h => h.element, rarity: h => h.rarity, heroClass: h => h.heroClass,
    manaSpeed: h => h.manaSpeed, family: h => h.family, power: h => h.power,
    attack: h => h.attack, defense: h => h.defense, health: h => h.health,
    specialName: h => h.specialName, specialDesc: h => h.specialDesc,
    imageUrl: h => h.imagePath
  };

  const diffs = Object.keys(FIELD_LABELS).filter(key => {
    const heroVal = HERO_MAP[key](hero);
    const wikiVal = wiki[key];
    if (!wikiVal) return false;
    if (!heroVal) return true;
    if (key === 'imageUrl') return false;
    return String(heroVal).trim() !== String(wikiVal).trim();
  });

  if (diffs.length === 0) {
    table.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;font-size:0.9rem;">✅ Este héroe ya está actualizado con la wiki.</p>';
    document.getElementById('wiki-apply-btn').style.display = 'none';
    return;
  }

  document.getElementById('wiki-apply-btn').style.display = 'block';

  /* Cabecera */
  table.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border-gold);">
    <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Campo</span>
    <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Nuestra ficha</span>
    <span style="font-size:0.72rem;color:var(--gold);font-weight:700;text-transform:uppercase;">Wiki</span>
    <span></span>
  </div>`;

  diffs.forEach(key => {
    const heroVal = HERO_MAP[key](hero) || '';
    const wikiVal = wiki[key] || '';
    const isEmpty = !heroVal;

    const row = document.createElement('div');
    row.style.cssText = `display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;padding:0.6rem 0.75rem;border-radius:var(--radius-sm);align-items:center;background:${isEmpty ? 'rgba(201,149,42,0.06)' : 'transparent'};border:1px solid ${isEmpty ? 'rgba(201,149,42,0.15)' : 'var(--border-subtle)'};`;
    row.innerHTML = `
      <span style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);">${FIELD_LABELS[key]}</span>
      <span style="font-size:0.82rem;color:${isEmpty ? 'var(--text-muted)' : 'var(--text-primary)'};">${isEmpty ? '— vacío —' : escapeHtml(String(heroVal))}</span>
      <span style="font-size:0.82rem;color:var(--gold);">${escapeHtml(String(wikiVal))}</span>
      <input type="checkbox" id="chk_${key}" ${isEmpty ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;">`;
    table.appendChild(row);
  });
}

/* ---- APLICAR CAMBIOS ---- */
document.getElementById('wiki-apply-btn').addEventListener('click', async () => {
  if (!currentCompareHero || !currentWikiData) return;

  const updates = {};
  Object.keys(FIELD_LABELS).forEach(key => {
    const chk = document.getElementById(`chk_${key}`);
    if (chk && chk.checked) {
      updates[key === 'imageUrl' ? 'imagePath' : key] = currentWikiData[key];
    }
  });

  if (Object.keys(updates).length === 0) return showToast('No hay campos seleccionados', 'info');

  const btn = document.getElementById('wiki-apply-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const updatedHero = {
      ...currentCompareHero,
      ...updates,
      wikiCheckedAt:  new Date().toISOString(),
      wikiHasUpdates: false
    };

    const fd = new FormData();
    fd.append('data', JSON.stringify(updatedHero));

    const res = await fetch(`/api/heroes/${currentCompareHero.id}`, {
      method:  'PUT',
      headers: { 'x-username': Auth.getUsername() },
      body:    fd
    });

    if (!res.ok) throw new Error('Error al guardar');

    showToast('Héroe actualizado ✓', 'success');
    document.getElementById('modal-wiki-compare').style.display = 'none';
    /* Recargar para reflejar el estado actualizado */
    setTimeout(() => loadNotifications(), 800);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Actualizar campos seleccionados';
  }
});

document.getElementById('wiki-compare-cancel').addEventListener('click', () => {
  document.getElementById('modal-wiki-compare').style.display = 'none';
});

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- INIT ---- */
loadNotifications();
