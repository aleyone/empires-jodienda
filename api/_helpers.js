/* api/_helpers.js — Utilidades para las Vercel Functions */

const crypto = require('crypto');

/* ---- SHA-256 ---- */
async function hashPassword(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

/* ============================================================
   GITHUB API
   Variables de entorno en Vercel:
     GITHUB_TOKEN    — Personal Access Token con scope "repo"
     GITHUB_OWNER    — usuario de GitHub (sin @)
     GITHUB_REPO     — nombre del repositorio
     GITHUB_BRANCH   — rama (normalmente "main")
   ============================================================ */

const GH_API = 'https://api.github.com';

function ghHeaders() {
  return {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'mini-kripta-app'
  };
}

function repoBase() {
  return `${GH_API}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`;
}

async function ghGet(path) {
  const branch = process.env.GITHUB_BRANCH || 'main';
  const url = `${repoBase()}/contents/${path}?ref=${branch}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`GitHub GET ${path} → ${r.status}: ${err.message || ''}`);
  }
  return r.json();
}

async function ghPut(path, contentBase64, message, sha) {
  const url  = `${repoBase()}/contents/${path}`;
  const body = {
    message,
    content: contentBase64,
    branch:  process.env.GITHUB_BRANCH || 'main'
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
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
  const content = Buffer.from(JSON.stringify({ users }, null, 2)).toString('base64');
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
  const content = Buffer.from(JSON.stringify({ heroes }, null, 2)).toString('base64');
  return ghPut('data/heroes.json', content, message, sha);
}

/* ---- Subir imagen al repo ---- */
async function uploadImage(filename, buffer) {
  const path   = `img/heroes/${filename}`;
  const branch = process.env.GITHUB_BRANCH || 'main';
  let sha;
  try {
    const existing = await ghGet(path);
    sha = existing.sha;
  } catch { /* fichero nuevo */ }

  const contentBase64 = buffer.toString('base64');
  await ghPut(path, contentBase64, `upload hero image: ${filename}`, sha);

  /* URL raw de GitHub — Vercel no sirve ficheros subidos dinámicamente */
  return `https://raw.githubusercontent.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/${branch}/${path}`;
}

/* ---- Eliminar fichero del repo ---- */
async function deleteFile(path, message) {
  let sha;
  try {
    const file = await ghGet(path);
    sha = file.sha;
  } catch { return; /* ya no existe */ }

  const url = `${repoBase()}/contents/${path}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sha,
      branch: process.env.GITHUB_BRANCH || 'main'
    })
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
