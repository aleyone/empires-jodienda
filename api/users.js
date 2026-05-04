/* api/users.js — Gestión de usuarios
   Rutas (detectadas por req.url):
     GET    /api/users                     → lista (solo admin)
     POST   /api/users                     → crear usuario (solo admin)
     PUT    /api/users?username=xxx        → editar usuario (solo admin)
     DELETE /api/users?username=xxx        → eliminar (solo admin)
     POST   /api/users/first-login         → cambiar pass + email primer acceso
     POST   /api/users/change-password     → usuario cambia su propia contraseña
     POST   /api/users/reset-password      → admin resetea contraseña
     POST   /api/users/forgot-password     → solicitar reset por email
*/

const { readUsers, writeUsers, checkRole, hashPassword } = require('./_helpers');
const emailjs = require('./_emailjs');

module.exports = async (req, res) => {
  /* Cabeceras CORS por si acaso */
  res.setHeader('Content-Type', 'application/json');

  const url      = (req.url || '').split('?')[0]; /* sin query string */
  const { username } = req.query;

  try {

    /* ---- Ruta de registro público ---- */
    if (url.endsWith('/register')) {
      const { username, email, password, allianceCode } = req.body || {};

      if (!username || username.trim().length < 2)
        return res.status(400).json({ error: 'El nombre de usuario es obligatorio (mínimo 2 caracteres)' });
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: 'Email no válido' });
      if (!password || password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      if (!allianceCode || allianceCode.trim() !== process.env.ALLIANCE_CODE)
        return res.status(401).json({ error: 'Código de alianza incorrecto' });

      const { users, sha } = await readUsers();
      const exists = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
      if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
      const emailExists = users.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
      if (emailExists) return res.status(409).json({ error: 'Ese email ya está registrado' });

      users.push({
        username:     username.trim(),
        passwordHash: hashPassword(password),
        email:        email.trim().toLowerCase(),
        role:         'editor',
        firstLogin:   false,
        createdAt:    new Date().toISOString()
      });
      await writeUsers(users, sha, `register user: ${username.trim()}`);
      return res.status(201).json({ ok: true });
    }

    /* ---- Rutas especiales (no requieren admin) ---- */
    if (url.endsWith('/first-login')) {
      return handleFirstLogin(req, res);
    }
    if (url.endsWith('/change-password')) {
      return handleChangePassword(req, res);
    }
    if (url.endsWith('/forgot-password')) {
      return handleForgotPassword(req, res);
    }

    /* ---- Reset password (requiere admin) ---- */
    if (url.endsWith('/reset-password')) {
      return handleResetPassword(req, res);
    }
    if (url.endsWith('/reset-password-token')) {
      return handleResetPasswordToken(req, res);
    }

    /* ---- CRUD usuarios ---- */
    /* PUT: admin puede editar cualquiera, usuario puede editar su propio perfil */
    const callerUsernameCheck = req.headers['x-username'];
    const targetUsernameCheck = req.query.username;
    const isAdmin = await checkRole(req, 'admin');
    const isOwnProfile = callerUsernameCheck && targetUsernameCheck &&
      callerUsernameCheck.toLowerCase() === targetUsernameCheck.toLowerCase();

    if (req.method === 'PUT' && isOwnProfile) {
      /* Permitir — el usuario edita su propio perfil */
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Sin permisos de administrador' });
    }

    switch (req.method) {

      case 'GET': {
        const { users } = await readUsers();
        const safe = users.map(u => ({
          username:     u.username,
          email:        u.email || '',
          role:         u.role,
          firstLogin:   u.firstLogin || false,
          createdAt:    u.createdAt,
          allianceName:   u.allianceName || '',
          warParticipant: u.warParticipant || false
        }));
        return res.status(200).json({ users: safe });
      }

      case 'POST': {
        const { username: newUser, email, role, password } = req.body || {};
        if (!newUser || !password || !role) {
          return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }
        if (!/^[a-z0-9_]+$/i.test(newUser)) {
          return res.status(400).json({ error: 'Nombre de usuario no válido' });
        }
        const { users, sha } = await readUsers();
        if (users.find(u => u.username === newUser.toLowerCase())) {
          return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        const hash = await hashPassword(password);
        users.push({
          username:     newUser.toLowerCase(),
          passwordHash: hash,
          email:        email || '',
          role,
          firstLogin:   true,
          createdAt:    new Date().toISOString()
        });
        await writeUsers(users, sha, `add user: ${newUser}`);
        return res.status(201).json({ ok: true });
      }

      case 'PUT': {
        if (!username) return res.status(400).json({ error: 'username requerido' });
        const { username: newName, email, role } = req.body || {};
        const { users, sha } = await readUsers();
        const idx = users.findIndex(u => u.username.toLowerCase() === (username||'').toLowerCase());
        if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (newName && newName !== users[idx].username) {
          /* Comprobar duplicado case-insensitive pero excluyendo el propio usuario */
          const duplicate = users.find((u, i) => i !== idx && u.username.toLowerCase() === newName.toLowerCase());
          if (duplicate) {
            return res.status(409).json({ error: 'El nombre ya está en uso' });
          }
          users[idx].username = newName; /* Guardar respetando mayúsculas */
        }
        if (email !== undefined) users[idx].email = email;
        if (req.body.allianceName !== undefined) users[idx].allianceName = req.body.allianceName;
        if (req.body.warParticipant !== undefined) users[idx].warParticipant = req.body.warParticipant;
        if (role) users[idx].role = role;
        await writeUsers(users, sha, `update user: ${username}`);
        return res.status(200).json({ ok: true });
      }

      case 'DELETE': {
        if (!username) return res.status(400).json({ error: 'username requerido' });
        const callerUsername = req.headers['x-username'];
        if (username === callerUsername) {
          return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }
        const { users, sha } = await readUsers();
        const filtered = users.filter(u => u.username !== username);
        if (filtered.length === users.length) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        await writeUsers(filtered, sha, `delete user: ${username}`);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (err) {
    console.error('[users.js]', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};

/* ---- Primer acceso: guardar email + nueva contraseña ---- */
async function handleFirstLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, email, newPassword } = req.body || {};
  if (!username || !email || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email no válido' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Contraseña demasiado corta' });
  }
  const { users, sha } = await readUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  users[idx].email          = email;
  users[idx].passwordHash   = await hashPassword(newPassword);
  users[idx].firstLogin     = false;
  if (req.body.warParticipant !== undefined) {
    users[idx].warParticipant = req.body.warParticipant;
  }

  await writeUsers(users, sha, `first login: ${users[idx].username}`);
  return res.status(200).json({ ok: true });
}

/* ---- Usuario cambia su propia contraseña ---- */
async function handleChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const callerUsername = req.headers['x-username'];
  if (!callerUsername) return res.status(401).json({ error: 'No autenticado' });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const { users, sha } = await readUsers();
  const idx = users.findIndex(u => u.username === callerUsername);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  const currentHash = await hashPassword(currentPassword);
  if (users[idx].passwordHash !== currentHash) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }

  users[idx].passwordHash = await hashPassword(newPassword);
  await writeUsers(users, sha, `change password: ${callerUsername}`);
  return res.status(200).json({ ok: true });
}

