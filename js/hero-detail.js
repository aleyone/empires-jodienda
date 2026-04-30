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
