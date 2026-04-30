/* api/users.js — Gestión de usuarios
   Rutas:
     GET    /api/users                     → lista (solo admin)
     POST   /api/users                     → crear usuario (solo admin)
     PUT    /api/users?username=xxx        → editar usuario (solo admin)
     DELETE /api/users?username=xxx        → eliminar (solo admin)
     POST   /api/users/first-login         → cambiar pass + email primer acceso
     POST   /api/users/reset-password      → admin resetea contraseña
     POST   /api/users/forgot-password     → solicitar reset por email
*/

const { readUsers, writeUsers, checkRole, hashPassword } = require('./_helpers');
const emailjs = require('./_emailjs');

module.exports = async (req, res) => {
  const { username } = req.query;
  const url = req.url || '';

  try {

    /* ---- Rutas especiales ---- */
    if (url.includes('/first-login') || (req.method === 'POST' && req.body?.action === 'first-login')) {
      return handleFirstLogin(req, res);
    }
    if (url.includes('/reset-password') || (req.method === 'POST' && req.body?.action === 'reset-password')) {
      return handleResetPassword(req, res);
    }
    if (url.includes('/forgot-password') || (req.method === 'POST' && req.body?.action === 'forgot-password')) {
      return handleForgotPassword(req, res);
    }

    /* ---- CRUD usuarios (solo admin) ---- */
    if (!(await checkRole(req, 'admin'))) {
      return res.status(403).json({ error: 'Sin permisos de administrador' });
    }

    switch (req.method) {

      case 'GET': {
        const { users } = await readUsers();
        const safe = users.map(u => ({
          username:   u.username,
          email:      u.email || '',
          role:       u.role,
          firstLogin: u.firstLogin || false,
          createdAt:  u.createdAt
        }));
        return res.status(200).json({ users: safe });
      }

      case 'POST': {
        const { username: newUser, email, role, password } = req.body || {};
        if (!newUser || !password || !role) {
          return res.status(400).json({ error: 'Faltan datos obligatorios' });
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
        const idx = users.findIndex(u => u.username === username);
        if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (newName && newName !== username) {
          if (users.find(u => u.username === newName)) {
            return res.status(409).json({ error: 'El nombre ya está en uso' });
          }
          users[idx].username = newName.toLowerCase();
        }
        if (email !== undefined) users[idx].email = email;
        if (role)  users[idx].role = role;
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
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};

/* ---- Primer acceso: guardar email + nueva contraseña ---- */
async function handleFirstLogin(req, res) {
  const { username, email, newPassword } = req.body || {};
  if (!username || !email || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Contraseña demasiado corta' });
  }
  const { users, sha } = await readUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  users[idx].email        = email;
  users[idx].passwordHash = await hashPassword(newPassword);
  users[idx].firstLogin   = false;

  await writeUsers(users, sha, `first login: ${username}`);
  return res.status(200).json({ ok: true });
}

/* ---- Admin resetea contraseña de un usuario ---- */
async function handleResetPassword(req, res) {
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
  users[idx].firstLogin   = true; /* Le obliga a cambiarla */

  await writeUsers(users, sha, `reset password: ${targetUsername}`);
  return res.status(200).json({ ok: true });
}

/* ---- Olvidé contraseña: envía email ---- */
async function handleForgotPassword(req, res) {
  const { username } = req.body || {};
  /* Siempre respondemos OK para no revelar si el usuario existe */
  if (!username) return res.status(200).json({ ok: true });

  try {
    const { users } = await readUsers();
    const user = users.find(u => u.username === username.toLowerCase());
    if (user && user.email) {
      /* Generamos token temporal (en producción usaría Redis/DB, aquí es simple) */
      const token = require('crypto').randomBytes(20).toString('hex');
      const resetUrl = `${process.env.APP_URL || ''}/reset-password.html?token=${token}&user=${username}`;
      await emailjs.sendResetEmail(user.email, user.username, resetUrl);
    }
  } catch (e) {
    console.error('Forgot password error:', e);
  }

  return res.status(200).json({ ok: true });
}
