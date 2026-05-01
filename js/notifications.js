/* ============================================================
   notifications.js — Sistema de notificaciones frontend
   ============================================================ */

const Notifications = (() => {

  let _notifications = [];

  /* ---- Cargar notificaciones del usuario ---- */
  async function load() {
    const username = Auth.getUsername();
    if (!username) return;

    try {
      const res  = await fetch(`/api/notifications`, {
        headers: { 'x-username': username }
      });
      if (!res.ok) return;
      const data = await res.json();
      _notifications = data.notifications || [];
      renderBadge();
    } catch { /* silencio */ }
  }

  /* ---- Badge en la campana ---- */
  function renderBadge() {
    const badge   = document.getElementById('notif-badge');
    const unread  = _notifications.filter(n => !n.read).length;
    if (!badge) return;

    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ---- Renderizar lista de notificaciones ---- */
  function renderList(container) {
    if (!container) return;

    if (_notifications.length === 0) {
      container.innerHTML = `
        <div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">
          Sin notificaciones
        </div>`;
      return;
    }

    container.innerHTML = _notifications.map(n => renderNotifItem(n)).join('');

    /* Eventos */
    container.querySelectorAll('[data-notif-read]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        markRead(btn.dataset.notifRead);
      });
    });

    container.querySelectorAll('[data-notif-hero]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `hero-detail.html?id=${btn.dataset.notifHero}`;
      });
    });

    container.querySelectorAll('[data-notif-summary]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `notifications.html`;
      });
    });
  }

  function renderNotifItem(n) {
    const isUnread = !n.read;
    const bg = isUnread ? 'background:rgba(201,149,42,0.06);border-left:3px solid var(--gold);' : '';

    if (n.type === 'wiki_update') {
      return `
        <div style="padding:0.85rem 1rem;border-bottom:1px solid var(--border-subtle);${bg}cursor:pointer;"
             data-notif-hero="${n.heroId}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
            <div>
              <p style="font-size:0.85rem;font-weight:${isUnread ? '600' : '400'};color:var(--text-primary);">
                📖 <strong>${escapeHtml(n.heroName)}</strong> tiene datos actualizados en la wiki
              </p>
              <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">
                ${n.diffCount} campo${n.diffCount > 1 ? 's' : ''} · ${formatDate(n.createdAt)}
              </p>
            </div>
            ${isUnread ? `<button data-notif-read="${n.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;white-space:nowrap;padding:2px 6px;">✓ Leída</button>` : ''}
          </div>
        </div>`;
    }

    if (n.type === 'wiki_update_summary') {
      return `
        <div style="padding:0.85rem 1rem;border-bottom:1px solid var(--border-subtle);${bg}cursor:pointer;"
             data-notif-summary="true">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
            <div>
              <p style="font-size:0.85rem;font-weight:${isUnread ? '600' : '400'};color:var(--text-primary);">
                📋 <strong>${n.totalCount} héroes</strong> tienen datos actualizados en la wiki
              </p>
              <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">
                ${formatDate(n.createdAt)}
              </p>
            </div>
            ${isUnread ? `<button data-notif-read="${n.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;white-space:nowrap;padding:2px 6px;">✓ Leída</button>` : ''}
          </div>
        </div>`;
    }

    return '';
  }

  /* ---- Marcar como leída ---- */
  async function markRead(id) {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'x-username': Auth.getUsername() }
      });
      const n = _notifications.find(n => n.id === id);
      if (n) n.read = true;
      renderBadge();
      /* Re-renderizar si el dropdown está abierto */
      const list = document.getElementById('notif-list');
      if (list && list.closest('#notif-dropdown')?.style.display !== 'none') {
        renderList(list);
      }
    } catch { /* silencio */ }
  }

  /* ---- Marcar todas como leídas ---- */
  async function markAllRead() {
    const unread = _notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => markRead(n.id)));
  }

  function getAll()    { return _notifications; }
  function getUnread() { return _notifications.filter(n => !n.read); }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { load, renderBadge, renderList, markRead, markAllRead, getAll, getUnread };

})();
