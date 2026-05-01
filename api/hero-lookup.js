/* api/hero-lookup.js — Busca héroe en wiki E&P y traduce con Claude */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { name } = req.query;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Nombre requerido' });

  const heroName = name.trim();

  try {
    /* 1. Obtener wikitext via MediaWiki API */
    const url = `https://empiresandpuzzles.fandom.com/api.php?` +
      `action=query&titles=${encodeURIComponent(heroName)}&prop=revisions&rvprop=content&format=json&rvslots=main`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mini-Kripta-EpFanTool/1.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) return res.status(404).json({ error: 'No se pudo conectar con la wiki' });

    const data  = await response.json();
    const pages = data?.query?.pages;
    if (!pages) return res.status(404).json({ error: 'Héroe no encontrado' });

    const page = Object.values(pages)[0];
    if (page.missing !== undefined) return res.status(404).json({ error: `"${heroName}" no existe en la wiki` });

    const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] ||
                     page?.revisions?.[0]?.['*'] || '';

    if (!wikitext) return res.status(404).json({ error: 'Sin datos en la wiki' });

    /* 2. Parsear wikitext */
    const parsed = parseHeroWikitext(wikitext, heroName);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('[hero-lookup]', err.message);
    return res.status(503).json({ error: 'Error al conectar con la wiki. Rellena manualmente.' });
  }
};

