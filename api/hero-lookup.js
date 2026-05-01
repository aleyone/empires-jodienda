/* api/hero-lookup.js
   Busca datos de un héroe en la wiki del fandom de E&P
   GET /api/hero-lookup?name=Cobalt
*/

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.query;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }

  const heroName = name.trim();

  try {
    /* Usamos la API de MediaWiki del fandom — menos restrictiva que el HTML */
    const wikiApiUrl = `https://empiresandpuzzles.fandom.com/api.php?` +
      `action=parse&page=${encodeURIComponent(heroName)}&prop=wikitext&format=json&origin=*`;

    const response = await fetch(wikiApiUrl, {
      headers: {
        'User-Agent': 'Mini-Kripta-EmpiresPuzzles/1.0 (fan wiki tool)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Héroe no encontrado en la wiki' });
    }

    const data = await response.json();

    if (data.error || !data.parse?.wikitext?.['*']) {
      return res.status(404).json({ error: 'Héroe no encontrado en la wiki' });
    }

    const wikitext = data.parse.wikitext['*'];
    const parsed   = parseWikitext(wikitext, heroName);

    if (!parsed) {
      return res.status(404).json({ error: 'No se pudieron extraer datos del héroe' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('[hero-lookup]', err.message);
    return res.status(503).json({ error: 'No se pudo conectar con la wiki. Rellena los datos manualmente.' });
  }
};

/* ---- Parser de wikitext ---- */
function parseWikitext(wikitext, heroName) {
  const result = { name: heroName };

  /* ---- ELEMENTO / COLOR ---- */
  const colorMap = {
    'fire': 'fire', 'red': 'fire', 'rojo': 'fire', 'fuego': 'fire',
    'ice': 'ice', 'blue': 'ice', 'azul': 'ice', 'hielo': 'ice',
    'nature': 'nature', 'green': 'nature', 'verde': 'nature', 'naturaleza': 'nature',
    'dark': 'dark', 'purple': 'dark', 'morado': 'dark', 'oscuridad': 'dark',
    'holy': 'holy', 'yellow': 'holy', 'amarillo': 'holy', 'sagrado': 'holy'
  };

  for (const [key, val] of Object.entries(colorMap)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(wikitext.slice(0, 2000))) {
      result.element = val;
      break;
    }
  }

  /* ---- RAREZA / ESTRELLAS ---- */
  const starsMatch = wikitext.match(/\|\s*stars\s*=\s*(\d)/i) ||
                     wikitext.match(/(\d)\s*[Ss]tar/i) ||
                     wikitext.match(/[Ll]egendary/i) ? null : null;

  if (wikitext.match(/\|\s*stars\s*=\s*(\d)/i)) {
    result.rarity = wikitext.match(/\|\s*stars\s*=\s*(\d)/i)[1];
  } else if (wikitext.match(/5[\s-]*[Ss]tar|[Ll]egendary/i)) {
    result.rarity = '5';
  } else if (wikitext.match(/4[\s-]*[Ss]tar|[Ee]pic/i)) {
    result.rarity = '4';
  } else if (wikitext.match(/3[\s-]*[Ss]tar|[Rr]are/i)) {
    result.rarity = '3';
  }

  /* ---- CLASE ---- */
  const classMap = {
    'Barbarian': 'Bárbaro', 'Cleric': 'Clérigo', 'Druid': 'Druida',
    'Fighter': 'Guerrero', 'Monk': 'Monje', 'Paladin': 'Paladín',
    'Ranger': 'Ranger', 'Rogue': 'Pícaro', 'Sorcerer': 'Hechicero',
    'Wizard': 'Mago (Wizard)', 'Titan': 'Titán'
  };
  for (const [eng, esp] of Object.entries(classMap)) {
    if (new RegExp(`\\b${eng}\\b`, 'i').test(wikitext)) {
      result.heroClass = esp;
      break;
    }
  }

  /* ---- VELOCIDAD DE MANÁ ---- */
  const speedPatterns = [
    [/[Vv]ery [Ff]ast|Muy rápido/i,    'Muy rápido'],
    [/[Vv]ery [Ss]low|Muy lento/i,     'Muy lento'],
    [/\bFast\b|Rápido/i,               'Rápido'],
    [/\bAverage\b|Promedio/i,           'Promedio'],
    [/\bSlow\b|Lento/i,                'Lento'],
    [/\bCharge\b|Carga/i,              'Carga'],
    [/\bNinja\b.*[Cc]harge/i,          'Ninja (x3)'],
  ];
  for (const [re, label] of speedPatterns) {
    if (re.test(wikitext)) {
      result.manaSpeed = label;
      break;
    }
  }

  /* ---- FAMILIA ---- */
  const familyMatch = wikitext.match(/\|\s*family\s*=\s*([^\n\|]+)/i) ||
                      wikitext.match(/([A-Z][a-zA-Z\s]+)\s+[Ff]amily/);
  if (familyMatch) {
    const fam = familyMatch[1].trim().replace(/\[\[|\]\]/g, '');
    if (fam && fam.length < 40) result.family = fam;
  }

  /* ---- STATS (power, attack, defense, health) ---- */
  const statFields = [
    ['power',   /\|\s*(?:max)?[Pp]ower\s*=\s*(\d+)/],
    ['attack',  /\|\s*(?:max)?[Aa]ttack\s*=\s*(\d+)/],
    ['defense', /\|\s*(?:max)?[Dd]efense\s*=\s*(\d+)/],
    ['health',  /\|\s*(?:max)?[Hh]ealth\s*=\s*(\d+)/],
  ];
  for (const [field, re] of statFields) {
    const m = wikitext.match(re);
    if (m) result[field] = m[1];
  }

  /* ---- HABILIDAD ESPECIAL ---- */
  const skillNameMatch = wikitext.match(/\|\s*skill\s*=\s*([^\n\|]+)/i) ||
                         wikitext.match(/==\s*Special Skill\s*==\s*\n+[=]*\s*([^\n=]+)/i);
  if (skillNameMatch) {
    result.specialName = skillNameMatch[1].trim().replace(/\[\[|\]\]|''/g, '');
  }

  /* Descripción: buscar bloque de efectos */
  const effectsMatch = wikitext.match(/[Dd]eals\s+\d+%[^\n]{10,200}/);
  if (effectsMatch) {
    result.specialDesc = effectsMatch[0]
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  /* Solo devolver si tenemos al menos elemento o rareza */
  if (!result.element && !result.rarity && !result.heroClass) return null;
  return result;
}
