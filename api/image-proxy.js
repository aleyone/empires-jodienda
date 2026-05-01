/* api/image-proxy.js
   Proxy para descargar imágenes del fandom evitando CORS
   GET /api/image-proxy?url=https://...
*/

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url requerida' });

  /* Solo permitir imágenes del fandom */
  const allowed = ['static.wikia.nocookie.net', 'vignette.wikia.nocookie.net',
                   'static.fandom.com', 'empiresandpuzzles.fandom.com'];
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }

  if (!allowed.some(d => parsed.hostname.endsWith(d))) {
    return res.status(403).json({ error: 'Dominio no permitido' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mini-Kripta-EpFanTool/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return res.status(response.status).end();

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer      = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('[image-proxy]', err.message);
    res.status(502).json({ error: 'Error al descargar imagen' });
  }
};