/* ---- Parser de wikitext ---- */
function parseHeroWikitext(wikitext, heroName) {
  const result = { name: heroName };

  /* Limpiar función helper */
  const clean = (s) => s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  /* Extraer campo de plantilla */
  const getField = (...keys) => {
    for (const key of keys) {
      const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\|\\}\\n<]+)`, 'i');
      const m  = wikitext.match(re);
      if (m) {
        const val = clean(m[1]);
        if (val && !val.startsWith('{') && val.length < 100) return val;
      }
    }
    return null;
  };

  /* ---- ELEMENTO ---- */
  const colorMap = {
    'fire':'fire','red':'fire','rojo':'fire',
    'ice':'ice','blue':'ice','hielo':'ice',
    'nature':'nature','green':'nature','naturaleza':'nature',
    'dark':'dark','purple':'dark','oscuridad':'dark',
    'holy':'holy','yellow':'holy','sagrado':'holy'
  };
  const colorRaw = getField('color','element','Color','Element');
  if (colorRaw) result.element = colorMap[colorRaw.toLowerCase()] || null;
  if (!result.element) {
    const lw = wikitext.slice(0,3000).toLowerCase();
    if      (lw.includes('|color=fire') || lw.includes('fire hero'))    result.element = 'fire';
    else if (lw.includes('|color=ice')  || lw.includes('ice hero'))     result.element = 'ice';
    else if (lw.includes('|color=nature')|| lw.includes('nature hero')) result.element = 'nature';
    else if (lw.includes('|color=dark') || lw.includes('dark hero'))    result.element = 'dark';
    else if (lw.includes('|color=holy') || lw.includes('holy hero'))    result.element = 'holy';
    else if (/category:ice heroes/i.test(wikitext))    result.element = 'ice';
    else if (/category:fire heroes/i.test(wikitext))   result.element = 'fire';
    else if (/category:nature heroes/i.test(wikitext)) result.element = 'nature';
    else if (/category:dark heroes/i.test(wikitext))   result.element = 'dark';
    else if (/category:holy heroes/i.test(wikitext))   result.element = 'holy';
  }

  /* ---- RAREZA ---- */
  const starsRaw = getField('stars','rarity','Stars','Rarity');
  if (starsRaw) { const n = starsRaw.match(/(\d)/); if (n) result.rarity = n[1]; }
  if (!result.rarity) {
    if (/category:5 star heroes/i.test(wikitext) || /legendary/i.test(wikitext.slice(0,1000))) result.rarity = '5';
    else if (/category:4 star heroes/i.test(wikitext) || /epic hero/i.test(wikitext.slice(0,1000))) result.rarity = '4';
    else if (/category:3 star heroes/i.test(wikitext)) result.rarity = '3';
  }

  /* ---- CLASE — buscar en Categories ---- */
  const classMap = {
    'barbarian':'Bárbaro','cleric':'Clérigo','druid':'Druida',
    'fighter':'Guerrero','monk':'Monje','paladin':'Paladín',
    'ranger':'Ranger','rogue':'Pícaro','sorcerer':'Hechicero',
    'wizard':'Mago (Wizard)','titan':'Titán'
  };
  const classRaw = getField('class','Class','hero_class','heroClass');
  if (classRaw) result.heroClass = classMap[classRaw.toLowerCase()] || classRaw;
  if (!result.heroClass) {
    for (const [eng, esp] of Object.entries(classMap)) {
      if (new RegExp(`category:${eng}`, 'i').test(wikitext) ||
          new RegExp(`\\b${eng}\\b`, 'i').test(wikitext.slice(0,2000))) {
        result.heroClass = esp; break;
      }
    }
  }

  /* ---- VELOCIDAD ---- */
  const speedMap = {
    'very fast':'Muy rápido','fast':'Rápido','average':'Promedio',
    'slow':'Lento','very slow':'Muy lento','charge':'Carga','ninja':'Ninja (x3)'
  };
  const speedRaw = getField('speed','mana_speed','manaSpeed','Speed','Manaspeed');
  if (speedRaw) result.manaSpeed = speedMap[speedRaw.toLowerCase()] || speedRaw;
  if (!result.manaSpeed) {
    const speedText = wikitext.slice(0,3000).toLowerCase();
    if      (speedText.includes('very fast'))  result.manaSpeed = 'Muy rápido';
    else if (speedText.includes('very slow'))  result.manaSpeed = 'Muy lento';
    else if (speedText.includes('|speed=fast') || /\bfast\b/.test(speedText)) result.manaSpeed = 'Rápido';
    else if (speedText.includes('average'))    result.manaSpeed = 'Promedio';
    else if (speedText.includes('|speed=slow') || /\bslow\b/.test(speedText)) result.manaSpeed = 'Lento';
    else if (speedText.includes('charge'))     result.manaSpeed = 'Carga';
    else if (speedText.includes('ninja'))      result.manaSpeed = 'Ninja (x3)';
  }

  /* ---- FAMILIA ---- */
  const familyRaw = getField('family','Family','origin','Origin');
  if (familyRaw && !familyRaw.includes('{') && familyRaw.length < 50) {
    result.family = familyRaw;
  }
  if (!result.family) {
    /* Buscar en categories: "Ninja Family", "Slayer Family"... */
    const famMatch = wikitext.match(/\[\[Category:([^\]]+?)\s+Family\]\]/i);
    if (famMatch) result.family = famMatch[1].trim();
  }

  /* ---- STATS ---- */
  const power   = getField('power','teamcost','maxpower','max_power','Power','TeamCost');
  const attack  = getField('attack','atk','maxattack','max_attack','Attack');
  const defense = getField('defense','def','maxdefense','Defence','Defense');
  const health  = getField('health','hp','maxhealth','max_health','Health');
  if (power   && /^\d+$/.test(power.trim()))   result.power   = power.trim();
  if (attack  && /^\d+$/.test(attack.trim()))  result.attack  = attack.trim();
  if (defense && /^\d+$/.test(defense.trim())) result.defense = defense.trim();
  if (health  && /^\d+$/.test(health.trim()))  result.health  = health.trim();

  /* ---- HABILIDAD: nombre ---- */
  const skillRaw = getField('skill','special','skillname','skill_name','Special','Skill','skillName');
  if (skillRaw && skillRaw.length < 80) result.specialName = skillRaw;

  /* ---- HABILIDAD: descripción — buscar sección Special Skill ---- */
  /* Extraer bloque entre == Special Skill == y la siguiente sección */
  const skillSection = wikitext.match(/==\s*Special Skill\s*==\s*([\s\S]*?)(?:==|$)/i);
  if (skillSection) {
    const block = skillSection[1];
    /* Buscar bullet points con efectos */
    const bullets = [...block.matchAll(/[*•]\s*([^\n*•]{10,300})/g)].map(m => clean(m[1]));
    if (bullets.length > 0) {
      result.specialDesc = bullets.slice(0, 4).join(' • ');
    }
  }

  /* Fallback: buscar primer efecto */
  if (!result.specialDesc) {
    const effectMatch = wikitext.match(/Deals\s+\d+%[^<\n]{10,300}/i) ||
                        wikitext.match(/All allies[^<\n]{10,200}/i) ||
                        wikitext.match(/The target[^<\n]{10,200}/i);
    if (effectMatch) result.specialDesc = clean(effectMatch[0]);
  }

  return result;
}
