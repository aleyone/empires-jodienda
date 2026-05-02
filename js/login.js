/* ============================================================
   login.js — Lógica de la página de login
   ============================================================ */

/* Si ya hay sesión, redirigir — respetando returnUrl si existe */
if (Auth.isLoggedIn()) {
  const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
  window.location.href = returnUrl || 'index.html';
}

/* ---- Mostrar/ocultar contraseña ---- */
document.getElementById('toggle-pass').addEventListener('click', () => {
  const inp = document.getElementById('password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

/* ---- FORM LOGIN ---- */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const usernameOrEmail = document.getElementById('username').value.trim().toLowerCase();
  const password        = document.getElementById('password').value;
  const btn             = document.getElementById('login-btn');

  if (!usernameOrEmail) return showFieldError('err-username', 'Introduce tu usuario o email');
  if (!password)        return showFieldError('err-password', 'Introduce tu contraseña');

  btn.disabled    = true;
  btn.textContent = 'Verificando...';

  try {
    const res = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usernameOrEmail, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showGlobalError(data.error || 'Usuario o contraseña incorrectos');
      return;
    }

    if (data.firstLogin) {
      sessionStorage.setItem('mk_pending_user', JSON.stringify(data.user));
      openModal('modal-first-login');
    } else {
      Auth.setSession(data.user);
      /* Redirigir a la URL de origen si existe */
      const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
      window.location.href = returnUrl ? decodeURIComponent(returnUrl) : 'index.html';
    }

  } catch (err) {
    showGlobalError('Error de conexión. Inténtalo de nuevo.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Entrar al reino';
  }
});

/* ---- MODAL: Primer acceso ---- */
document.getElementById('first-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email   = document.getElementById('fl-email').value.trim();
  const newpass = document.getElementById('fl-newpass').value;
  const confirm = document.getElementById('fl-confirm').value;
  const pending = JSON.parse(sessionStorage.getItem('mk_pending_user') || 'null');

  const privacy = document.getElementById('fl-privacy')?.checked;
  if (!privacy) return showFieldError('err-fl-privacy', 'Debes aceptar el aviso de privacidad para continuar');

  if (!email)   return showFieldError('err-fl-email', 'El email es obligatorio');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                return showFieldError('err-fl-email', 'Email no válido');
  if (!newpass) return showFieldError('err-fl-newpass', 'Introduce una contraseña');
  if (newpass.length < 6) return showFieldError('err-fl-newpass', 'Mínimo 6 caracteres');
  if (newpass !== confirm) return showFieldError('err-fl-confirm', 'Las contraseñas no coinciden');
  if (!pending) return showGlobalError('Sesión expirada, vuelve a iniciar sesión');

  try {
    const res = await fetch('/api/users/first-login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: pending.username, email, newPassword: newpass })
    });

    const data = await res.json();
    if (!res.ok) return showGlobalError(data.error || 'Error al guardar');

    sessionStorage.removeItem('mk_pending_user');
    Auth.setSession({ ...pending, email });

    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
    window.location.href = returnUrl ? decodeURIComponent(returnUrl) : 'index.html';

  } catch {
    showGlobalError('Error de conexión.');
  }
});

/* ---- Olvidé contraseña ---- */
document.getElementById('forgot-link').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('modal-forgot');
});

document.getElementById('close-forgot').addEventListener('click', () => closeModal('modal-forgot'));

document.getElementById('forgot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('forgot-username').value.trim().toLowerCase();
  if (!usernameOrEmail) return showFieldError('err-forgot', 'Introduce tu usuario o email');

  try {
    await fetch('/api/users/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usernameOrEmail })
    });
    document.getElementById('forgot-ok').classList.remove('hidden');
    document.getElementById('forgot-form').classList.add('hidden');
  } catch {
    showFieldError('err-forgot', 'Error de conexión.');
  }
});

/* ---- Helpers ---- */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function showGlobalError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => {
    e.textContent = ''; e.classList.remove('visible');
  });
  const ge = document.getElementById('login-error');
  if (ge) ge.style.display = 'none';
}
