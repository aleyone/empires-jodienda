/* api/heroes.js — CRUD de héroes
   Rutas:
     GET  /api/heroes          → lista todos
     GET  /api/heroes?id=xxx   → uno por id
     POST /api/heroes          → crea nuevo (multipart)
     PUT  /api/heroes?id=xxx   → actualiza
     DEL  /api/heroes?id=xxx   → elimina
*/

const { readHeroes, writeHeroes, uploadImage, deleteFile, checkRole } = require('./_helpers');
const crypto = require('crypto');

/* Vercel no parsea multipart por defecto — usamos formidable */
const formidable = require('formidable');
const fs         = require('fs');

module.exports = async (req, res) => {
  const { id } = req.query;

  try {
    switch (req.method) {

      /* ---- GET ---- */
      case 'GET': {
        const { heroes } = await readHeroes();
        if (id) {
          const hero = heroes.find(h => h.id === id);
          if (!hero) return res.status(404).json({ error: 'Héroe no encontrado' });
          return res.status(200).json(hero);
        }
        return res.status(200).json({ heroes });
      }

      /* ---- POST ---- */
      case 'POST': {
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroData, imageBuffer, imageExt } = await parseMultipart(req);

        let imagePath = null;
        if (imageBuffer) {
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${imageExt}`;
          imagePath = await uploadImage(filename, imageBuffer);
          /* Pequeña pausa para que GitHub propague el fichero */
          await delay(1500);
        }

        const { heroes, sha } = await readHeroes();
        const newHero = {
          id: crypto.randomBytes(6).toString('hex'),
          ...heroData,
          imagePath,
          createdBy: req.headers['x-username'],
          createdAt: new Date().toISOString()
        };
        heroes.push(newHero);
        await writeHeroes(heroes, sha, `add hero: ${newHero.name}`);

        return res.status(201).json(newHero);
      }

      /* ---- PUT ---- */
      case 'PUT': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroData, imageBuffer, imageExt } = await parseMultipart(req);
        const { heroes, sha } = await readHeroes();
        const idx = heroes.findIndex(h => h.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Héroe no encontrado' });

        let imagePath = heroes[idx].imagePath;
        if (imageBuffer) {
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${imageExt}`;
          imagePath = await uploadImage(filename, imageBuffer);
          await delay(1500);
        }

        heroes[idx] = { ...heroes[idx], ...heroData, imagePath, updatedAt: new Date().toISOString() };
        await writeHeroes(heroes, sha, `update hero: ${heroes[idx].name}`);

        return res.status(200).json(heroes[idx]);
      }

      /* ---- DELETE ---- */
      case 'DELETE': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        if (!(await checkRole(req, 'editor'))) {
          return res.status(403).json({ error: 'Sin permisos' });
        }
        const { heroes, sha } = await readHeroes();
        const idx = heroes.findIndex(h => h.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Héroe no encontrado' });

        const hero = heroes[idx];
        /* Borra la imagen si existe */
        if (hero.imagePath) {
          await deleteFile(hero.imagePath.replace(/^\//, ''), `delete hero image: ${hero.name}`);
        }
        heroes.splice(idx, 1);
        await writeHeroes(heroes, sha, `delete hero: ${hero.name}`);

        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
};

/* ---- Parsear multipart (imagen + JSON) ---- */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 500 * 1024 }); /* 500KB máx en servidor */
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      let heroData = {};
      try { heroData = JSON.parse(fields.data || '{}'); } catch {}

      let imageBuffer = null;
      let imageExt    = 'jpg';
      if (files.image) {
        const f = Array.isArray(files.image) ? files.image[0] : files.image;
        imageBuffer = fs.readFileSync(f.filepath || f.path);
        imageExt = (f.originalFilename || 'hero.jpg').split('.').pop() || 'jpg';
      }
      resolve({ heroData, imageBuffer, imageExt });
    });
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
