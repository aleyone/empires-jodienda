/* api/login.js — Vercel Serverless Function */

const { readUsers, hashPassword } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const users = await readUsers();
  const user  = users.find(u => u.username === username.toLowerCase());

  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

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
};
