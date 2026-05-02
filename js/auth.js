/* ============================================================
   auth.js — Gestión de sesión y roles
   Sesión persiste mientras el navegador esté abierto.
   Se destruye al hacer logout o al cerrar el navegador.
   ============================================================ */

const Auth = (() => {

  const SESSION_KEY = 'mk_session';

  /* Usamos sessionStorage (muere al cerrar pestaña/navegador)
     pero lo sincronizamos con localStorage para que sobreviva
     entre pestañas del mismo navegador mientras esté abierto */
  function getSession() {
    try {
      /* Intentar sessionStorage primero */
      let raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        /* Recuperar de localStorage si hay sesión activa en otra pestaña */
        raw = localStorage.getItem(SESSION_KEY);
        if (raw) sessionStorage.setItem(SESSION_KEY, raw);
      }
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(user) {
    const data = JSON.stringify({
      username:        user.username,
      role:            user.role,
      email:           user.email || '',
      lastSeenVersion: user.lastSeenVersion || null,
      allianceName:    user.allianceName || ''
    });
    sessionStorage.setItem(SESSION_KEY, data);
    localStorage.setItem(SESSION_KEY, data);

    /* Registrar que hay una sesión activa en esta pestaña */
    _registerTab();
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('mk_tabs');
  }

  /* ---- Control de pestañas abiertas ---- */
  function _registerTab() {
    const tabId = sessionStorage.getItem('mk_tab_id') || Math.random().toString(36).slice(2);
    sessionStorage.setItem('mk_tab_id', tabId);
    const tabs = JSON.parse(localStorage.getItem('mk_tabs') || '[]');
    if (!tabs.includes(tabId)) tabs.push(tabId);
    localStorage.setItem('mk_tabs', JSON.stringify(tabs));
  }

  function _unregisterTab() {
    const tabId = sessionStorage.getItem('mk_tab_id');
    if (!tabId) return;
    let tabs = JSON.parse(localStorage.getItem('mk_tabs') || '[]');
    tabs = tabs.filter(t => t !== tabId);
    localStorage.setItem('mk_tabs', JSON.stringify(tabs));
    /* Si no quedan pestañas abiertas, destruir la sesión */
    if (tabs.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('mk_tabs');
    }
  }

  /* Limpiar sesión al cerrar la pestaña */
  window.addEventListener('beforeunload', _unregisterTab);

  /* ---- API pública ---- */
  function isLoggedIn() { return !!getSession(); }
  function getRole()     { return getSession()?.role || null; }
  function getUsername() { return getSession()?.username || null; }
  function isAdmin()     { return getRole() === 'admin'; }
  function isEditor()    { return getRole() === 'editor' || isAdmin(); }
  function canEdit()     { return isEditor(); }

  function requireAuth() {
    if (!isLoggedIn()) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login.html?returnUrl=${returnUrl}`;
      return false;
    }
    _registerTab();
    return true;
  }

  function requireAdmin() {
    if (!requireAuth()) return false;
    if (!isAdmin()) { window.location.href = 'index.html'; return false; }
    return true;
  }

  function requireEditor() {
    if (!requireAuth()) return false;
    if (!canEdit()) { window.location.href = 'index.html'; return false; }
    return true;
  }

  function initNavbar() {
    const session = getSession();
    if (!session) return;

    const avatar    = document.getElementById('nav-avatar');
    const username  = document.getElementById('nav-username');
    const menuBtn   = document.getElementById('nav-menu-btn');
    const menu      = document.getElementById('navbar-menu');
    const menuAdmin = document.getElementById('menu-admin');
    const btnAdd    = document.getElementById('btn-add-hero');
    const btnLogout = document.getElementById('btn-logout');

    if (avatar)   avatar.textContent = session.username.charAt(0).toUpperCase();
    if (username) username.textContent = session.username;
    if (menuAdmin && isAdmin()) menuAdmin.style.display = 'block';
    if (btnAdd && canEdit())    btnAdd.style.display = 'inline-flex';

    const menuMyTeam = document.getElementById('menu-my-team');
    if (menuMyTeam && canEdit()) menuMyTeam.style.display = '';

    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', () => menu.classList.remove('open'));
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        clearSession();
        window.location.href = 'login.html';
      });
    }

    /* ---- Campana de notificaciones ---- */
    const notifBtn      = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifMarkAll  = document.getElementById('notif-mark-all');

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.classList.contains('open');
        notifDropdown.classList.toggle('open');
        if (!isOpen && typeof Notifications !== 'undefined') {
          Notifications.renderList(document.getElementById('notif-list'));
        }
      });
      document.addEventListener('click', () => notifDropdown.classList.remove('open'));
    }

    if (notifMarkAll) {
      notifMarkAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (typeof Notifications !== 'undefined') {
          await Notifications.markAllRead();
          Notifications.renderList(document.getElementById('notif-list'));
        }
      });
    }

    /* Cargar notificaciones al iniciar */
    if (typeof Notifications !== 'undefined') {
      Notifications.load();
    }
  }

  return {
    getSession, setSession, clearSession,
    isLoggedIn, getRole, getUsername,
    isAdmin, isEditor, canEdit,
    requireAuth, requireAdmin, requireEditor,
    initNavbar
  };

})();
