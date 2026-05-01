/* api/hero-lookup.js — Busca héroe en wiki E&P */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { name } = req.query;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Nombre requerido' });

  try {
    const heroName = name.trim();
    const url = `https://empiresandpuzzles.fandom.com/api.php?` +
      `action=query&titles=${encodeURIComponent(heroName)}&prop=revisions&rvprop=content&format=json&rvslots=main`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mini-Kripta-EpFanTool/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return res.status(404).json({ error: 'No se pudo conectar con la wiki' });

    const data  = await response.json();
    const page  = Object.values(data?.query?.pages || {})[0];

    if (!page || page.missing !== undefined) {
      return res.status(404).json({ error: `"${heroName}" no existe en la wiki` });
    }

    const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] || '';
    if (!wikitext) return res.status(404).json({ error: 'Sin datos en la wiki' });

    return res.status(200).json(parseHeroWikitext(wikitext, heroName));

  } catch (err) {
    console.error('[hero-lookup]', err.message);
    return res.status(503).json({ error: 'Error al conectar con la wiki. Rellena manualmente.' });
  }
};

/* ---- PARSER ---- */
function parseHeroWikitext(wikitext, heroName) {
  const result = { name: heroName };

  /* Extrae |campo = valor — para hasta el siguiente | o } o \n */
  const field = (key) => {
    const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\|\\}\\n]*)`, 'i');
    const m  = wikitext.match(re);
    return m ? m[1].trim() : null;
  };

  /* Limpia wikitext a texto plano */
  const clean = (s) => (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')  /* [[link|text]] → text */
    .replace(/\{\{[^}]*\}\}/g, '')                       /* {{plantilla}} → '' */
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  /* ---- ELEMENTO — {{el|ice}} ---- */
  const elRaw = field('element');
  const elMatch = elRaw?.match(/\{\{el\|(\w+)\}\}/i) || elRaw?.match(/(\w+)/);
  const elMap = {
    ice:'ice', blue:'ice', water:'ice',
    fire:'fire', red:'fire',
    nature:'nature', green:'nature', earth:'nature',
    dark:'dark', purple:'dark',
    holy:'holy', yellow:'holy', light:'holy'
  };
  if (elMatch) result.element = elMap[elMatch[1].toLowerCase()] || null;
  /* Fallback: Categories */
  if (!result.element) {
    if (/Category:Ice Heroes/i.test(wikitext))    result.element = 'ice';
    else if (/Category:Fire Heroes/i.test(wikitext))   result.element = 'fire';
    else if (/Category:Nature Heroes/i.test(wikitext)) result.element = 'nature';
    else if (/Category:Dark Heroes/i.test(wikitext))   result.element = 'dark';
    else if (/Category:Holy Heroes/i.test(wikitext))   result.element = 'holy';
  }

  /* ---- RAREZA — {{rarity|R5}} ---- */
  const rarityRaw = field('rarity');
  const rarityMatch = rarityRaw?.match(/R(\d)/i) || rarityRaw?.match(/(\d)/);
  if (rarityMatch) result.rarity = rarityMatch[1];
  if (!result.rarity) {
    if (/Category:5 Star Heroes/i.test(wikitext))      result.rarity = '5';
    else if (/Category:4 Star Heroes/i.test(wikitext)) result.rarity = '4';
    else if (/Category:3 Star Heroes/i.test(wikitext)) result.rarity = '3';
    else if (/Category:2 Star Heroes/i.test(wikitext)) result.rarity = '2';
  }

  /* ---- CLASE — {{cl|wizard}} ---- */
  const classRaw = field('class');
  const classMatch = classRaw?.match(/\{\{cl\|(\w+)\}\}/i) || classRaw?.match(/(\w+)/);
  const classMap = {
    barbarian:'Bárbaro', cleric:'Clérigo', druid:'Druida',
    fighter:'Guerrero', monk:'Monje', paladin:'Paladín',
    ranger:'Ranger', rogue:'Pícaro', sorcerer:'Hechicero',
    wizard:'Mago (Wizard)', titan:'Titán'
  };
  if (classMatch) result.heroClass = classMap[classMatch[1].toLowerCase()] || classMatch[1];
  if (!result.heroClass) {
    for (const [eng, esp] of Object.entries(classMap)) {
      if (new RegExp(`Category:${eng}`, 'i').test(wikitext)) { result.heroClass = esp; break; }
    }
  }

  /* ---- VELOCIDAD ---- */
  const speedRaw = clean(field('mana_speed') || field('speed') || '');
  const speedMap = {
    'very fast':'Muy rápido', 'fast':'Rápido', 'average':'Promedio',
    'slow':'Lento', 'very slow':'Muy lento', 'charge':'Carga', 'ninja':'Ninja (x3)'
  };
  if (speedRaw) result.manaSpeed = speedMap[speedRaw.toLowerCase()] || speedRaw;

  /* ---- FAMILIA — {{family|nin}} ---- */
  const familyRaw = field('family');
  const famMatch = familyRaw?.match(/\{\{family\|(\w+)\}\}/i);
  const famMap = {
    nin:'Ninja', classic:'Classic', atlantis:'Atlantis', valhalla:'Valhalla',
    slayer:'Slayer', teltoc:'Teltoc', wonderland:'Wonderland', grimforest:'Grimforest',
    pirates:'Pirates', seasonal:'Seasonal', sand:'Sand', morlovia:'Morlovia',
    christmas:'Christmas', villains:'Villains', magic:'Magic', styx:'Styx',
    legends:'Legends', carnival:'Carnival', circus:'Circus', covenant:'Covenant',
    dunes:'Dunes', soul:'Soul Exchange', untold:'Untold Tales'
  };
  if (famMatch) {
    result.family = famMap[famMatch[1].toLowerCase()] || famMatch[1];
  } else if (familyRaw) {
    const cleanFam = clean(familyRaw);
    if (cleanFam && cleanFam.length < 50) result.family = cleanFam;
  }
  /* Fallback: Category */
  if (!result.family) {
    const catFam = wikitext.match(/\[\[Category:([^\]]+?)\s+Family\]\]/i);
    if (catFam) result.family = catFam[1].trim();
  }

  /* ---- STATS ---- */
  const power   = field('power');
  const attack  = field('attack');
  const defense = field('defense');
  const health  = field('health');
  if (power   && /^\d+$/.test(power.trim()))   result.power   = power.trim();
  if (attack  && /^\d+$/.test(attack.trim()))  result.attack  = attack.trim();
  if (defense && /^\d+$/.test(defense.trim())) result.defense = defense.trim();
  if (health  && /^\d+$/.test(health.trim()))  result.health  = health.trim();

  /* ---- NOMBRE HABILIDAD — special_name ---- */
  const skillName = field('special_name') || field('skill') || field('skillname');
  if (skillName) result.specialName = clean(skillName);

  /* ---- DESCRIPCIÓN — efectos effect1..effect8 ---- */
  const effects = [];
  for (let i = 1; i <= 8; i++) {
    const ef = field(`effect${i}`);
    if (ef) {
      const cleaned = clean(ef);
      if (cleaned && cleaned.length > 5) effects.push(cleaned);
    }
  }
  if (effects.length > 0) {
    result.specialDesc = effects.join('\n');
  }

  return result;
}
