/* api/wars.js
   GET  /api/wars          → todas las guerras
   GET  /api/wars?id=xxx   → guerra específica
   POST /api/wars          → crear nueva guerra (solo admin)
   PUT  /api/wars?id=xxx   → actualizar guerra (solo admin)
*/

const { readUsers } = require('./_helpers');
const crypto = require('crypto');

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_OWNER  = process.env.GITHUB_OWNER;
const GITHUB_REPO   = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH     = 'data/wars.json';

async function ghGet(filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!res.ok) throw new Error(`GitHub GET ${filePath}: ${res.status}`);
  return res.json();
}

async function ghPut(filePath, content, message, sha) {
  const body = { message, content, branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    { method: 'PUT', headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || res.status); }
  return res.json();
}

async function readWars() {
  try {
    const file = await ghGet(FILE_PATH);
    const raw  = Buffer.from(file.content, 'base64').toString('utf8');
    return { wars: JSON.parse(raw).wars || [], sha: file.sha };
  } catch { return { wars: [], sha: null }; }
}

async function writeWars(wars, sha, message = 'update wars') {
  const content = Buffer.from(JSON.stringify({ wars }, null, 2)).toString('base64');
  return ghPut(FILE_PATH, content, message, sha);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { id } = req.query;
  const callerUsername = req.headers['x-username'];

  try {
    switch (req.method) {

      case 'GET': {
        const { wars } = await readWars();
        if (id) {
          const war = wars.find(w => w.id === id);
          if (!war) return res.status(404).json({ error: 'Guerra no encontrada' });
          return res.status(200).json(war);
        }
        /* Ordenar por fecha desc */
        wars.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        return res.status(200).json({ wars });
      }

      case 'POST': {
        /* Solo admins */
        const { readUsers } = require('./_helpers');
        const { users } = await readUsers();
        const caller = users.find(u => u.username.toLowerCase() === (callerUsername||'').toLowerCase());
        if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });

        const { startDate, endDate, type, result, participants } = req.body || {};
        if (!startDate || !type) return res.status(400).json({ error: 'startDate y type son obligatorios' });

        const { wars, sha } = await readWars();
        const newWar = {
          id:           `war-${startDate}`,
          startDate,
          endDate:      endDate || startDate,
          type,
          result:       result || { ourScore: 0, enemyScore: 0, enemyName: '', won: false },
          participants: participants || []
        };

        wars.push(newWar);
        await writeWars(wars, sha, `add war: ${startDate} ${type}`);
        return res.status(201).json({ ok: true, war: newWar });
      }

      case 'PUT': {
        if (!id) return res.status(400).json({ error: 'id requerido' });

        const { readUsers } = require('./_helpers');
        const { users } = await readUsers();
        const caller = users.find(u => u.username.toLowerCase() === (callerUsername||'').toLowerCase());
        if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'Sin permisos' });

        const { wars, sha } = await readWars();
        const idx = wars.findIndex(w => w.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Guerra no encontrada' });

        wars[idx] = { ...wars[idx], ...req.body };
        await writeWars(wars, sha, `update war: ${id}`);
        return res.status(200).json({ ok: true, war: wars[idx] });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[wars]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
