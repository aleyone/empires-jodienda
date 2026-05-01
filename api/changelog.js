/* ============================================================
   changelog.js — Modal de novedades de versión
   ============================================================ */

const Changelog = (() => {

  async function check() {
    const session = Auth.getSession();
    if (!session) return;

    try {
      /* Obtener changelog */
      const res  = await fetch('/api/changelog');
      if (!res.ok) return;
      const data = await res.json();

      const currentVersion  = data.currentVersion;
      const lastSeenVersion = session.lastSeenVersion || null;

      /* Si ya vio esta versión, no mostrar */
      if (lastSeenVersion === currentVersion) return;

      /* Mostrar solo la versión más reciente */
      const latest = data.versions.find(v => v.version === currentVersion);
      if (!latest) return;

      showModal(latest, currentVersion);

    } catch { /* silencio */ }
  }

  function showModal(version, currentVersion) {
    const modal = document.getElementById('modal-changelog');
    if (!modal) return;

    document.getElementById('changelog-version').textContent  = `v${version.version}`;
    document.getElementById('changelog-title').textContent    = version.title;
    document.getElementById('changelog-date').textContent     = formatDate(version.date);

    const list = document.getElementById('changelog-list');
    list.innerHTML = version.changes
      .map(c => `<li style="padding:0.3rem 0;font-size:0.88rem;color:var(--text-secondary);line-height:1.5;">${escapeHtml(c)}</li>`)
      .join('');

    modal.style.display = 'block';
  }

  async function dismiss() {
    const modal = document.getElementById('modal-changelog');
    if (modal) modal.style.display = 'none';

    try {
      const res = await fetch('/api/changelog');
      const data = await res.json();
      const currentVersion = data.currentVersion;

      /* Guardar en servidor */
      await fetch('/api/changelog/seen', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-username': Auth.getUsername() },
        body:    JSON.stringify({ version: currentVersion })
      });

      /* Actualizar sesión local */
      const session = Auth.getSession();
      if (session) {
        session.lastSeenVersion = currentVersion;
        Auth.setSession(session);
      }
    } catch { /* silencio */ }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { check, dismiss };

})();

/* ---- Cargar versión en navbar y login ---- */
async function loadVersion() {
  try {
    const res  = await fetch('/api/changelog');
    if (!res.ok) return;
    const data = await res.json();
    const ver  = `v${data.currentVersion}`;

    const navEl   = document.getElementById('app-version-nav');
    const loginEl = document.getElementById('app-version-login');
    if (navEl)   navEl.textContent   = ver;
    if (loginEl) loginEl.textContent = ver;
  } catch { /* silencio */ }
}

/* Auto-ejecutar al cargar */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadVersion);
} else {
  loadVersion();
}
