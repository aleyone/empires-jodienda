/* api/heroes.js — CRUD de héroes
   Vercel: bodyParser desactivado para recibir multipart correctamente
*/

const { readHeroes, writeHeroes, uploadImage, deleteFile, checkRole } = require('./_helpers');
const formidable = require('formidable');
const fs         = require('fs');
const crypto     = require('crypto');

/* Desactivar bodyParser de Vercel — obligatorio para multipart/form-data */
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const { id } = req.query;

  /* Comentarios — acción especial */
  if (req.query.action === 'comment') {
    return handleComment(req, res, id);
  }

  try {
    switch (req.method) {

      case 'GET': {
        const { heroes } = await readHeroes();
        if (id) {
          const hero = heroes.find(h => h.id === id);
          if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' });
          return res.status(200).json(hero);
        }
        return res.status(200).json({ heroes });
      }

      case 'POST': {
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroData, imageBuffer, imageExt } = await parseMultipart(req);

        let imagePath = null;
        if (imageBuffer && imageBuffer.length > 0) {
          const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${imageExt}`;
          imagePath = await uploadImage(filename, imageBuffer);
          await delay(2000);
        }

        const { heroes, sha } = await readHeroes();
        const newHero = {
          id:        crypto.randomBytes(6).toString('hex'),
          ...heroData,
          imagePath,
          createdBy: req.headers['x-username'] || 'unknown',
          createdAt: new Date().toISOString()
        };
        heroes.push(newHero);
        await writeHeroes(heroes, sha, `add hero: ${newHero.name}`);
        return res.status(201).json(newHero);
      }

      case 'PUT': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroData, imageBuffer, imageExt } = await parseMultipart(req);
        const { heroes, sha } = await readHeroes();
        const idx = heroes.findIndex(h => h.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Héroe no encontrado' });
        /* Editors can only edit their own heroes */
        const callerPut = req.headers['x-username'];
        const isAdminPut = await checkRole(req, 'admin');
        if (!isAdminPut && heroes[idx].createdBy !== callerPut) {
          return res.status(403).json({ error: 'Solo puedes editar tus propios héroes' });
        }

        let imagePath = heroes[idx].imagePath;
        if (imageBuffer && imageBuffer.length > 0) {
          /* Nueva imagen subida — sube a GitHub */
          const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${imageExt}`;
          imagePath = await uploadImage(filename, imageBuffer);
          await delay(2000);
        } else if (heroData.imagePath && heroData.imagePath !== heroes[idx].imagePath) {
          /* URL de imagen externa (ej: wiki) — guardar directamente */
          imagePath = heroData.imagePath;
        }

        heroes[idx] = {
          ...heroes[idx],
          ...heroData,
          imagePath,
          updatedAt: new Date().toISOString(),
          updatedBy: req.headers['x-username'] || 'unknown'
        };
        await writeHeroes(heroes, sha, `update hero: ${heroes[idx].name}`);
        return res.status(200).json(heroes[idx]);
      }

      case 'DELETE': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroes, sha } = await readHeroes();
        const idx = heroes.findIndex(h => h.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Héroe no encontrado' });
        /* Editors can only delete their own heroes */
        const callerDel = req.headers['x-username'];
        const isAdminDel = await checkRole(req, 'admin');
        if (!isAdminDel && heroes[idx].createdBy !== callerDel) {
          return res.status(403).json({ error: 'Solo puedes eliminar tus propios héroes' });
        }

        const hero = heroes[idx];
        if (hero.imagePath) {
          await deleteFile(
            hero.imagePath.replace(/^.*githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, ''),
            `delete image: ${hero.name}`
          ).catch(() => {});
        }
        heroes.splice(idx, 1);
        await writeHeroes(heroes, sha, `delete hero: ${hero.name}`);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[heroes.js]', err.message, err.stack);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}

/* ---- Parsear multipart ---- */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = new formidable.Formidable({
      maxFileSize:    500 * 1024,
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);

      let heroData = {};
      try {
        const raw = Array.isArray(fields.data) ? fields.data[0] : fields.data;
        heroData = JSON.parse(raw || '{}');
      } catch (e) {
        console.error('Error parsing heroData JSON:', e);
      }

      let imageBuffer = null;
      let imageExt    = 'jpg';
      const imgFile   = files.image
        ? (Array.isArray(files.image) ? files.image[0] : files.image)
        : null;

      if (imgFile && imgFile.size > 0) {
        try {
          imageBuffer = fs.readFileSync(imgFile.filepath || imgFile.path);
          const originalName = imgFile.originalFilename || imgFile.name || 'hero.jpg';
          imageExt = originalName.split('.').pop().toLowerCase() || 'jpg';
          if (!['jpg', 'jpeg', 'png', 'webp'].includes(imageExt)) imageExt = 'jpg';
          console.log(`[heroes] image received: ${originalName}, size: ${imageBuffer.length}, ext: ${imageExt}`);
        } catch (e) {
          console.error('Error reading image file:', e);
        }
      }

      resolve({ heroData, imageBuffer, imageExt });
    });
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---- Endpoint comentarios: POST /api/heroes/:id/comment ---- */
/* Se accede via rewrite /api/heroes/:id/comment → /api/heroes?id=:id&action=comment */
async function handleComment(req, res, id) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const username = req.headers['x-username'];
  if (!username) return res.status(401).json({ error: 'No autenticado' });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comentario vacío' });

  const { heroes, sha } = await readHeroes();
  const idx = heroes.findIndex(h => h.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Héroe no encontrado' });

  if (!heroes[idx].comments) heroes[idx].comments = [];
  heroes[idx].comments.push({
    id:        require('crypto').randomBytes(4).toString('hex'),
    author:    username,
    text:      text.trim(),
    createdAt: new Date().toISOString()
  });

  await writeHeroes(heroes, sha, `comment on hero: ${heroes[idx].name}`);
  return res.status(200).json(heroes[idx]);
}
