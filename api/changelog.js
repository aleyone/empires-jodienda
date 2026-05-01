/* api/changelog.js
   GET  /api/changelog          → devuelve el changelog completo
   POST /api/changelog/seen     → marca la versión actual como vista para el usuario
*/

const { readUsers, writeUsers } = require('./_helpers');
const fs   = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const url = (req.url || '').split('?')[0];

  try {
    if (req.method === 'GET') {
      /* Leer changelog desde fichero local (es estático, no necesita GitHub API) */
      const filePath = path.join(process.cwd(), 'data', 'changelog.json');
      const raw      = fs.readFileSync(filePath, 'utf8');
      return res.status(200).json(JSON.parse(raw));
    }

    if (req.method === 'POST' && url.endsWith('/seen')) {
      const username = req.headers['x-username'];
      if (!username) return res.status(401).json({ error: 'No autenticado' });

      const { version } = req.body || {};
      if (!version) return res.status(400).json({ error: 'version requerida' });

      const { users, sha } = await readUsers();
      const idx = users.findIndex(u => u.username === username);
      if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

      users[idx].lastSeenVersion = version;
      await writeUsers(users, sha, `changelog seen: ${username} v${version}`);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[changelog]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
