/* api/upload.js
   POST /api/upload — sube una imagen a Cloudinary y devuelve la URL
*/

const { IncomingForm } = require('formidable');
const fs         = require('fs');

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const username = req.headers['x-username'];
  if (!username) return res.status(401).json({ error: 'No autenticado' });

  try {
    /* Verificar permisos */
    const { readUsers, uploadImageCloudinary } = require('./_helpers');
    const { users } = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user || !['admin','editor'].includes(user.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }

    /* Parsear el fichero */
    const form = new IncomingForm({ maxFileSize: 5 * 1024 * 1024 });
    const [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileArr = files.image;
    const file    = Array.isArray(fileArr) ? fileArr[0] : fileArr;
    if (!file) return res.status(400).json({ error: 'No se recibió imagen' });

    const buffer   = fs.readFileSync(file.filepath || file.path);
    const origName = file.originalFilename || file.name || 'image.jpg';
    const ext      = origName.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
    const filename = `additional-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const url = await uploadImageCloudinary(filename, buffer);
    return res.status(200).json({ url });

  } catch (err) {
    console.error('[upload]', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
};
