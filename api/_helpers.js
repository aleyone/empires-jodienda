/* api/_helpers.js — Utilidades para las Vercel Functions */

const crypto = require('crypto');

/* ---- SHA-256 ---- */
async function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

/* ============================================================
   GITHUB API — leer y escribir ficheros del repo
   Variables de entorno necesarias en Vercel:
     GITHUB_TOKEN    — Personal Access Token con scope "repo"
     GITHUB_OWNER    — tu usuario de GitHub
     GITHUB_REPO     — nombre del repositorio
     GITHUB_BRANCH   — rama (normalmente "main")
   ============================================================ */

const GH_TOKEN  = process.env.GITHUB_TOKEN;
const GH_OWNER  = process.env.GITHUB_OWNER;
const GH_REPO   = process.env.GITHUB_REPO;
const GH_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GH_API    = 'https://api.github.com';

async function ghGet(path) {
  const url = `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!r.ok) throw new Error(`GitHub GET ${path} → ${r.status}`);
  return r.json();
}

async function ghPut(path, content, message, sha) {
  const url = `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch:  GH_BRANCH
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub PUT ${path} → ${r.status}`);
  }
  return r.json();
}

/* ---- Leer users.json ---- */
async function readUsers() {
  const file = await ghGet('data/users.json');
  const raw  = Buffer.from(file.content, 'base64').toString('utf8');
  const data = JSON.parse(raw);
  return { users: data.users || [], sha: file.sha };
}

/* ---- Escribir users.json ---- */
async function writeUsers(users, sha, message = 'update users') {
  const content = JSON.stringify({ users }, null, 2);
  return ghPut('data/users.json', content, message, sha);
}

/* ---- Leer heroes.json ---- */
async function readHeroes() {
  const file = await ghGet('data/heroes.json');
  const raw  = Buffer.from(file.content, 'base64').toString('utf8');
  const data = JSON.parse(raw);
  return { heroes: data.heroes || [], sha: file.sha };
}

/* ---- Escribir heroes.json ---- */
async function writeHeroes(heroes, sha, message = 'update heroes') {
  const content = JSON.stringify({ heroes }, null, 2);
  return ghPut('data/heroes.json', content, message, sha);
}

/* ---- Subir imagen al repo ---- */
async function uploadImage(filename, buffer) {
  const path = `img/heroes/${filename}`;
  /* Intentar obtener SHA si ya existe */
  let sha;
  try {
    const existing = await ghGet(path);
    sha = existing.sha;
  } catch { /* fichero nuevo, sin sha */ }

  await ghPut(path, buffer.toString('binary'), `upload hero image: ${filename}`, sha);
  return `/img/heroes/${filename}`;
}

/* ---- Eliminar fichero del repo ---- */
async function deleteFile(path, message) {
  const url = `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`;
  let sha;
  try {
    const file = await ghGet(path);
    sha = file.sha;
  } catch { return; /* ya no existe */ }

  await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, sha, branch: GH_BRANCH })
  });
}

/* ---- Comprobar rol del usuario llamante ---- */
async function checkRole(req, requiredRole) {
  const username = req.headers['x-username'];
  if (!username) return false;
  const { users } = await readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return false;
  if (requiredRole === 'admin')  return user.role === 'admin';
  if (requiredRole === 'editor') return user.role === 'admin' || user.role === 'editor';
  return true;
}

module.exports = {
  hashPassword,
  readUsers, writeUsers,
  readHeroes, writeHeroes,
  uploadImage, deleteFile,
  checkRole
};
