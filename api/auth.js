import bcrypt from 'bcryptjs';
import { sql, init, sign, getUser, send, setCookie } from './_lib.js';

const pub = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, city: u.city, district: u.district, active: u.active });

export default async function handler(req, res) {
  try {
    await init();
    const a = req.query.action;
    if (a === 'me') {
      const u = await getUser(req);
      return u ? send(res, 200, { user: pub(u) }) : send(res, 401, { error: 'Не авторизован' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Метод не поддерживается' });
    const b = req.body || {};
    if (a === 'logout') { setCookie(res, '', 0); return send(res, 200, { ok: true }); }
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (a === 'login') {
      const [u] = await sql`SELECT * FROM users WHERE email=${email}`;
      if (!u || !u.active || !bcrypt.compareSync(password, u.password_hash)) return send(res, 401, { error: 'Неверный email или пароль' });
      setCookie(res, sign(u));
      return send(res, 200, { user: pub(u) });
    }
    if (a === 'register') {
      const name = String(b.name || '').trim();
      if (name.length < 2) return send(res, 400, { error: 'Укажите ФИО' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Некорректный email' });
      if (password.length < 6) return send(res, 400, { error: 'Пароль — минимум 6 символов' });
      const [ex] = await sql`SELECT 1 FROM users WHERE email=${email}`;
      if (ex) return send(res, 409, { error: 'Пользователь с таким email уже существует' });
      const id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const [u] = await sql`INSERT INTO users (id,name,email,phone,role,city,district,password_hash)
        VALUES (${id},${name},${email},${String(b.phone || '')},'citizen',${String(b.city || '')},${String(b.district || '')},${bcrypt.hashSync(password, 10)})
        RETURNING *`;
      setCookie(res, sign(u));
      return send(res, 201, { user: pub(u) });
    }
    send(res, 404, { error: 'Неизвестное действие' });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Ошибка сервера' });
  }
}
