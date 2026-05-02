/* api/login.js — Autenticación con usuario o email */

const { readUsers, hashPassword } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { usernameOrEmail, password } = req.body || {};

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Usuario/email y contraseña requeridos' });
  }

  try {
    const { users } = await readUsers();
    const input = usernameOrEmail.trim();
    const inputLower = input.toLowerCase();

    /* Buscar por username (case-insensitive) O por email */
    const user = users.find(u =>
      u.username.toLowerCase() === inputLower ||
      (u.email && u.email.toLowerCase() === inputLower)
    );

    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const hash = await hashPassword(password);
    if (user.passwordHash !== hash) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const safeUser = {
      username:        user.username,
      role:            user.role,
      email:           user.email || '',
      lastSeenVersion: user.lastSeenVersion || null,
      allianceName:    user.allianceName || '',
      warParticipant:  user.warParticipant || false
    };

    if (user.firstLogin) {
      return res.status(200).json({ firstLogin: true, user: safeUser });
    }

    return res.status(200).json({ firstLogin: false, user: safeUser });

  } catch (err) {
    console.error('[login.js]', err.message);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};
