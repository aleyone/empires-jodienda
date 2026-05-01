/* api/upload.js
   POST /api/upload — sube una imagen a Cloudinary y devuelve la URL
   Usado para imágenes adicionales de héroes
*/

const formidable = require('formidable');
const fs         = require('fs');
const { uploadImageCloudinary, checkRole } = require('./_helpers');

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const username = req.headers['x-username'];
  if (!username) return res.status(401).json({ error: 'No autenticado' });

  try {
    const { readUsers } = require('./_helpers');
    const { users } = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user || !['admin','editor'].includes(user.role)) {
      return res.status(403).json({ error: 'Sin permisos' });
    }
  } catch (err) {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  try {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024 });
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!file) return res.status(400).json({ error: 'No se recibió imagen' });

    const buffer  = fs.readFileSync(file.filepath);
    const ext     = file.originalFilename?.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
    const filename = `additional-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const url = await uploadImageCloudinary(filename, buffer);
    return res.status(200).json({ url });

  } catch (err) {
    console.error('[upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
