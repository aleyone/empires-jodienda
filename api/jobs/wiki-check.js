/* api/jobs/wiki-check.js
   POST /api/jobs/wiki-check
   Compara todos los héroes con la wiki y genera notificaciones
   Protegido con JOB_SECRET
*/

const { readHeroes, readUsers, readNotifications, writeNotifications, writeHeroes } = require('../_helpers');
const crypto = require('crypto');

const FIELD_KEYS = ['element','rarity','heroClass','manaSpeed','family',
                    'power','attack','defense','health','specialName','specialDesc'];

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  /* Verificar secret */
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.replace('Bearer ', '').trim();
  if (!token || token !== process.env.JOB_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { heroes, sha: heroesSha } = await readHeroes();
    const { users }                  = await readUsers();
    const { notifications, sha: notifSha } = await readNotifications();

    const adminUsers  = users.filter(u => u.role === 'admin').map(u => u.username);
    const newNotifs   = [];
    const heroesUpdated = [...heroes];
    const heroesWithUpdates = []; /* para notificación resumen a admins */

    console.log(`[wiki-check] checking ${heroes.length} heroes...`);

    for (const hero of heroes) {
      try {
        /* Llamar a la wiki */
        const wikiRes = await fetch(
          `https://empiresandpuzzles.fandom.com/api.php?action=query&titles=${encodeURIComponent(hero.name)}&prop=revisions&rvprop=content&format=json&rvslots=main`,
          { headers: { 'User-Agent': 'Mini-Kripta-WikiCheck/1.0' }, signal: AbortSignal.timeout(8000) }
        );
        if (!wikiRes.ok) continue;

        const wikiJson = await wikiRes.json();
        const page     = Object.values(wikiJson?.query?.pages || {})[0];
        if (!page || page.missing !== undefined) continue;

        const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] || '';
        if (!wikitext) continue;

        /* Parsear (importamos la función del hero-lookup) */
        const { parseHeroWikitextForJob } = require('./wiki-parser');
        const wikiData = parseHeroWikitextForJob(wikitext, hero.name);

        /* Detectar diferencias */
        const diffs = FIELD_KEYS.filter(key => {
          const heroVal = hero[key];
          const wikiVal = wikiData[key];
          if (!wikiVal) return false;
          if (!heroVal) return true;
          return String(heroVal).trim() !== String(wikiVal).trim();
        });

        if (diffs.length === 0) {
          /* Sin diferencias — actualizar wikiCheckedAt */
          const idx = heroesUpdated.findIndex(h => h.id === hero.id);
          if (idx !== -1) {
            heroesUpdated[idx].wikiCheckedAt  = new Date().toISOString();
            heroesUpdated[idx].wikiHasUpdates = false;
          }
          continue;
        }

        /* Hay diferencias — marcar héroe */
        const heroIdx = heroesUpdated.findIndex(h => h.id === hero.id);
        if (heroIdx !== -1) {
          heroesUpdated[heroIdx].wikiCheckedAt  = new Date().toISOString();
          heroesUpdated[heroIdx].wikiHasUpdates = true;
        }

        heroesWithUpdates.push({
          id:          hero.id,
          name:        hero.name,
          createdBy:   hero.createdBy,
          wikiCheckedAt: new Date().toISOString(),
          diffCount:   diffs.length
        });

        /* Notificación al editor que creó el héroe */
        const creator = users.find(u => u.username === hero.createdBy);
        if (creator && creator.role === 'editor') {
          /* Evitar duplicados — no crear si ya existe una no leída para este héroe */
          const exists = notifications.some(n =>
            n.heroId === hero.id && n.type === 'wiki_update' &&
            n.targetUser === hero.createdBy && !n.read
          );
          if (!exists) {
            newNotifs.push({
              id:          crypto.randomBytes(6).toString('hex'),
              type:        'wiki_update',
              heroId:      hero.id,
              heroName:    hero.name,
              targetUser:  hero.createdBy,
              diffCount:   diffs.length,
              read:        false,
              createdAt:   new Date().toISOString()
            });
          }
        }

      } catch (err) {
        console.error(`[wiki-check] error on ${hero.name}:`, err.message);
      }

      /* Pequeña pausa para no saturar la API del fandom */
      await delay(500);
    }

    /* Notificación resumen para admins */
    if (heroesWithUpdates.length > 0) {
      const exists = notifications.some(n =>
        n.type === 'wiki_update_summary' && !n.read
      );
      if (!exists) {
        newNotifs.push({
          id:          crypto.randomBytes(6).toString('hex'),
          type:        'wiki_update_summary',
          targetUser:  'admins',
          heroes:      heroesWithUpdates,
          totalCount:  heroesWithUpdates.length,
          read:        false,
          createdAt:   new Date().toISOString()
        });
      }
    }

    /* Guardar notificaciones nuevas */
    if (newNotifs.length > 0) {
      const allNotifs = [...notifications, ...newNotifs];
      await writeNotifications(allNotifs, notifSha, `wiki-check: ${newNotifs.length} new notifications`);
    }

    /* Guardar héroes actualizados (wikiCheckedAt, wikiHasUpdates) */
    await writeHeroes(heroesUpdated, heroesSha, `wiki-check: updated ${heroes.length} heroes`);

    console.log(`[wiki-check] done. ${heroesWithUpdates.length} heroes with updates, ${newNotifs.length} notifications created`);

    return res.status(200).json({
      ok:              true,
      heroesChecked:   heroes.length,
      heroesWithUpdates: heroesWithUpdates.length,
      notificationsCreated: newNotifs.length
    });

  } catch (err) {
    console.error('[wiki-check] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
