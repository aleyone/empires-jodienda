/* ============================================================
   auth.js — Gestión de sesión y roles
   ============================================================ */

const Auth = (() => {

  const SESSION_KEY = 'mk_session';

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: user.username,
      role:     user.role,
      email:    user.email || ''
    }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() { return !!getSession(); }
  function getRole()     { return getSession()?.role || null; }
  function getUsername() { return getSession()?.username || null; }
  function isAdmin()     { return getRole() === 'admin'; }
  function isEditor()    { return getRole() === 'editor' || isAdmin(); }
  function canEdit()     { return isEditor(); }

  /* Redirige al login guardando la URL actual como returnUrl */
  function requireAuth() {
    if (!isLoggedIn()) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `login.html?returnUrl=${returnUrl}`;
      return false;
    }
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
  }

  return {
    getSession, setSession, clearSession,
    isLoggedIn, getRole, getUsername,
    isAdmin, isEditor, canEdit,
    requireAuth, requireAdmin, requireEditor,
    initNavbar
  };

})();
