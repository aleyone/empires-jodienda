/* api/notifications.js
   GET  /api/notifications?username=xxx  → notificaciones del usuario
   PUT  /api/notifications/:id           → marcar como leída
   DELETE /api/notifications/:id         → eliminar
*/

const { readNotifications, writeNotifications, checkRole } = require('./_helpers');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { id, username } = req.query;
  const callerUsername = req.headers['x-username'];

  if (!callerUsername) return res.status(401).json({ error: 'No autenticado' });

  try {
    switch (req.method) {

      /* ---- GET: notificaciones del usuario ---- */
      case 'GET': {
        const target = username || callerUsername;
        const { notifications } = await readNotifications();

        /* Filtrar por usuario destino */
        const users = await getUsers();
        const isAdmin = isAdminUser(callerUsername, users);
        const userNotifs = notifications.filter(n => {
          if (n.targetUser === callerUsername) return true;
          if (n.targetUser === 'admins' && isAdmin) return true;
          return false;
        });

        /* Ordenar por fecha desc */
        userNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({ notifications: userNotifs });
      }

      /* ---- PUT: marcar como leída ---- */
      case 'PUT': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        const { notifications, sha } = await readNotifications();
        const idx = notifications.findIndex(n => n.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Notificación no encontrada' });

        /* Solo el destinatario puede marcarla */
        if (notifications[idx].targetUser !== callerUsername &&
            notifications[idx].targetUser !== 'admins') {
          return res.status(403).json({ error: 'Sin permisos' });
        }

        notifications[idx].read = true;
        notifications[idx].readAt = new Date().toISOString();
        await writeNotifications(notifications, sha, `mark notification read: ${id}`);

        return res.status(200).json({ ok: true });
      }

      /* ---- DELETE: eliminar notificación ---- */
      case 'DELETE': {
        if (!id) return res.status(400).json({ error: 'id requerido' });
        const { notifications, sha } = await readNotifications();
        const idx = notifications.findIndex(n => n.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Notificación no encontrada' });

        notifications.splice(idx, 1);
        await writeNotifications(notifications, sha, `delete notification: ${id}`);

        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

async function getUsers() {
  const { readUsers } = require('./_helpers');
  const { users } = await readUsers();
  return users;
}

function isAdminUser(username, users) {
  const user = users.find(u => u.username === username);
  return user?.role === 'admin';
}
