/* alliance.js — Vista pública de la alianza */

Auth.requireAuth();
Auth.initNavbar();

/* Mostrar "Mi equipo" en menú si es editor/admin */
if (Auth.canEdit()) {
  const menuMyTeam = document.getElementById('menu-my-team');
  if (menuMyTeam) menuMyTeam.style.display = '';
}

const ELEMENT_ICONS = { fire:'🔥', ice:'❄️', nature:'🌿', dark:'💜', holy:'✨' };
const RARITY_STARS  = { '1':'⭐','2':'⭐⭐','3':'⭐⭐⭐','4':'⭐⭐⭐⭐','5':'⭐⭐⭐⭐⭐' };

async function loadAlliance() {
  try {
    /* Cargar equipos y héroes del bestiario en paralelo */
    const [teamsRes, heroesRes] = await Promise.all([
      fetch('/api/teams', { headers: { 'x-username': Auth.getUsername() } }),
      fetch('/api/heroes')
    ]);

    const teamsData  = await teamsRes.json();
    const heroesData = await heroesRes.json();
    const bestiario  = heroesData.heroes || [];

    document.getElementById('alliance-loading').style.display = 'none';
    const grid = document.getElementById('alliance-grid');
    grid.style.display = 'block';

    const teams = teamsData.teams || [];
    if (teams.length === 0) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚔</span><p class="empty-state-title">Aún no hay equipos</p></div>`;
      return;
    }

    grid.innerHTML = teams.map(team => renderMemberCard(team, bestiario)).join('');

  } catch (err) {
    console.error(err);
    document.getElementById('alliance-loading').innerHTML = '<p class="text-muted text-center">Error al cargar la alianza.</p>';
  }
}

function renderMemberCard(team, bestiario) {
  const initial = team.username.charAt(0).toUpperCase();
  const slots   = [1,2,3,4,5].map(pos => {
    const slot = team.heroes.find(h => h.position === pos);
    if (!slot) return `<div style="width:56px;height:70px;background:var(--bg-surface);border:1px dashed var(--border-subtle);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.2rem;">+</div>`;

    /* Resolver datos del héroe */
    let hero = null;
    if (slot.heroId) hero = bestiario.find(h => h.id === slot.heroId);
    const data     = hero || slot.heroData || {};
    const imgPath  = data.imagePath || null;
    const element  = ELEMENT_ICONS[data.element] || '⚔';
    const name     = data.name || '?';

    return `
      <div style="position:relative;width:56px;" title="${name}">
        ${imgPath
          ? `<img src="${imgPath}" style="width:56px;height:70px;object-fit:cover;object-position:top;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">`
          : `<div style="width:56px;height:70px;background:var(--bg-surface);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">${element}</div>`
        }
        <div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:0.55rem;color:white;background:rgba(0,0,0,0.6);border-radius:0 0 var(--radius-sm) var(--radius-sm);padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      </div>`;
  }).join('');

  return `
    <div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:1.25rem;margin-bottom:1rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
        <div class="user-avatar" style="width:40px;height:40px;font-size:1rem;">${initial}</div>
        <div>
          <div style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;color:var(--text-primary);">${team.username}</div>
          ${team.updatedAt ? `<div style="font-size:0.72rem;color:var(--text-muted);">Actualizado ${formatDate(team.updatedAt)}</div>` : ''}
        </div>
        ${Auth.isAdmin() ? `<a href="my-team.html?user=${team.username}" class="btn btn-ghost btn-sm" style="margin-left:auto;">Editar</a>` : ''}
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">${slots}</div>
    </div>`;
}

loadAlliance();
