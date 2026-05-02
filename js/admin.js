/* ============================================================
   admin.js — Gestión de usuarios (solo admins)
   ============================================================ */

Auth.requireAdmin();

let usersData = [];
let deleteTarget = null;

/* ---- CARGA USUARIOS ---- */
async function loadUsers() {
  try {
    const res = await fetch('/api/users', {
      headers: { 'x-username': Auth.getUsername() }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    usersData = data.users || [];
    renderUsers();
  } catch {
    showToast('Error al cargar usuarios', 'error');
  }
}

/* ---- RENDER TABLA ---- */
function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  const ROLE_LABELS = { admin: '👑 Admin', editor: '✏️ Editor', consultant: '👁 Consultor' };

  tbody.innerHTML = usersData.map(u => `
    <tr style="border-bottom:1px solid var(--border-subtle);">
      <td style="padding:0.75rem;font-weight:600;font-size:0.9rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <div class="user-avatar" style="width:28px;height:28px;font-size:0.7rem;">${(u.username.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/) || ['?'])[0].toUpperCase()}</div>
          ${u.username}
        </div>
      </td>
      <td style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);">${u.email || '<span style="color:var(--text-muted)">Sin email</span>'}</td>
      <td style="padding:0.75rem;font-size:0.85rem;">${ROLE_LABELS[u.role] || u.role}</td>
      <td style="padding:0.75rem;font-size:0.82rem;">
        ${u.firstLogin
          ? '<span style="color:#f0c040;">⏳ Pendiente primer acceso</span>'
          : '<span style="color:#70d470;">✓ Activo</span>'}
      </td>
      <td style="padding:0.75rem;text-align:right;">
        <div style="display:flex;gap:0.4rem;justify-content:flex-end;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openEditUser('${u.username}')">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="openResetPass('${u.username}')">🔑 Pass</button>
          ${u.username !== Auth.getUsername()
            ? `<button class="btn btn-danger btn-sm" onclick="openDeleteUser('${u.username}')">🗑</button>`
            : ''}
        </div>
      </td>
    </tr>`).join('');
}

/* ---- NUEVO USUARIO ---- */
document.getElementById('btn-new-user').addEventListener('click', () => {
  clearUserForm();
  document.getElementById('modal-user-title').textContent = 'Nuevo usuario';
  document.getElementById('pass-group').style.display = 'block';
  document.getElementById('edit-username-original').value = '';
  openModal('modal-user');
});

/* ---- EDITAR USUARIO ---- */
window.openEditUser = (username) => {
  const u = usersData.find(x => x.username === username);
  if (!u) return;
  clearUserForm();
  document.getElementById('modal-user-title').textContent = 'Editar usuario';
  document.getElementById('u-username').value = u.username;
  document.getElementById('u-email').value    = u.email || '';
  document.getElementById('u-role').value     = u.role;
  document.getElementById('pass-group').style.display = 'none';
  document.getElementById('edit-username-original').value = u.username;
  openModal('modal-user');
};

/* ---- RESET CONTRASEÑA ---- */
window.openResetPass = (username) => {
  document.getElementById('reset-target-user').value = username;
  document.getElementById('reset-username-label').textContent = username;
  document.getElementById('new-pass-admin').value = '';
  openModal('modal-reset-pass');
};

document.getElementById('reset-pass-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reset-target-user').value;
  const newPass  = document.getElementById('new-pass-admin').value;
  if (newPass.length < 6) {
    return showFieldError('err-new-pass-admin', 'Mínimo 6 caracteres');
  }
  try {
    const res = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-username': Auth.getUsername() },
      body: JSON.stringify({ targetUsername: username, newPassword: newPass })
    });
    if (!res.ok) throw new Error();
    showToast('Contraseña restablecida', 'success');
    closeModal('modal-reset-pass');
    loadUsers();
  } catch {
    showToast('Error al restablecer contraseña', 'error');
  }
});

/* ---- ELIMINAR USUARIO ---- */
window.openDeleteUser = (username) => {
  deleteTarget = username;
  document.getElementById('delete-username-label').textContent = username;
  openModal('modal-delete-user');
};

document.getElementById('confirm-delete-user').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`/api/users/${deleteTarget}`, {
      method: 'DELETE',
      headers: { 'x-username': Auth.getUsername() }
    });
    if (!res.ok) throw new Error();
    showToast('Usuario eliminado', 'success');
    closeModal('modal-delete-user');
    loadUsers();
  } catch {
    showToast('Error al eliminar usuario', 'error');
  }
});

document.getElementById('cancel-delete-user').addEventListener('click', () => closeModal('modal-delete-user'));

/* ---- FORM GUARDAR USUARIO ---- */
document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const originalUsername = document.getElementById('edit-username-original').value;
  const isNewUser = !originalUsername;

  const username = document.getElementById('u-username').value.trim();
  const email    = document.getElementById('u-email').value.trim();
  const role     = document.getElementById('u-role').value;
  const password = document.getElementById('u-password').value;

  if (!username) return showFieldError('err-u-username', 'El nombre de usuario es obligatorio');
  if (!username) return showFieldError('err-u-username', 'El nombre no puede estar vacío');
  if (isNewUser && password.length < 6) return showFieldError('err-u-password', 'Mínimo 6 caracteres');

  try {
    const endpoint = isNewUser ? '/api/users' : `/api/users/${originalUsername}`;
    const method   = isNewUser ? 'POST' : 'PUT';
    const body     = isNewUser
      ? { username, email, role, password }
      : { username, email, role };

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-username': Auth.getUsername() },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return showToast(err.error || 'Error al guardar usuario', 'error');
    }

    showToast(isNewUser ? 'Usuario creado' : 'Usuario actualizado', 'success');
    closeModal('modal-user');
    loadUsers();
  } catch {
    showToast('Error de conexión', 'error');
  }
});

/* ---- CERRAR MODALES ---- */
document.getElementById('close-modal-user').addEventListener('click',  () => closeModal('modal-user'));
document.getElementById('cancel-user-modal').addEventListener('click', () => closeModal('modal-user'));
document.getElementById('close-reset-pass').addEventListener('click',  () => closeModal('modal-reset-pass'));

/* ---- HELPERS ---- */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function clearUserForm() {
  document.getElementById('u-username').value = '';
  document.getElementById('u-email').value    = '';
  document.getElementById('u-role').value     = 'consultant';
  document.getElementById('u-password').value = '';
  clearErrors();
}
function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.remove('visible'); });
}
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

/* ---- INIT ---- */
loadUsers();
