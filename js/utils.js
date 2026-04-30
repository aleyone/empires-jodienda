/* ============================================================
   utils.js — Utilidades compartidas
   ============================================================ */

/* ---- TOAST ---- */
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ---- SHA-256 (para hashes de contraseña en cliente) ---- */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---- ESTRELLAS ---- */
function renderStarsReadonly(container, value, type = 'gold') {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.className = 'star stars-readonly' + (i <= value ? (type === 'red' ? ' filled-red' : ' filled') : '');
    s.textContent = '★';
    container.appendChild(s);
  }
}

function initStarRating(container, onSelect) {
  if (!container) return;
  const stars = container.querySelectorAll('.star');

  const paint = (n) => {
    stars.forEach((s, i) => {
      s.classList.toggle('filled', i < n);
    });
  };

  stars.forEach((s) => {
    s.addEventListener('mouseenter', () => paint(+s.dataset.index));
    s.addEventListener('mouseleave', () => paint(+(container.dataset.value || 0)));
    s.addEventListener('click', () => {
      const v = +s.dataset.index;
      container.dataset.value = v;
      paint(v);
      if (onSelect) onSelect(v);
    });
  });

  paint(+(container.dataset.value || 0));
}

/* ---- COMPRESIÓN DE IMAGEN ---- */
function compressImage(file, maxKB = 400) {
  return new Promise((resolve, reject) => {
    const maxBytes = maxKB * 1024;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        /* Escala máxima inicial: 1200px en el lado largo */
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
        }

        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        /* Itera reduciendo calidad hasta cumplir límite */
        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Error al comprimir'));
            if (blob.size <= maxBytes || quality <= 0.2) {
              const url = URL.createObjectURL(blob);
              resolve({ blob, url, size: blob.size });
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---- ELEMENTO → EMOJI y LABEL ---- */
const ELEMENT_MAP = {
  fire:   { label: '🔥 Fuego',       cls: 'element-fire'   },
  ice:    { label: '❄️ Hielo',        cls: 'element-ice'    },
  nature: { label: '🌿 Naturaleza',   cls: 'element-nature' },
  dark:   { label: '💜 Oscuridad',    cls: 'element-dark'   },
  holy:   { label: '✨ Sagrado',      cls: 'element-holy'   }
};

function elementBadgeHtml(element) {
  const e = ELEMENT_MAP[element];
  if (!e) return '';
  return `<span class="element-badge ${e.cls}">${e.label}</span>`;
}

/* ---- RAREZA → ESTRELLAS ---- */
function rarityStars(n) {
  return '⭐'.repeat(parseInt(n) || 0);
}

/* ---- FORMAT DATE ---- */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---- GENERAR ID ÚNICO ---- */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---- SLUGIFY (para URLs) ---- */
function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
