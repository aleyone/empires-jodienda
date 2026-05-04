/* api/media.js
   GET  /api/media/proxy?url=xxx  → proxy de imágenes del fandom
   POST /api/media/upload         → subir imagen adicional a Cloudinary
*/

const { IncomingForm } = require('formidable');
const fs = require('fs');

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  const url = (req.url || '').split('?')[0];

  /* ---- PROXY de imágenes ---- */
  if (req.method === 'GET' && url.includes('/proxy')) {
    const { url: imageUrl } = req.query;
    if (!imageUrl) return res.status(400).json({ error: 'url requerida' });

    const allowed = ['static.wikia.nocookie.net','vignette.wikia.nocookie.net',
                     'static.fandom.com','empiresandpuzzles.fandom.com'];
    let parsed;
    try { parsed = new URL(imageUrl); } catch { return res.status(400).json({ error: 'URL inválida' }); }
    if (!allowed.some(d => parsed.hostname.endsWith(d))) {
      return res.status(403).json({ error: 'Dominio no permitido' });
    }

    try {
      const response = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mini-Kripta-EpFanTool/1.0' },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return res.status(response.status).end();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer      = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(Buffer.from(buffer));
    } catch (err) {
      return res.status(502).json({ error: 'Error al descargar imagen' });
    }
  }

  /* ---- UPLOAD de imágenes adicionales ---- */
  if (req.method === 'POST' && url.includes('/upload')) {
    res.setHeader('Content-Type', 'application/json');
    const username = req.headers['x-username'];
    if (!username) return res.status(401).json({ error: 'No autenticado' });

    try {
      const { readUsers, uploadImageCloudinary } = require('./_helpers');
      const { users } = await readUsers();
      const user = users.find(u => u.username === username);
      if (!user || !['admin','editor'].includes(user.role)) {
        return res.status(403).json({ error: 'Sin permisos' });
      }

      const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024 });
      const [, files] = await new Promise((resolve, reject) => {
        form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]));
      });

      const fileArr = files.image;
      const file    = Array.isArray(fileArr) ? fileArr[0] : fileArr;
      if (!file) return res.status(400).json({ error: 'No se recibió imagen' });

      const buffer   = fs.readFileSync(file.filepath || file.path);
      const origName = file.originalFilename || file.name || 'image.jpg';
      const ext      = origName.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
      const filename = `additional-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const cloudUrl = await uploadImageCloudinary(filename, buffer);
      return res.status(200).json({ url: cloudUrl });

    } catch (err) {
      console.error('[media/upload]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};
