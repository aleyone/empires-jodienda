/* ============================================================
   hero-detail.js — Página de detalle de héroe
   ============================================================ */

Auth.requireAuth(true);
Auth.initNavbar();

/* Si es invitado, ocultar todas las acciones de edición */
if (Auth.isGuest()) {
  document.addEventListener('DOMContentLoaded', () => {
    ['edit-actions','btn-edit','btn-delete','comment-form'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  });
}

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

  document.title = `${h.name} – Mini Kripta · Empires & Puzzles`;

  /* OG tags */
  const base = window.location.origin;
  setMeta('og-title',       `${h.name} – Mini Kripta · Empires & Puzzles`);
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

  /* Acciones edición — admin ve siempre, editor solo sus propios */
  if (Auth.canEdit()) {
    const editActions = document.getElementById('edit-actions');
    const isOwner     = h.createdBy === Auth.getUsername();
    const canModify   = Auth.isAdmin() || isOwner;

    editActions.classList.remove('hidden');
    document.getElementById('btn-edit').href = `hero-new.html?edit=${h.id}`;

    if (!canModify) {
      /* Deshabilitar botones y mostrar aviso */
      const btnEdit   = document.getElementById('btn-edit');
      const btnDelete = document.getElementById('btn-delete');

      btnEdit.style.opacity   = '0.4';
      btnEdit.style.pointerEvents = 'none';
      btnDelete.style.opacity = '0.4';
      btnDelete.style.pointerEvents = 'none';

      const notice = document.createElement('p');
      notice.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem;';
      notice.textContent    = `Este héroe fue añadido por ${h.createdBy || 'otro usuario'}. Solo puedes editar o eliminar tus propios héroes.`;
      editActions.appendChild(notice);
    }
  }

  /* Botón compartir */
  document.getElementById('share-btn').addEventListener('click', shareHero);

  /* Extras */
  renderHowToBeat(h);
  initComments(h);

  /* Wiki check en segundo plano — Fase 2 */
  wikiCheck(h);

  /* Galería de imágenes adicionales */
  renderAdditionalGallery(h);
}

function setMeta(id, content) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('content', content);
}

