import { sql, init, getUser, send } from './_lib.js';
import { applyWrite } from './_rules.js';

const KEYS = ['stops', 'tickets', 'inspections'];
const CAN_WRITE = {
  stops: ['admin', 'inspector', 'dispatcher'],
  tickets: ['admin', 'inspector', 'dispatcher', 'citizen'],
  inspections: ['admin', 'inspector'],
};

export default async function handler(req, res) {
  try {
    await init();
    const user = await getUser(req);
    if (!user) return send(res, 401, { error: 'Требуется авторизация' });

    if (req.method === 'GET') {
      const rows = await sql`SELECT key, data FROM collections`;
      const out = Object.fromEntries(rows.map(r => [r.key, r.data]));
      out.notifications = (out.notifications || []).filter(n => n.userId === user.id).slice(-50);
      const users = await sql`SELECT id,name,email,phone,role,city,district,active FROM users ORDER BY created_at`;
      out.users = user.role === 'admin' ? users : users.map(({ id, name, role, city, district, active }) => ({ id, name, role, city, district, active }));
      return send(res, 200, out);
    }

    if (req.method === 'POST' && req.query.action === 'read') {
      const [row] = await sql`SELECT data FROM collections WHERE key='notifications'`;
      const data = (row?.data || []).map(n => n.userId === user.id ? { ...n, read: true } : n);
      await sql`INSERT INTO collections (key,data) VALUES ('notifications', ${JSON.stringify(data)}::jsonb) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
      return send(res, 200, { ok: true });
    }

    if (req.method === 'PUT') {
      const key = req.query.key;
      if (!KEYS.includes(key)) return send(res, 400, { error: 'Неизвестная коллекция' });
      if (!CAN_WRITE[key].includes(user.role)) return send(res, 403, { error: 'Недостаточно прав' });
      const rows = await sql`SELECT key, data FROM collections WHERE key IN ('stops','tickets','inspections','notifications')`;
      const col = Object.fromEntries(rows.map(r => [r.key, r.data]));
      const users = await sql`SELECT id,name,role,district FROM users`;
      const r = applyWrite(key, req.body, col[key] || [], user, { stops: col.stops || [], users });
      if (r.error) return send(res, 403, { error: r.error });
      await sql`INSERT INTO collections (key,data,updated_at) VALUES (${key}, ${JSON.stringify(r.data)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;
      if (r.notes.length) {
        const nn = (col.notifications || []).concat(r.notes).slice(-500);
        await sql`INSERT INTO collections (key,data) VALUES ('notifications', ${JSON.stringify(nn)}::jsonb) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data`;
      }
      return send(res, 200, { ok: true, data: r.data });
    }

    if (req.method === 'PATCH') {
      if (user.role !== 'admin') return send(res, 403, { error: 'Недостаточно прав' });
      const { id, role, active, district } = req.body || {};
      if (id === user.id) return send(res, 400, { error: 'Нельзя менять собственную учётную запись' });
      if (role !== undefined && !['admin', 'inspector', 'dispatcher', 'citizen'].includes(role)) return send(res, 400, { error: 'Неизвестная роль' });
      await sql`UPDATE users SET role=COALESCE(${role ?? null}, role), active=COALESCE(${typeof active === 'boolean' ? active : null}, active), district=COALESCE(${typeof district === 'string' ? district : null}, district) WHERE id=${id}`;
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: 'Метод не поддерживается' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Ошибка сервера' });
  }
}
