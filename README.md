# Mini Kripta · Empires & Puzzles 🗡️

> El bestiario de los infames — Wiki colaborativa de héroes de Empires & Puzzles

---

## Stack

- **Frontend**: HTML + CSS + JS vanilla (sin frameworks)
- **Backend**: Vercel Serverless Functions (`/api`)
- **Datos**: JSON en el propio repositorio de GitHub (via GitHub API)
- **Imágenes**: `/img/heroes/` en el repositorio
- **Email**: EmailJS (recuperación de contraseña)

---

## Estructura del proyecto

```
mini-kripta/
├── index.html          ← Página principal (listado de héroes)
├── login.html          ← Login
├── hero-detail.html    ← Detalle de héroe
├── hero-new.html       ← Formulario añadir/editar héroe
├── admin.html          ← Gestión de usuarios (solo admins)
├── css/
│   └── styles.css
├── js/
│   ├── auth.js         ← Gestión de sesión y roles
│   ├── utils.js        ← Utilidades: toast, hash, estrellas, compresión
│   ├── heroes.js       ← API de héroes (fetch)
│   ├── login.js
│   ├── index.js
│   ├── hero-detail.js
│   ├── hero-new.js
│   └── admin.js
├── img/heroes/         ← Imágenes de héroes (subidas automáticamente)
├── data/
│   ├── users.json      ← Usuarios y contraseñas (hash SHA-256)
│   └── heroes.json     ← Fichas de héroes
├── api/
│   ├── _helpers.js     ← GitHub API + utilidades backend
│   ├── _emailjs.js     ← Envío de emails
│   ├── login.js        ← POST /api/login
│   ├── heroes.js       ← CRUD /api/heroes
│   └── users.js        ← CRUD /api/users
├── vercel.json         ← Configuración de rutas Vercel
└── package.json
```

---

## Configuración inicial

### 1. Clonar y subir a GitHub

```bash
git clone <tu-repo>
cd mini-kripta
git add .
git commit -m "init"
git push
```

### 2. Crear GitHub Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generar token con scope `repo` (acceso completo al repositorio)
3. Guardar el token — solo se muestra una vez

### 3. Configurar variables de entorno en Vercel

En el dashboard de Vercel → tu proyecto → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | tu Personal Access Token de GitHub |
| `GITHUB_OWNER` | tu usuario de GitHub (ej: `davidgonzalez`) |
| `GITHUB_REPO`  | nombre del repo (ej: `mini-kripta`) |
| `GITHUB_BRANCH`| `main` |
| `APP_URL`      | URL de tu app en Vercel (ej: `https://mini-kripta.vercel.app`) |
| `EMAILJS_SERVICE_ID`  | ID del servicio en EmailJS |
| `EMAILJS_TEMPLATE_ID` | ID del template en EmailJS |
| `EMAILJS_PUBLIC_KEY`  | Clave pública de EmailJS |
| `EMAILJS_PRIVATE_KEY` | Clave privada de EmailJS |

### 4. Configurar EmailJS

1. Crear cuenta en [emailjs.com](https://www.emailjs.com)
2. Conectar cuenta Gmail (`aleyone@gmail.com`)
3. Crear template con variables:
   - `{{to_name}}` — nombre del usuario
   - `{{reset_url}}` — enlace de recuperación
   - `{{app_name}}` — Mini Kripta · Empires & Puzzles

### 5. Desplegar

Vercel detecta automáticamente el proyecto. Conectar el repo desde el dashboard de Vercel y desplegará en cada push a `main`.

---

## Usuarios iniciales

Todos con contraseña `123456` (SHA-256: `8d969eef...`). Deberán cambiarla en el primer acceso.

| Usuario | Rol |
|---|---|
| david | Admin |
| adrian | Admin |
| ray | Editor |
| chris | Editor |

---

## Roles

| Rol | Permisos |
|---|---|
| **Admin** | Todo: gestionar usuarios, subir/editar/borrar héroes |
| **Editor** | Subir, editar y borrar héroes |
| **Consultor** | Solo ver héroes |

---

## Notas técnicas

- Las contraseñas se hashean con SHA-256 en cliente antes de enviarse al servidor
- Las imágenes se comprimen automáticamente en el navegador a ≤400KB antes de subir
- El botón "Compartir" usa la [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) nativa del móvil
- Los meta tags Open Graph se actualizan dinámicamente para que el preview en WhatsApp muestre la imagen del héroe