/* ---- COMPARTIR ---- */
function shareHero() {
  if (!currentHero) return;
  const url  = window.location.href;
  const text = `☠️ Nuevo infame en Mini Kripta · Empires & Puzzles:\n*${currentHero.name}*\n${ELEMENT_LABELS[currentHero.element] || ''} · Jodidez: ${'★'.repeat(currentHero.ratingHard||0)}\n${url}`;

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

/* ============================================================
   CÓMO VENCERLE + COMENTARIOS
   ============================================================ */

function renderHowToBeat(h) {
  if (h.howToBeat) {
    document.getElementById('howtobeat-section').classList.remove('hidden');
    document.getElementById('hero-howtobeat').textContent = h.howToBeat;
  }
}

/* ---- COMENTARIOS ---- */
function initComments(h) {
  const btnAdd    = document.getElementById('btn-add-comment');
  const formWrap  = document.getElementById('comment-form-wrap');
  const noComment = document.getElementById('no-comments');
  const list      = document.getElementById('comments-list');

  if (Auth.isLoggedIn()) btnAdd.style.display = 'inline-flex';

  /* Render comentarios existentes */
  const comments = h.comments || [];
  if (comments.length > 0) {
    noComment.style.display = 'none';
    list.innerHTML = comments.map(c => renderComment(c)).join('');
  }

  /* Añadir comentario */
  btnAdd.addEventListener('click', () => {
    formWrap.classList.remove('hidden');
    btnAdd.style.display = 'none';
    document.getElementById('comment-input').focus();
  });

  document.getElementById('cancel-comment').addEventListener('click', () => {
    formWrap.classList.add('hidden');
    btnAdd.style.display = 'inline-flex';
    document.getElementById('comment-input').value = '';
  });

  document.getElementById('submit-comment').addEventListener('click', async () => {
    const text = document.getElementById('comment-input').value.trim();
    if (!text) return;

    const btn = document.getElementById('submit-comment');
    btn.disabled = true;

    try {
      const res = await fetch(`/api/heroes/${heroId}/comment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-username': Auth.getUsername() },
        body:    JSON.stringify({ text })
      });

      if (!res.ok) throw new Error();

      const updated = await res.json();
      const newComments = updated.comments || [];

      noComment.style.display = 'none';
      list.innerHTML = newComments.map(c => renderComment(c)).join('');
      formWrap.classList.add('hidden');
      btnAdd.style.display = 'inline-flex';
      document.getElementById('comment-input').value = '';
      showToast('Comentario publicado', 'success');

    } catch {
      showToast('Error al publicar comentario', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function renderComment(c) {
  return `
    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.75rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--gold-dim);border:1px solid var(--border-gold);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:0.65rem;font-weight:600;color:var(--gold);">${(c.author||'?').charAt(0).toUpperCase()}</div>
        <span style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);">${escapeHtml(c.author||'')}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;">${formatDate(c.createdAt)}</span>
      </div>
      <p style="font-size:0.9rem;color:var(--text-primary);line-height:1.5;">${escapeHtml(c.text||'')}</p>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ============================================================
   WIKI CHECK — Fase 2
   ============================================================ */

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

const HERO_FIELD_MAP = {
  element:     h => h.element,
  rarity:      h => h.rarity,
  heroClass:   h => h.heroClass,
  manaSpeed:   h => h.manaSpeed,
  family:      h => h.family,
  power:       h => h.power,
  attack:      h => h.attack,
  defense:     h => h.defense,
  health:      h => h.health,
  specialName: h => h.specialName,
  specialDesc: h => h.specialDesc,
  imageUrl:    h => h.imagePath  /* nuestro campo es imagePath, wiki devuelve imageUrl */
};

let wikiCompareData = null;
let currentHeroData = null;

/* Lanza la comprobación wiki en segundo plano */
async function wikiCheck(hero) {
  if (!Auth.canEdit()) return;
  if (!Auth.isAdmin() && hero.createdBy !== Auth.getUsername()) return;

  const seenKey = `wiki_seen_${hero.id}`;
  if (sessionStorage.getItem(seenKey)) return;

  try {
    const res = await fetch(`/api/hero-lookup?name=${encodeURIComponent(hero.name)}`);
    if (!res.ok) return;
    const wikiData = await res.json();
    if (wikiData.error) return;

    const diffs = getDiffs(hero, wikiData);
    if (diffs.length === 0) return;

    wikiCompareData = wikiData;
    currentHeroData = hero;
    showWikiAviso(hero);

  } catch { /* silencio */ }
}

/* Devuelve array de campos con diferencias */
function getDiffs(hero, wiki) {
  return Object.keys(FIELD_LABELS).filter(key => {
    const heroVal = HERO_FIELD_MAP[key](hero);
    const wikiVal = wiki[key];
    if (!wikiVal) return false; /* wiki no tiene dato → no es diff */
    if (!heroVal) return true;  /* nosotros no tenemos → diff */
    /* Para imagen: si tenemos imagen propia, no sugerir la de la wiki */
    if (key === 'imageUrl') return false;
    return String(heroVal).trim() !== String(wikiVal).trim();
  });
}

/* ---- MODAL AVISO ---- */
function showWikiAviso(hero) {
  const modal  = document.getElementById('modal-wiki-aviso');
  const nameEl = document.getElementById('wiki-aviso-name');
  const img    = document.getElementById('wiki-aviso-img');
  const noImg  = document.getElementById('wiki-aviso-noimg');

  nameEl.textContent = hero.name;

  /* Prioridad: imagen de la wiki > imagen nuestra > icono */
  const imageToShow = wikiCompareData?.imageUrl || hero.imagePath;

  if (imageToShow) {
    img.src = imageToShow;
    img.style.display = 'block';
    noImg.style.display = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      noImg.style.display = 'flex';
    };
  } else {
    img.style.display = 'none';
    noImg.style.display = 'flex';
  }

  modal.style.display = 'block';
}

document.getElementById('wiki-aviso-no').addEventListener('click', () => {
  document.getElementById('modal-wiki-aviso').style.display = 'none';
  if (currentHeroData) sessionStorage.setItem(`wiki_seen_${currentHeroData.id}`, '1');
});

document.getElementById('wiki-aviso-revisar').addEventListener('click', () => {
  document.getElementById('modal-wiki-aviso').style.display = 'none';
  showCompareTable();
});

/* ---- TABLA COMPARATIVA ---- */
function showCompareTable() {
  const modal = document.getElementById('modal-wiki-compare');
  const table = document.getElementById('compare-table');

  if (!currentHeroData || !wikiCompareData) return;

  const diffs = getDiffs(currentHeroData, wikiCompareData);
  table.innerHTML = '';

  /* Cabecera */
  table.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border-gold);">
      <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Campo</span>
      <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Nuestra ficha</span>
      <span style="font-size:0.72rem;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Wiki</span>
      <span></span>
    </div>`;

  diffs.forEach(key => {
    const heroVal = HERO_FIELD_MAP[key](currentHeroData) || '';
    const wikiVal = wikiCompareData[key] || '';
    const isEmpty = !heroVal;
    const label   = FIELD_LABELS[key];

    const row = document.createElement('div');
    row.style.cssText = `display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;padding:0.6rem 0.75rem;border-radius:var(--radius-sm);align-items:center;background:${isEmpty ? 'rgba(201,149,42,0.06)' : 'transparent'};border:1px solid ${isEmpty ? 'rgba(201,149,42,0.15)' : 'var(--border-subtle)'};`;

    /* Render especial para imagen */
    const ourCell  = key === 'imageUrl'
      ? (heroVal  ? `<img src="${heroVal}"  style="width:40px;height:50px;object-fit:cover;border-radius:4px;">` : '<span style="font-size:0.82rem;color:var(--text-muted);">— sin imagen —</span>')
      : `<span style="font-size:0.82rem;color:${isEmpty ? 'var(--text-muted)' : 'var(--text-primary)'};">${isEmpty ? '— vacío —' : escapeHtml(String(heroVal))}</span>`;

    const wikiCell = key === 'imageUrl'
      ? `<img src="${wikiVal}" style="width:40px;height:50px;object-fit:cover;border-radius:4px;">`
      : `<span style="font-size:0.82rem;color:var(--gold);">${escapeHtml(String(wikiVal))}</span>`;

    row.innerHTML = `
      <span style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);">${label}</span>
      ${ourCell}
      ${wikiCell}
      <input type="checkbox" id="chk_${key}" ${isEmpty ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;">`;

    table.appendChild(row);
  });

  if (diffs.length === 0) {
    table.innerHTML += `<p style="text-align:center;color:var(--text-muted);padding:1rem;font-size:0.9rem;">No hay diferencias entre nuestra ficha y la wiki.</p>`;
  }

  modal.style.display = 'block';
}

