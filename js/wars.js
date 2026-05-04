/* wars.js — Historial de guerras */

Auth.requireAuth(true);
Auth.initNavbar();

/* Mostrar botón nueva guerra solo a admins */
if (Auth.isAdmin && Auth.isAdmin()) {
  const btn = document.getElementById('btn-new-war');
  if (btn) btn.style.display = '';
}

const WAR_TYPES_ICONS = {
  'horda': '🧟',
  'zombi': '🧟',
  'carga': '⚡',
  'rápida': '⚡',
  'magia': '✨',
  'ataque': '⚔',
  'defensa': '🛡',
  'campo': '🏔',
};

function getWarIcon(type) {
  const lower = (type || '').toLowerCase();
  for (const [key, icon] of Object.entries(WAR_TYPES_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '⚔';
}

async function loadWars() {
  try {
    const res  = await fetch('/api/wars', { headers: { 'x-username': Auth.getUsername() || 'guest' } });
    const data = await res.json();
    const wars = data.wars || [];

    document.getElementById('wars-loading').style.display = 'none';
    const list = document.getElementById('wars-list');
    list.style.display = 'flex';

    if (wars.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="empty-state-icon">⚔</span><p class="empty-state-title">Sin guerras registradas</p></div>`;
      return;
    }

    list.innerHTML = wars.map(war => renderWarCard(war)).join('');

  } catch (err) {
    console.error(err);
    document.getElementById('wars-loading').innerHTML = '<p class="text-muted text-center">Error al cargar las guerras.</p>';
  }
}

function renderWarCard(war) {
  const won        = war.result?.won;
  const ourScore   = war.result?.ourScore || 0;
  const enemyScore = war.result?.enemyScore || 0;
  const enemyName  = war.result?.enemyName || 'Rival desconocido';
  const icon       = getWarIcon(war.type);
  const participants = war.participants || [];

  const topThree = [...participants]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return `
    <div style="background:var(--bg-card);border:1px solid ${won ? 'rgba(112,212,112,0.3)' : 'rgba(231,76,60,0.3)'};border-radius:var(--radius-lg);overflow:hidden;">

      <!-- Cabecera -->
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:1rem;background:${won ? 'rgba(112,212,112,0.05)' : 'rgba(231,76,60,0.05)'};">
        <div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:1.2rem;">${icon}</span>
            <span style="font-family:'Cinzel',serif;font-weight:700;font-size:0.95rem;color:var(--text-primary);">${war.type}</span>
            <span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;font-weight:700;background:${won ? 'rgba(112,212,112,0.2)' : 'rgba(231,76,60,0.2)'};color:${won ? '#70d470' : '#e74c3c'};">${won ? 'VICTORIA' : 'DERROTA'}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;">${formatDate(war.startDate)} · vs ${escapeHtml(enemyName)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'Cinzel',serif;font-size:1.1rem;font-weight:700;color:${won ? '#70d470' : 'var(--text-primary)'};">${ourScore} <span style="color:var(--text-muted);font-size:0.8rem;">vs</span> ${enemyScore}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${participants.length} participantes</div>
        </div>
      </div>

      <!-- Top 3 -->
      ${topThree.length > 0 ? `
      <div style="padding:0.75rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
        <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;">Top atacantes</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${topThree.map((p, i) => `
            <div style="display:flex;align-items:center;gap:0.4rem;background:var(--bg-surface);border-radius:var(--radius-sm);padding:0.3rem 0.6rem;">
              <span style="font-size:0.8rem;">${['🥇','🥈','🥉'][i]}</span>
              <span style="font-size:0.82rem;font-weight:600;color:var(--text-primary);">${escapeHtml(p.username)}</span>
              <span style="font-size:0.82rem;color:var(--gold);font-weight:700;">${p.points}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Lista completa (colapsable) -->
      <details style="padding:0.75rem 1.25rem;">
        <summary style="cursor:pointer;font-size:0.82rem;color:var(--text-muted);list-style:none;display:flex;align-items:center;gap:0.4rem;">
          <span>▶</span> Ver todos los participantes
        </summary>
        <div style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.3rem;">
          ${[...participants].sort((a,b) => b.points - a.points).map((p, i) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.5rem;border-radius:var(--radius-sm);background:${i%2===0 ? 'var(--bg-surface)' : 'transparent'};">
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:0.72rem;color:var(--text-muted);width:20px;text-align:right;">${i+1}.</span>
                <span style="font-size:0.85rem;color:var(--text-primary);">${escapeHtml(p.username)}</span>
              </div>
              <span style="font-size:0.85rem;font-weight:700;color:var(--gold);">${p.points} pts</span>
            </div>`).join('')}
        </div>
      </details>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- NUEVA GUERRA (admin) ---- */
document.getElementById('btn-new-war')?.addEventListener('click', () => {
  document.getElementById('modal-new-war').style.display = 'block';
});

document.getElementById('cancel-war-btn')?.addEventListener('click', () => {
  document.getElementById('modal-new-war').style.display = 'none';
});

document.getElementById('save-war-btn')?.addEventListener('click', async () => {
  const startDate  = document.getElementById('war-start-date').value;
  const endDate    = document.getElementById('war-end-date').value;
  const type       = document.getElementById('war-type').value.trim();
  const enemyName  = document.getElementById('war-enemy-name').value.trim();
  const ourScore   = parseInt(document.getElementById('war-our-score').value) || 0;
  const enemyScore = parseInt(document.getElementById('war-enemy-score').value) || 0;

  if (!startDate || !type) return showToast('Fecha y tipo son obligatorios', 'info');

  const btn = document.getElementById('save-war-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const res = await fetch('/api/wars', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-username': Auth.getUsername() },
      body:    JSON.stringify({
        startDate, endDate: endDate || startDate, type,
        result: { ourScore, enemyScore, enemyName, won: ourScore > enemyScore }
      })
    });
    if (!res.ok) throw new Error();
    showToast('Guerra creada ✓', 'success');
    document.getElementById('modal-new-war').style.display = 'none';
    loadWars();
  } catch {
    showToast('Error al crear la guerra', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar guerra';
  }
});

loadWars();
