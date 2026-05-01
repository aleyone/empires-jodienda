/* api/jobs/migrate-images.js
   POST /api/jobs/migrate-images
   Migra imágenes de GitHub a Cloudinary y actualiza heroes.json
   Protegido con JOB_SECRET
*/

const { readHeroes, writeHeroes, uploadImageCloudinary } = require('../_helpers');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.JOB_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { heroes, sha } = await readHeroes();
    const results = { migrated: [], skipped: [], failed: [] };

    for (const hero of heroes) {
      /* Solo migrar imágenes de GitHub raw */
      if (!hero.imagePath || !hero.imagePath.includes('raw.githubusercontent.com')) {
        results.skipped.push(hero.name);
        continue;
      }

      try {
        /* Descargar imagen de GitHub */
        const imgRes = await fetch(hero.imagePath, { signal: AbortSignal.timeout(10000) });
        if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
        const buffer = Buffer.from(await imgRes.arrayBuffer());

        /* Extraer extensión */
        const ext      = hero.imagePath.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
        const filename = `${hero.id}.${ext}`;

        /* Subir a Cloudinary */
        const cloudUrl = await uploadImageCloudinary(filename, buffer);

        /* Actualizar héroe */
        hero.imagePath = cloudUrl;
        results.migrated.push({ name: hero.name, url: cloudUrl });

        console.log(`[migrate] ✓ ${hero.name} → ${cloudUrl}`);

        /* Pausa para no saturar */
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`[migrate] ✗ ${hero.name}:`, err.message);
        results.failed.push({ name: hero.name, error: err.message });
      }
    }

    /* Guardar heroes.json actualizado */
    if (results.migrated.length > 0) {
      await writeHeroes(heroes, sha, `migrate images to Cloudinary: ${results.migrated.length} heroes`);
    }

    return res.status(200).json({
      ok: true,
      migrated: results.migrated.length,
      skipped:  results.skipped.length,
      failed:   results.failed.length,
      details:  results
    });

  } catch (err) {
    console.error('[migrate-images]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
