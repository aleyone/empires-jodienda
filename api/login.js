/* api/login.js — Autenticación */

const { readUsers, hashPassword } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const result = await readUsers();
    console.log('[login] readUsers result type:', typeof result);
    console.log('[login] readUsers result keys:', result ? Object.keys(result) : 'null');

    /* readUsers() devuelve { users: [...], sha: '...' } */
    const users = Array.isArray(result) ? result : (result.users || []);
    console.log('[login] users is array:', Array.isArray(users), 'length:', users.length);

    const user = users.find(u => u.username === username.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const hash = await hashPassword(password);
    if (user.passwordHash !== hash) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const safeUser = {
      username: user.username,
      role:     user.role,
      email:    user.email || ''
    };

    if (user.firstLogin) {
      return res.status(200).json({ firstLogin: true, user: safeUser });
    }

    return res.status(200).json({ firstLogin: false, user: safeUser });

  } catch (err) {
    console.error('[login.js] ERROR:', err.message);
    console.error('[login.js] STACK:', err.stack);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
};
