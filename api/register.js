/* api/register.js
   POST /api/register — registro de nuevo usuario con código de alianza
*/

const { readUsers, writeUsers, hashPassword } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, email, password, allianceCode } = req.body || {};

  /* Validaciones */
  if (!username || username.trim().length < 2)
    return res.status(400).json({ error: 'El nombre de usuario es obligatorio (mínimo 2 caracteres)' });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Email no válido' });

  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  if (!allianceCode || allianceCode.trim() !== process.env.ALLIANCE_CODE)
    return res.status(401).json({ error: 'Código de alianza incorrecto' });

  try {
    const { users, sha } = await readUsers();

    /* Comprobar duplicado */
    const exists = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (exists) return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });

    const emailExists = users.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
    if (emailExists) return res.status(409).json({ error: 'Ese email ya está registrado' });

    /* Crear usuario */
    const newUser = {
      username:     username.trim(),
      passwordHash: hashPassword(password),
      email:        email.trim().toLowerCase(),
      role:         'editor',
      firstLogin:   false,
      createdAt:    new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users, sha, `register user: ${username.trim()}`);

    return res.status(201).json({ ok: true });

  } catch (err) {
    console.error('[register]', err.message);
    return res.status(500).json({ error: 'Error al crear el usuario' });
  }
};
