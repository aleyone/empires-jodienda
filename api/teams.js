/* api/teams.js
   GET    /api/teams              → todos los equipos
   GET    /api/teams?username=xxx → equipo de un usuario
   POST   /api/teams              → crear/actualizar equipo
   PUT    /api/teams/:username    → actualizar héroe en posición
   DELETE /api/teams/:username/:position → eliminar héroe de posición
*/

const { readUsers, uploadImageCloudinary } = require('./_helpers');
const { IncomingForm } = require('formidable');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

module.exports.config = { api: { bodyParser: false } };

/* ---- Helpers de teams.json ---- */
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_OWNER  = process.env.GITHUB_OWNER;
const GITHUB_REPO   = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE_PATH     = 'data/teams.json';

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

async function readTeams() {
  try {
    const file = await ghGet(FILE_PATH);
    const raw  = Buffer.from(file.content, 'base64').toString('utf8');
    return { teams: JSON.parse(raw).teams || [], sha: file.sha };
  } catch { return { teams: [], sha: null }; }
}

async function writeTeams(teams, sha, message = 'update teams') {
  const content = Buffer.from(JSON.stringify({ teams }, null, 2)).toString('base64');
  return ghPut(FILE_PATH, content, message, sha);
}

function isAdminOrEditor(user) {
  return user && ['admin','editor'].includes(user.role);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const callerUsername = req.headers['x-username'];
  const { username, position } = req.query;

  try {
    const { users } = await readUsers();
    const caller    = users.find(u => u.username.toLowerCase() === (callerUsername||'').toLowerCase());

    switch (req.method) {

      /* ---- GET ---- */
      case 'GET': {
        const { teams } = await readTeams();

        if (username) {
          const team = teams.find(t => t.username === username) || { username, heroes: [] };
          return res.status(200).json(team);
        }

        /* Devolver todos los equipos solo de editores/admins */
        const editorAdmins = users.filter(u => isAdminOrEditor(u)).map(u => u.username);
        const allTeams = editorAdmins.map(uname => {
          const team = teams.find(t => t.username === uname);
          return team || { username: uname, heroes: [] };
        });

        return res.status(200).json({ teams: allTeams });
      }

      /* ---- POST: añadir/actualizar héroe en posición ---- */
      case 'POST': {
        if (!caller) return res.status(401).json({ error: 'No autenticado' });

        /* Parsear form con posible imagen */
        const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024 });
        const [fields, files] = await new Promise((resolve, reject) => {
          form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
        });

        const dataStr    = Array.isArray(fields.data) ? fields.data[0] : fields.data;
        const heroData   = JSON.parse(dataStr || '{}');
        const targetUser = heroData.targetUsername || callerUsername;

        /* Permisos */
        const isAdmin = caller.role === 'admin';
        if (targetUser !== callerUsername && !isAdmin) {
          return res.status(403).json({ error: 'Sin permisos' });
        }

        /* Subir imagen si viene */
        const fileArr = files.image;
        const file    = Array.isArray(fileArr) ? fileArr[0] : fileArr;
        if (file) {
          const buffer   = fs.readFileSync(file.filepath || file.path);
          const ext      = (file.originalFilename || 'img.jpg').match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
          const filename = `team-${targetUser}-${Date.now()}.${ext}`;
          heroData.imagePath = await uploadImageCloudinary(filename, buffer);
        }

        const { teams, sha } = await readTeams();
        let teamIdx = teams.findIndex(t => t.username === targetUser);
        if (teamIdx === -1) {
          teams.push({ username: targetUser, heroes: [], updatedAt: new Date().toISOString() });
          teamIdx = teams.length - 1;
        }

        const team    = teams[teamIdx];
        const pos     = parseInt(heroData.position) || 1;
        const heroSlot = {
          position:  pos,
          heroId:    heroData.heroId || null,   /* si existe en bestiario */
          heroData:  heroData.heroId ? null : { /* datos propios si no existe */
            name:        heroData.name,
            element:     heroData.element,
            rarity:      heroData.rarity,
            heroClass:   heroData.heroClass,
            manaSpeed:   heroData.manaSpeed,
            family:      heroData.family,
            imagePath:   heroData.imagePath || null,
            specialName: heroData.specialName,
          }
        };

        /* Reemplazar o añadir en posición */
        const existIdx = team.heroes.findIndex(h => h.position === pos);
        if (existIdx !== -1) team.heroes[existIdx] = heroSlot;
        else team.heroes.push(heroSlot);

        /* Máximo 5 héroes */
        if (team.heroes.length > 5) {
          return res.status(400).json({ error: 'El equipo ya tiene 5 héroes' });
        }

        team.updatedAt = new Date().toISOString();
        await writeTeams(teams, sha, `update team: ${targetUser} pos ${pos}`);
        return res.status(200).json({ ok: true, team });
      }

      /* ---- DELETE: eliminar héroe de posición ---- */
      case 'DELETE': {
        if (!caller) return res.status(401).json({ error: 'No autenticado' });
        const targetUser = username || callerUsername;
        const isAdmin    = caller.role === 'admin';
        if (targetUser !== callerUsername && !isAdmin) {
          return res.status(403).json({ error: 'Sin permisos' });
        }

        const { teams, sha } = await readTeams();
        const teamIdx = teams.findIndex(t => t.username === targetUser);
        if (teamIdx === -1) return res.status(404).json({ error: 'Equipo no encontrado' });

        const pos = parseInt(position);
        teams[teamIdx].heroes = teams[teamIdx].heroes.filter(h => h.position !== pos);
        teams[teamIdx].updatedAt = new Date().toISOString();
        await writeTeams(teams, sha, `remove hero from team: ${targetUser} pos ${pos}`);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[teams]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