/* ---- Admin resetea contraseña de un usuario ---- */
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await checkRole(req, 'admin'))) {
    return res.status(403).json({ error: 'Sin permisos' });
  }
  const { targetUsername, newPassword } = req.body || {};
  if (!targetUsername || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Datos incorrectos' });
  }
  const { users, sha } = await readUsers();
  const idx = users.findIndex(u => u.username === targetUsername);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  users[idx].passwordHash = await hashPassword(newPassword);
  users[idx].firstLogin   = true; /* Le obliga a cambiarla en el próximo acceso */

  await writeUsers(users, sha, `reset password: ${targetUsername}`);
  return res.status(200).json({ ok: true });
}

/* ---- Olvidé contraseña: envía email ---- */
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { usernameOrEmail } = req.body || {};
  if (!usernameOrEmail) return res.status(200).json({ ok: true });

  try {
    const { users } = await readUsers();
    const input = usernameOrEmail.toLowerCase().trim();
    /* Buscar por username O por email */
    const user = users.find(u =>
      u.username === input ||
      (u.email && u.email.toLowerCase() === input)
    );
    if (user && user.email) {
      const token    = require('crypto').randomBytes(20).toString('hex');
      const resetUrl = `${process.env.APP_URL || ''}/reset-password.html?token=${token}&user=${encodeURIComponent(user.username)}`;
      /* Guardar token en users.json para validarlo después */
      const { users: allUsers, sha } = await readUsers();
      const uidx = allUsers.findIndex(u => u.username === user.username);
      if (uidx !== -1) {
        allUsers[uidx].resetToken   = token;
        allUsers[uidx].resetTokenAt = Date.now();
        await writeUsers(allUsers, sha, `forgot password: ${user.username}`);
      }
      await emailjs.sendResetEmail(user.email, user.username, resetUrl);
    }
  } catch (e) {
    console.error('Forgot password error:', e);
  }

  return res.status(200).json({ ok: true });
}

/* ---- Reset contraseña por token (desde email) ---- */
async function handleResetPasswordToken(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, token, newPassword } = req.body || {};

  if (!username || !token || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Contraseña demasiado corta' });
  }

  const { users, sha } = await readUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === (username||'').toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  const user = users[idx];

  /* Validar token y que no haya caducado (1 hora) */
  if (!user.resetToken || user.resetToken !== token) {
    return res.status(400).json({ error: 'Token no válido' });
  }
  const tokenAge = Date.now() - (user.resetTokenAt || 0);
  if (tokenAge > 3600000) {
    return res.status(400).json({ error: 'El enlace ha caducado. Solicita uno nuevo.' });
  }

  users[idx].passwordHash  = await hashPassword(newPassword);
  users[idx].firstLogin    = false;
  users[idx].resetToken    = null;
  users[idx].resetTokenAt  = null;

  await writeUsers(users, sha, `reset password token: ${username}`);
  return res.status(200).json({ ok: true });
}
