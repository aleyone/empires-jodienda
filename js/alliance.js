/* alliance.js — Vista pública de la alianza con estadísticas de guerra */

Auth.requireAuth(true);
Auth.initNavbar();

if (Auth.canEdit && Auth.canEdit()) {
  const menuMyTeam = document.getElementById('menu-my-team');
  if (menuMyTeam) menuMyTeam.style.display = '';
}

const ELEMENT_ICONS = { fire:'🔥', ice:'❄️', nature:'🌿', dark:'💜', holy:'✨' };

let allTeams    = [];
let allUsers    = [];
let allWars     = [];
let bestiario   = [];
let activeFilter = 'all'; /* all | war | nowar */
let activeSort   = 'name'; /* name | lastWar | totalPoints | participations */

async function loadAlliance() {
  try {
    const [teamsRes, heroesRes, usersRes, warsRes] = await Promise.all([
      fetch('/api/teams',  { headers: { 'x-username': Auth.getUsername() || 'guest' } }),
      fetch('/api/heroes'),
      fetch('/api/users',  { headers: { 'x-username': Auth.getUsername() || 'guest' } }),
      fetch('/api/wars',   { headers: { 'x-username': Auth.getUsername() || 'guest' } })
    ]);

    const teamsData = await teamsRes.json();
    const heroesData= await heroesRes.json();
    const usersData = await usersRes.json();
    const warsData  = await warsRes.json();

    bestiario = heroesData.heroes || [];
    allUsers  = usersData.users   || [];
    allWars   = warsData.wars     || [];
    allTeams  = teamsData.teams   || [];

    document.getElementById('alliance-loading').style.display = 'none';
    renderFilters();
    renderAlliance();

  } catch (err) {
    console.error(err);
    document.getElementById('alliance-loading').innerHTML = '<p class="text-muted text-center">Error al cargar la alianza.</p>';
  }
}

/* ---- Calcular stats de guerra por usuario ---- */
function getWarStats(username) {
  let totalPoints   = 0;
  let participations = 0;
  let lastWarPoints  = null;
  let lastWarDate    = null;

  /* Ordenar guerras por fecha desc */
  const sorted = [...allWars].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  for (const war of sorted) {
    const participant = war.participants?.find(p => p.username === username);
    if (participant) {
      totalPoints    += participant.points;
      participations += 1;
      if (lastWarPoints === null) {
        lastWarPoints = participant.points;
        lastWarDate   = war.startDate;
      }
    }
  }

  return { totalPoints, participations, lastWarPoints, lastWarDate };
}

/* ---- Filtros y ordenación ---- */
function renderFilters() {
  const grid = document.getElementById('alliance-grid');

  const filtersHtml = `
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1.25rem;align-items:center;">
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-sm ${activeFilter==='all'?'btn-primary':'btn-ghost'}" onclick="setFilter('all')">Todos</button>
        <button class="btn btn-sm ${activeFilter==='war'?'btn-primary':'btn-ghost'}" onclick="setFilter('war')">⚔ En guerra</button>
        <button class="btn btn-sm ${activeFilter==='nowar'?'btn-primary':'btn-ghost'}" onclick="setFilter('nowar')">Sin guerra</button>
      </div>
      <select class="form-control" style="width:auto;font-size:0.82rem;padding:0.3rem 0.6rem;" onchange="setSort(this.value)">
        <option value="name"           ${activeSort==='name'?'selected':''}>Nombre</option>
        <option value="lastWar"        ${activeSort==='lastWar'?'selected':''}>Puntos última guerra</option>
        <option value="totalPoints"    ${activeSort==='totalPoints'?'selected':''}>Puntos totales</option>
        <option value="participations" ${activeSort==='participations'?'selected':''}>Participaciones</option>
      </select>
    </div>`;

  /* Insertar filtros antes del grid */
  let filtersEl = document.getElementById('alliance-filters');
  if (!filtersEl) {
    filtersEl = document.createElement('div');
    filtersEl.id = 'alliance-filters';
    grid.parentNode.insertBefore(filtersEl, grid);
  }
  filtersEl.innerHTML = filtersHtml;
}

window.setFilter = (f) => { activeFilter = f; renderFilters(); renderAlliance(); };
window.setSort   = (s) => { activeSort   = s; renderAlliance(); };