/* ---- APLICAR SELECCIONADOS ---- */
document.getElementById('wiki-apply-btn').addEventListener('click', async () => {
  if (!currentHeroData || !wikiCompareData) return;

  const updates = {};
  Object.keys(FIELD_LABELS).forEach(key => {
    const chk = document.getElementById(`chk_${key}`);
    if (chk && chk.checked) {
      /* imageUrl de wiki se guarda como imagePath en nuestro JSON */
      if (key === 'imageUrl') {
        updates.imagePath = wikiCompareData[key];
      } else {
        updates[key] = wikiCompareData[key];
      }
    }
  });

  if (Object.keys(updates).length === 0) {
    showToast('No hay campos seleccionados', 'info');
    return;
  }

  const btn = document.getElementById('wiki-apply-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    /* Merge con datos actuales + campos actualizados + metadata */
    const updatedHero = {
      ...currentHeroData,
      ...updates,
      wikiCheckedAt: new Date().toISOString(),
      wikiHasUpdates: false
    };

    const res = await fetch(`/api/heroes/${currentHeroData.id}`, {
      method: 'PUT',
      headers: { 'x-username': Auth.getUsername() },
      body: (() => {
        const fd = new FormData();
        fd.append('data', JSON.stringify(updatedHero));
        return fd;
      })()
    });

    if (!res.ok) throw new Error('Error al guardar');

    showToast('Ficha actualizada con datos de la wiki ✓', 'success');
    document.getElementById('modal-wiki-compare').style.display = 'none';
    sessionStorage.setItem(`wiki_seen_${currentHeroData.id}`, '1');

    /* Recargar ficha */
    setTimeout(() => window.location.reload(), 1000);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Actualizar campos seleccionados';
  }
});

document.getElementById('wiki-compare-cancel').addEventListener('click', () => {
  document.getElementById('modal-wiki-compare').style.display = 'none';
  if (currentHeroData) sessionStorage.setItem(`wiki_seen_${currentHeroData.id}`, '1');
});

/* ============================================================
   GALERÍA DE IMÁGENES ADICIONALES
   ============================================================ */

function renderAdditionalGallery(hero) {
  if (!hero.additionalImages || hero.additionalImages.length === 0) return;

  /* Buscar o crear sección */
  let section = document.getElementById('additional-gallery-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'additional-gallery-section';
    section.style.cssText = 'margin-top:2rem;';
    document.querySelector('main .container')?.appendChild(section);
  }

  section.innerHTML = `
    <div style="border-top:1px solid var(--border-gold);padding-top:1.5rem;">
      <h2 style="font-family:'Cinzel',serif;font-size:1rem;font-weight:600;color:var(--gold);margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
        <span>🖼</span> Galería
      </h2>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
        ${hero.additionalImages.map(url => `
          <img src="${url}" alt=""
            onclick="openLightbox('${url}')"
            style="width:90px;height:90px;object-fit:cover;border-radius:var(--radius-sm);cursor:pointer;border:1px solid var(--border-subtle);transition:all var(--transition);"
            onmouseover="this.style.borderColor='var(--border-gold)'"
            onmouseout="this.style.borderColor='var(--border-subtle)'">
        `).join('')}
      </div>
    </div>`;
}

function openLightbox(url) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src   = url;
  lb.style.display = 'flex';
}
