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
      body:    JSON.stringify({
        username:       pending.username,
        email,
        newPassword:    newpass,
        warParticipant: document.getElementById('fl-war')?.checked || false
      })
    });

    const data = await res.json();
    if (!res.ok) return showGlobalError(data.error || 'Error al guardar');

    sessionStorage.removeItem('mk_pending_user');
    Auth.setSession({ ...pending, email });

    /* Mensaje de bienvenida en el chat */
    try {
      if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('chat/messages').push({
          username:  'Mini Kripta',
          text:      `⚔ ¡${pending.username} se ha unido a Mini Kripta! ¡Bienvenido/a!`,
          timestamp: Date.now(),
          system:    true
        });
      }
    } catch { /* silencio */ }

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

/* ============================================================
   REGISTRO DE NUEVO USUARIO
   ============================================================ */

document.getElementById('register-link').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('modal-register').style.display = 'flex';
});

document.getElementById('close-register').addEventListener('click', () => {
  document.getElementById('modal-register').style.display = 'none';
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  /* Limpiar errores */
  ['reg-username','reg-email','reg-password','reg-confirm','reg-code','reg-privacy'].forEach(id => {
    const el = document.getElementById(`err-${id}`);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });

  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const code     = document.getElementById('reg-code').value.trim();
  const privacy  = document.getElementById('reg-privacy').checked;

  /* Validaciones frontend */
  if (!username || username.length < 2)
    return showFieldError('err-reg-username', 'El nombre es obligatorio (mínimo 2 caracteres)');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showFieldError('err-reg-email', 'Email no válido');
  if (!password || password.length < 6)
    return showFieldError('err-reg-password', 'Mínimo 6 caracteres');
  if (password !== confirm)
    return showFieldError('err-reg-confirm', 'Las contraseñas no coinciden');
  if (!code)
    return showFieldError('err-reg-code', 'El código de alianza es obligatorio');
  if (!privacy)
    return showFieldError('err-reg-privacy', 'Debes aceptar el aviso de privacidad');

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled    = true;
  btn.textContent = 'Creando cuenta...';

  try {
    const res = await fetch('/api/users/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, email, password, allianceCode: code })
    });

    const data = await res.json();

    if (!res.ok) {
      /* Mostrar error en el campo correspondiente */
      if (data.error.includes('usuario'))  return showFieldError('err-reg-username', data.error);
      if (data.error.includes('email'))    return showFieldError('err-reg-email', data.error);
      if (data.error.includes('contraseña')) return showFieldError('err-reg-password', data.error);
      if (data.error.includes('Código'))   return showFieldError('err-reg-code', data.error);
      return showFieldError('err-reg-code', data.error);
    }

    /* Éxito */
    document.getElementById('modal-register').style.display = 'none';
    document.getElementById('register-form').reset();

    /* Mensaje de bienvenida en el chat */
    try {
      if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        firebase.database().ref('chat/messages').push({
          username:  'Mini Kripta',
          text:      `⚔ ¡${username} se ha unido a Mini Kripta! ¡Bienvenido/a!`,
          timestamp: Date.now(),
          system:    true
        });
      }
    } catch { /* silencio si Firebase no está listo */ }

    /* Rellenar login con el username para facilitar el acceso */
    document.getElementById('username').value = username;
    alert(`¡Cuenta creada! Ya puedes entrar con tu usuario "${username}" y tu contraseña.`);

  } catch {
    showFieldError('err-reg-code', 'Error de conexión. Inténtalo de nuevo.');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Crear cuenta';
  }
});

/* ---- ACCESO COMO INVITADO ---- */
document.getElementById('guest-btn').addEventListener('click', () => {
  Auth.setGuestSession();
  window.location.href = 'index.html';
});