function renderAlliance() {
  const grid = document.getElementById('alliance-grid');
  grid.style.display = 'block';

  /* Filtrar usuarios editor/admin */
  let members = allUsers.filter(u => ['admin','editor'].includes(u.role));

  /* Aplicar filtro */
  if (activeFilter === 'war')   members = members.filter(u => u.warParticipant);
  if (activeFilter === 'nowar') members = members.filter(u => !u.warParticipant);

  /* Calcular stats */
  const membersWithStats = members.map(u => ({
    ...u,
    warStats: getWarStats(u.username)
  }));

  /* Ordenar */
  membersWithStats.sort((a, b) => {
    switch (activeSort) {
      case 'lastWar':        return (b.warStats.lastWarPoints || -1) - (a.warStats.lastWarPoints || -1);
      case 'totalPoints':    return b.warStats.totalPoints - a.warStats.totalPoints;
      case 'participations': return b.warStats.participations - a.warStats.participations;
      default:               return a.username.localeCompare(b.username);
    }
  });

  if (membersWithStats.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚔</span><p class="empty-state-title">Sin miembros</p></div>`;
    return;
  }

  grid.innerHTML = membersWithStats.map(member => renderMemberCard(member)).join('');
}

function renderMemberCard(member) {
  const team        = allTeams.find(t => t.username.toLowerCase() === member.username.toLowerCase());
  const displayName = member.allianceName || member.username;
  const initial     = (displayName.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/) || ['?'])[0].toUpperCase();
  const stats       = member.warStats;

  const slots = [1,2,3,4,5].map(pos => {
    const slot = team?.heroes?.find(h => h.position === pos);
    if (!slot) return `<div style="width:52px;height:65px;background:var(--bg-surface);border:1px dashed var(--border-subtle);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1rem;">+</div>`;

    let hero = null;
    if (slot.heroId) hero = bestiario.find(h => h.id === slot.heroId);
    const data    = hero || slot.heroData || {};
    const imgPath = data.imagePath || null;
    const name    = data.name || '?';
    const element = ELEMENT_ICONS[data.element] || '⚔';

    return `
      <div style="position:relative;width:52px;" title="${name}">
        ${imgPath
          ? `<img src="${imgPath}" style="width:52px;height:65px;object-fit:cover;object-position:top;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">`
          : `<div style="width:52px;height:65px;background:var(--bg-surface);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">${element}</div>`
        }
        <div style="position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:0.5rem;color:white;background:rgba(0,0,0,0.65);border-radius:0 0 var(--radius-sm) var(--radius-sm);padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      </div>`;
  }).join('');

  return `
    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:1.1rem;margin-bottom:0.75rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.85rem;">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <div class="user-avatar" style="width:40px;height:40px;font-size:1rem;flex-shrink:0;">${initial}</div>
          <div>
            <div style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;color:var(--text-primary);">${escapeHtml(displayName)}</div>
            ${member.allianceName ? `<div style="font-size:0.72rem;color:var(--text-muted);">${escapeHtml(member.username)}</div>` : ''}
            <div style="display:flex;gap:0.4rem;margin-top:0.25rem;flex-wrap:wrap;">
              ${member.warParticipant
                ? `<span style="font-size:0.7rem;color:var(--gold);">⚔ En guerra</span>`
                : `<span style="font-size:0.7rem;color:var(--text-muted);">— Sin guerra</span>`}
              ${member.warParticipant && stats.participations > 0 ? `
                <span style="font-size:0.7rem;color:var(--text-muted);">·</span>
                <span style="font-size:0.7rem;color:var(--text-secondary);">${stats.participations} guerras</span>
              ` : ''}
            </div>
          </div>
        </div>
        <!-- Stats de guerra -->
        ${member.warParticipant && stats.participations > 0 ? `
          <div style="text-align:right;flex-shrink:0;">
            ${stats.lastWarPoints !== null ? `
              <div style="font-size:0.72rem;color:var(--text-muted);">Última guerra</div>
              <div style="font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:var(--gold);">${stats.lastWarPoints} pts</div>
            ` : ''}
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.15rem;">Total: <strong style="color:var(--text-secondary);">${stats.totalPoints} pts</strong></div>
          </div>
        ` : ''}
      </div>

      <!-- Equipo -->
      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">${slots}</div>

      ${Auth.isAdmin && Auth.isAdmin() ? `<a href="my-team.html?user=${member.username}" class="btn btn-ghost btn-sm" style="margin-top:0.75rem;font-size:0.75rem;">Editar equipo</a>` : ''}
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadAlliance();
