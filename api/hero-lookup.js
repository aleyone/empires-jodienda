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

    const fullWikitext = page?.revisions?.[0]?.slots?.main?.['*'] || '';
    if (!fullWikitext) return res.status(404).json({ error: 'Sin datos en la wiki' });

    /* Solo usar el primer bloque {{Hero}} — ignorar costumes */
    const firstHeroBlock = extractFirstHeroBlock(fullWikitext);

    return res.status(200).json(parseHeroWikitext(firstHeroBlock, heroName));

  } catch (err) {
    console.error('[hero-lookup]', err.message);
    return res.status(503).json({ error: 'Error al conectar con la wiki. Rellena manualmente.' });
  }
};

/* ---- Extrae solo el primer bloque {{Hero}} ---- */
function extractFirstHeroBlock(wikitext) {
  /* Encontrar primer {{Hero y cortar antes del segundo */
  const firstIdx = wikitext.indexOf('{{Hero');
  if (firstIdx === -1) return wikitext;

  /* Buscar el siguiente {{Hero que no sea el primero */
  const secondIdx = wikitext.indexOf('{{Hero', firstIdx + 6);
  if (secondIdx === -1) return wikitext; /* solo hay uno */

  /* Devolver desde el inicio hasta antes del segundo {{Hero */
  return wikitext.slice(0, secondIdx);
}

/* ---- PARSER ---- */
function parseHeroWikitext(wikitext, heroName) {
  const result = { name: heroName };

  /* Extrae |campo = valor — captura {{plantilla}} completa o texto plano */
  const field = (key) => {
    /* Primero intenta capturar {{...}} completo */
    const re1 = new RegExp(`\\|\\s*${key}\\s*=\\s*(\\{\\{[^}]+\\}\\})`, 'i');
    const m1  = wikitext.match(re1);
    if (m1) return m1[1].trim();
    /* Fallback: texto plano hasta | o \n */
    const re2 = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\|\\n{][^\\|\\n]*)`, 'i');
    const m2  = wikitext.match(re2);
    return m2 ? m2[1].trim() : null;
  };

  /* Limpia wikitext a texto plano */
  const clean = (s) => (s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<span[^>]*>([^<]*)<\/span>/gi, '$1')        /* <span>text</span> → text */
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')  /* [[link|text]] → text */
    .replace(/\{\{[^}]*\}\}/g, '')                       /* {{plantilla}} → '' */
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/•/g, '•')
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
    barbarian:'Bárbaro', bar:'Bárbaro', brb:'Bárbaro',
    cleric:'Clérigo', cle:'Clérigo', clr:'Clérigo',
    druid:'Druida', dru:'Druida', drd:'Druida',
    fighter:'Guerrero', fig:'Guerrero', fgt:'Guerrero',
    monk:'Monje', mon:'Monje', mnk:'Monje',
    paladin:'Paladín', pal:'Paladín', pld:'Paladín',
    ranger:'Ranger', ran:'Ranger', rng:'Ranger',
    rogue:'Pícaro', rog:'Pícaro', rog:'Pícaro',
    sorcerer:'Hechicero', sor:'Hechicero', src:'Hechicero',
    wizard:'Mago (Wizard)', wiz:'Mago (Wizard)', wzd:'Mago (Wizard)',
    titan:'Titán', tit:'Titán', ttn:'Titán'
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
    nin:'Ninja', ninja:'Ninja',
    cls:'Classic', classic:'Classic',
    classic:'Classic', cla:'Classic',
    atl:'Atlantis', atlantis:'Atlantis',
    val:'Valhalla', valhalla:'Valhalla',
    sla:'Slayer', slayer:'Slayer',
    tel:'Teltoc', teltoc:'Teltoc',
    won:'Wonderland', wonderland:'Wonderland',
    gri:'Grimforest', grimforest:'Grimforest',
    pir:'Pirates', pirates:'Pirates',
    sea:'Seasonal', seasonal:'Seasonal',
    san:'Sand Empire', sand:'Sand Empire',
    mor:'Morlovia', morlovia:'Morlovia',
    chr:'Christmas', christmas:'Christmas',
    vil:'Villains', villains:'Villains',
    mag:'Magic', magic:'Magic',
    stx:'Styx', styx:'Styx',
    leg:'Legends', legends:'Legends',
    car:'Carnival', carnival:'Carnival',
    cir:'Circus', circus:'Circus',
    cov:'Covenant', covenant:'Covenant',
    dun:'Dunes', dunes:'Dunes',
    sol:'Soul Exchange', soul:'Soul Exchange',
    unt:'Untold Tales', untold:'Untold Tales',
    nvr:'Nidavellir', nidavellir:'Nidavellir',
    mid:'Midgard', midgard:'Midgard',
    alf:'Alfheim', alfheim:'Alfheim',
    hel:'Helheim', helheim:'Helheim',
    jot:'Jotunheim', jotunheim:'Jotunheim',
    msp:'Muspelheim', muspelheim:'Muspelheim',
    nif:'Niflheim', niflheim:'Niflheim',
    svg:'Svartalfheim', svartalfheim:'Svartalfheim',
    lgn:'Lagoon', lagoon:'Lagoon',
    sak:'Sakura', sakura:'Sakura',
    def:'Defenders of Atlantis', nightmares:'Nightmares of Atlantis',
    tof:'Treasures of Flame', ddg:'Nidavellir'
  };
  if (famMatch) {
    result.family = famMap[famMatch[1].toLowerCase()] || famMatch[1];
  } else if (familyRaw) {
    const cleanFam = clean(familyRaw);
    if (cleanFam && cleanFam.length < 50) result.family = cleanFam;
  }
  /* Fallback: Category Family o Realm */
  if (!result.family) {
    const catFam = wikitext.match(/\[\[Category:([^\]]+?)\s+Family\]\]/i) ||
                   wikitext.match(/\[\[Category:([^\]]+?)\s+Realm\]\]/i);
    if (catFam) result.family = catFam[1].trim();
  }

  /* ---- STATS ---- */
  const power   = field('power');
  const attack  = field('attack');
  const defense = field('defense');
  const health  = field('health');
  const stripNum = (s) => s ? s.replace(/,/g,'').trim() : null;
  if (power   && /^\d+$/.test(stripNum(power)))   result.power   = stripNum(power);
  if (attack  && /^\d+$/.test(stripNum(attack)))  result.attack  = stripNum(attack);
  if (defense && /^\d+$/.test(stripNum(defense))) result.defense = stripNum(defense);
  if (health  && /^\d+$/.test(stripNum(health)))  result.health  = stripNum(health);

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
