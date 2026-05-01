/* api/hero-lookup.js
   Busca datos de un héroe usando la API de MediaWiki del fandom E&P
   GET /api/hero-lookup?name=Cobalt
*/

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.query;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }

  const heroName = name.trim();

  try {
    /* Usamos action=query con prop=revisions para obtener el wikitext raw */
    const url = `https://empiresandpuzzles.fandom.com/api.php?` +
      `action=query&titles=${encodeURIComponent(heroName)}&prop=revisions&rvprop=content&format=json&rvslots=main`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mini-Kripta-EpFanTool/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'No se pudo conectar con la wiki' });
    }

    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages) return res.status(404).json({ error: 'Héroe no encontrado en la wiki' });

    const page = Object.values(pages)[0];
    if (page.missing !== undefined) {
      return res.status(404).json({ error: `"${heroName}" no existe en la wiki` });
    }

    const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] ||
                     page?.revisions?.[0]?.['*'] || '';

    if (!wikitext) {
      return res.status(404).json({ error: 'Sin datos en la wiki para este héroe' });
    }

    /* Log primeros 500 chars para debug */
    console.log('[hero-lookup] wikitext sample:', wikitext.slice(0, 500));

    const parsed = parseHeroWikitext(wikitext, heroName);

    if (!parsed || Object.keys(parsed).length <= 1) {
      return res.status(200).json({
        name: heroName,
        _warning: 'Se encontró la página pero no se pudieron extraer datos estructurados'
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('[hero-lookup]', err.message);
    return res.status(503).json({
      error: 'No se pudo conectar con la wiki. Rellena los datos manualmente.'
    });
  }
};

function parseHeroWikitext(wikitext, heroName) {
  const result = { name: heroName };

  /* ---- Extraer campos de plantillas {{Hero|campo=valor}} o |campo=valor ---- */
  const getField = (keys) => {
    for (const key of keys) {
      /* Formato: | key = valor (hasta siguiente | o }) */
      const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\|\\}\\n]+)`, 'i');
      const m  = wikitext.match(re);
      if (m) {
        return m[1].trim()
          .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')  /* [[link|texto]] → texto */
          .replace(/\{\{[^}]+\}\}/g, '')                        /* {{plantilla}} → vacío */
          .replace(/<[^>]+>/g, '')                              /* HTML tags */
          .replace(/'{2,}/g, '')                                /* wikibold/italic */
          .trim();
      }
    }
    return null;
  };

  /* ---- ELEMENTO ---- */
  const colorRaw = getField(['color', 'element', 'Color', 'Element']);
  const colorMap = {
    'fire': 'fire', 'red': 'fire',
    'ice': 'ice', 'blue': 'ice', 'water': 'ice',
    'nature': 'nature', 'green': 'nature', 'earth': 'nature',
    'dark': 'dark', 'purple': 'dark', 'shadow': 'dark',
    'holy': 'holy', 'yellow': 'holy', 'light': 'holy'
  };
  if (colorRaw) {
    result.element = colorMap[colorRaw.toLowerCase()] || null;
  }
  /* Fallback: buscar en el texto */
  if (!result.element) {
    const lw = wikitext.slice(0, 3000).toLowerCase();
    if (lw.includes('fire') || lw.includes('red hero'))         result.element = 'fire';
    else if (lw.includes('ice') || lw.includes('blue hero'))    result.element = 'ice';
    else if (lw.includes('nature') || lw.includes('green hero')) result.element = 'nature';
    else if (lw.includes('dark') || lw.includes('purple hero')) result.element = 'dark';
    else if (lw.includes('holy') || lw.includes('yellow hero')) result.element = 'holy';
  }

  /* ---- RAREZA ---- */
  const starsRaw = getField(['stars', 'rarity', 'Stars', 'Rarity']);
  if (starsRaw) {
    const n = starsRaw.match(/(\d)/);
    if (n) result.rarity = n[1];
  }
  if (!result.rarity) {
    if (/5[\s-]*star|legendary/i.test(wikitext)) result.rarity = '5';
    else if (/4[\s-]*star|epic/i.test(wikitext)) result.rarity = '4';
    else if (/3[\s-]*star|rare/i.test(wikitext)) result.rarity = '3';
  }

  /* ---- CLASE ---- */
  const classRaw = getField(['class', 'Class', 'hero_class', 'heroClass']);
  const classMap = {
    'barbarian': 'Bárbaro', 'cleric': 'Clérigo', 'druid': 'Druida',
    'fighter': 'Guerrero', 'monk': 'Monje', 'paladin': 'Paladín',
    'ranger': 'Ranger', 'rogue': 'Pícaro', 'sorcerer': 'Hechicero',
    'wizard': 'Mago (Wizard)', 'titan': 'Titán'
  };
  if (classRaw) {
    result.heroClass = classMap[classRaw.toLowerCase()] || classRaw;
  } else {
    for (const [eng, esp] of Object.entries(classMap)) {
      if (new RegExp(`\\b${eng}\\b`, 'i').test(wikitext.slice(0, 3000))) {
        result.heroClass = esp;
        break;
      }
    }
  }

  /* ---- VELOCIDAD DE MANÁ ---- */
  const speedRaw = getField(['speed', 'mana_speed', 'manaSpeed', 'manaspeed', 'Speed']);
  const speedMap = {
    'very fast': 'Muy rápido', 'verfast': 'Muy rápido',
    'fast': 'Rápido',
    'average': 'Promedio',
    'slow': 'Lento',
    'very slow': 'Muy lento',
    'charge': 'Carga',
    'ninja': 'Ninja (x3)'
  };
  if (speedRaw) {
    result.manaSpeed = speedMap[speedRaw.toLowerCase()] || speedRaw;
  } else {
    for (const [eng, esp] of Object.entries(speedMap)) {
      if (new RegExp(`\\b${eng}\\b`, 'i').test(wikitext.slice(0, 3000))) {
        result.manaSpeed = esp;
        break;
      }
    }
  }

  /* ---- FAMILIA ---- */
  const familyRaw = getField(['family', 'Family', 'origin', 'Origin']);
  if (familyRaw && familyRaw.length < 50 && !familyRaw.includes('{')) {
    result.family = familyRaw;
  }

  /* ---- STATS numéricos ---- */
  const power   = getField(['power', 'teamcost', 'maxpower', 'max_power', 'Power']);
  const attack  = getField(['attack', 'atk', 'maxattack', 'max_attack', 'Attack']);
  const defense = getField(['defense', 'def', 'maxdefense', 'max_defense', 'Defence', 'Defense']);
  const health  = getField(['health', 'hp', 'maxhealth', 'max_health', 'Health']);

  if (power   && /^\d+$/.test(power.trim()))   result.power   = power.trim();
  if (attack  && /^\d+$/.test(attack.trim()))  result.attack  = attack.trim();
  if (defense && /^\d+$/.test(defense.trim())) result.defense = defense.trim();
  if (health  && /^\d+$/.test(health.trim()))  result.health  = health.trim();

  /* ---- HABILIDAD ESPECIAL ---- */
  const skillName = getField(['skill', 'special', 'skillname', 'skill_name', 'Special', 'Skill']);
  if (skillName && skillName.length < 80 && !skillName.includes('{')) {
    result.specialName = skillName;
  }

  /* Descripción: buscar primer efecto de habilidad */
  const effectMatch = wikitext.match(/Deals\s+\d+%[^\.]{5,200}\./i) ||
                      wikitext.match(/All\s+allies[^\.]{5,200}\./i) ||
                      wikitext.match(/The\s+target[^\.]{5,200}\./i);
  if (effectMatch) {
    result.specialDesc = effectMatch[0]
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n/g, ' ')
      .trim();
  }

  return result;
}
