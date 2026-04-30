/* ============================================================
   auth.js — Gestión de sesión (sessionStorage) y roles
   ============================================================ */

const Auth = (() => {

  const SESSION_KEY = 'mk_session';

  /* Obtiene la sesión actual del sessionStorage */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* Guarda la sesión */
  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      username: user.username,
      role:     user.role,
      email:    user.email || ''
    }));
  }

  /* Borra la sesión */
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ¿Está autenticado? */
  function isLoggedIn() {
    return !!getSession();
  }

  /* Rol actual */
  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  /* Username actual */
  function getUsername() {
    const s = getSession();
    return s ? s.username : null;
  }

  /* Comprobaciones de rol */
  function isAdmin()    { return getRole() === 'admin'; }
  function isEditor()   { return getRole() === 'editor' || isAdmin(); }
  function canEdit()    { return isEditor(); }

  /* Redirige al login si no hay sesión. Llama al inicio de cada página protegida */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  /* Solo admins — si no es admin, redirige al inicio */
  function requireAdmin() {
    if (!requireAuth()) return false;
    if (!isAdmin()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  /* Solo editores o admins */
  function requireEditor() {
    if (!requireAuth()) return false;
    if (!canEdit()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  /* Inicializa la navbar con datos del usuario */
  function initNavbar() {
    const session = getSession();
    if (!session) return;

    const avatar   = document.getElementById('nav-avatar');
    const username = document.getElementById('nav-username');
    const menuBtn  = document.getElementById('nav-menu-btn');
    const menu     = document.getElementById('navbar-menu');
    const menuAdmin = document.getElementById('menu-admin');
    const btnAdd   = document.getElementById('btn-add-hero');
    const btnLogout = document.getElementById('btn-logout');

    if (avatar)   avatar.textContent = session.username.charAt(0).toUpperCase();
    if (username) username.textContent = session.username;

    if (menuAdmin && isAdmin()) menuAdmin.style.display = 'block';
    if (btnAdd && canEdit())    btnAdd.style.display = 'inline-flex';

    /* Toggle menú */
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', () => menu.classList.remove('open'));
    }

    /* Logout */
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
