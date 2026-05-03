/* ============================================================
   chat.js — Chat de alianza con Firebase Realtime Database
   ============================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyCLUyEKZOkxhgmQBabX5XXtPKUwMf96Cxw",
  authDomain:        "mini-kripta.firebaseapp.com",
  databaseURL:       "https://mini-kripta-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "mini-kripta",
  storageBucket:     "mini-kripta.firebasestorage.app",
  messagingSenderId: "615586549925",
  appId:             "1:615586549925:web:46e2372250bbd2e01e7d4c"
};

const Chat = (() => {
  let db          = null;
  let unreadCount = 0;
  let isOpen      = false;
  let initialized = false;
  let lastSeenTimestamp = parseInt(localStorage.getItem('mk_chat_last_seen') || '0');

  /* ---- Inicializar Firebase ---- */
  async function init() {
    if (initialized) return;

    /* Cargar Firebase SDK dinámicamente */
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');

    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    initialized = true;

    renderChatUI();
    listenMessages();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ---- Render UI del chat ---- */
  function renderChatUI() {
    const isGuest   = Auth.isGuest();
    const username  = Auth.getUsername() || 'Invitado';

    const wrapper = document.createElement('div');
    wrapper.id    = 'chat-wrapper';
    wrapper.innerHTML = `
      <!-- Botón flotante -->
      <button id="chat-toggle" onclick="Chat.toggle()" title="Chat de alianza"
        style="position:fixed;bottom:1.25rem;right:1.25rem;width:52px;height:52px;border-radius:50%;background:var(--gold);color:#0a0810;border:none;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(201,149,42,0.4);z-index:400;transition:all var(--transition);">
        💬
        <span id="chat-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#e74c3c;color:white;font-size:0.6rem;font-weight:700;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 3px;font-family:'Nunito',sans-serif;"></span>
      </button>

      <!-- Panel del chat -->
      <div id="chat-panel" style="display:none;position:fixed;bottom:5rem;right:1.25rem;width:320px;max-width:calc(100vw - 2rem);height:420px;background:var(--bg-card);border:1px solid var(--border-gold);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);z-index:399;display:none;flex-direction:column;overflow:hidden;">

        <!-- Header -->
        <div style="padding:0.85rem 1rem;border-bottom:1px solid var(--border-gold);display:flex;align-items:center;justify-content:space-between;background:rgba(201,149,42,0.06);">
          <span style="font-family:'Cinzel',serif;font-size:0.85rem;font-weight:600;color:var(--gold);">⚔ Chat de la Alianza</span>
          <button onclick="Chat.toggle()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;">✕</button>
        </div>

        <!-- Mensajes -->
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem;">
          <div style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:1rem;">Cargando mensajes...</div>
        </div>

        <!-- Input -->
        ${isGuest ? `
          <div style="padding:0.75rem;border-top:1px solid var(--border-subtle);text-align:center;font-size:0.78rem;color:var(--text-muted);">
            <a href="login.html" style="color:var(--gold);">Inicia sesión</a> para participar en el chat
          </div>
        ` : `
          <div style="padding:0.75rem;border-top:1px solid var(--border-subtle);display:flex;gap:0.5rem;">
            <input type="text" id="chat-input" placeholder="Escribe un mensaje..."
              style="flex:1;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;color:var(--text-primary);font-size:0.85rem;font-family:'Nunito',sans-serif;outline:none;"
              onkeydown="if(event.key==='Enter')Chat.send()">
            <button onclick="Chat.send()"
              style="background:var(--gold);color:#0a0810;border:none;border-radius:var(--radius-sm);padding:0.5rem 0.75rem;cursor:pointer;font-weight:700;font-size:0.85rem;">➤</button>
          </div>
        `}
      </div>`;

    document.body.appendChild(wrapper);
  }

  /* ---- Escuchar mensajes en tiempo real ---- */
  function listenMessages() {
    const ref = db.ref('chat/messages').limitToLast(50);
    ref.on('value', snapshot => {
      const data     = snapshot.val() || {};
      const messages = Object.entries(data)
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => a.timestamp - b.timestamp);

      renderMessages(messages);

      /* Contar no leídos */
      if (!isOpen) {
        unreadCount = messages.filter(m => m.timestamp > lastSeenTimestamp).length;
        updateBadge();
      }
    });
  }

  /* ---- Renderizar mensajes ---- */
  function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const username = Auth.getUsername() || '';

    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.78rem;padding:1rem;">Sin mensajes aún. ¡Sé el primero!</div>';
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isOwn = msg.username === username;
      const time  = new Date(msg.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const date  = new Date(msg.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      const initial = (msg.username.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/) || ['?'])[0].toUpperCase();

      return `
        <div style="display:flex;gap:0.5rem;align-items:flex-end;${isOwn ? 'flex-direction:row-reverse;' : ''}">
          ${!isOwn ? `<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-surface);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0;">${initial}</div>` : ''}
          <div style="max-width:75%;">
            ${!isOwn ? `<div style="font-size:0.7rem;color:var(--gold);margin-bottom:0.2rem;font-weight:600;">${escapeHtml(msg.username)}</div>` : ''}
            <div style="background:${isOwn ? 'var(--gold)' : 'var(--bg-surface)'};color:${isOwn ? '#0a0810' : 'var(--text-primary)'};padding:0.5rem 0.75rem;border-radius:${isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};font-size:0.85rem;line-height:1.4;word-break:break-word;">
              ${escapeHtml(msg.text)}
            </div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:0.2rem;${isOwn ? 'text-align:right;' : ''}">${date} ${time}</div>
          </div>
        </div>`;
    }).join('');

    /* Scroll al final */
    container.scrollTop = container.scrollHeight;
  }

  /* ---- Enviar mensaje ---- */
  async function send() {
    const input    = document.getElementById('chat-input');
    const text     = input?.value.trim();
    const username = Auth.getUsername();

    if (!text || !username || !db) return;

    input.value = '';

    try {
      await db.ref('chat/messages').push({
        username,
        text,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[chat] Error al enviar:', err);
    }
  }

  /* ---- Abrir/cerrar ---- */
  function toggle() {
    const panel = document.getElementById('chat-panel');
    const btn   = document.getElementById('chat-toggle');
    if (!panel) return;

    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    btn.style.background = isOpen ? 'var(--bg-surface)' : 'var(--gold)';
    btn.style.color      = isOpen ? 'var(--gold)' : '#0a0810';
    btn.style.border     = isOpen ? '1px solid var(--border-gold)' : 'none';

    if (isOpen) {
      unreadCount = 0;
      updateBadge();
      lastSeenTimestamp = Date.now();
      localStorage.setItem('mk_chat_last_seen', lastSeenTimestamp);
      /* Scroll al final */
      setTimeout(() => {
        const messages = document.getElementById('chat-messages');
        if (messages) messages.scrollTop = messages.scrollHeight;
      }, 50);
      /* Focus input */
      document.getElementById('chat-input')?.focus();
    }
  }

  /* ---- Badge de no leídos ---- */
  function updateBadge() {
    const badge = document.getElementById('chat-badge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent   = unreadCount > 9 ? '9+' : unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, toggle, send };
})();
