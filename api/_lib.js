import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import seed from './_seed.js';

export const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const DEFAULT_DEVICES = [
  {
    id: "dev-stm32-01",
    name: "Контроллер павильона Сенная (STM32F4)",
    stopId: "stop-vn-1",
    stopName: "Кремлёвский парк / Сенная площадь",
    city: "Великий Новгород",
    apiKey: "dkey_vn_sennaya_77a9b1c2",
    status: "online",
    installedDate: "2024-03-15",
    sensors: ["Освещение (люксометр)", "Удар / вибрация (акселерометр)", "Контроль табло (RS-485)", "Датчик двери шкафа"],
    firmware: "STM32-StopMon v1.4.2",
    lastSeen: "2026-10-30 23:30",
    lastEvent: "ping",
    lastDetails: "Штатный опрос датчиков, напряжение 4.1В"
  },
  {
    id: "dev-stm32-02",
    name: "Контроллер Вокзальная пл. (STM32F1)",
    stopId: "stop-vn-2",
    stopName: "Вокзальная площадь (Ж/Д Вокзал)",
    city: "Великий Новгород",
    apiKey: "dkey_vn_vokzal_92f4c3d8",
    status: "alarm",
    installedDate: "2023-11-20",
    sensors: ["Освещение (люксометр)", "Удар / вибрация", "Контроль расписания"],
    firmware: "STM32-StopMon v1.3.0",
    lastSeen: "2026-10-30 23:25",
    lastEvent: "light_failure",
    lastDetails: "Обрыв линии светодиодной подсветки расписания"
  },
  {
    id: "dev-stm32-03",
    name: "Контроллер Завод Волна (STM32F4)",
    stopId: "stop-vn-3",
    stopName: "Ул. Большая Санкт-Петербургская / Завод Волна",
    city: "Великий Новгород",
    apiKey: "dkey_vn_volna_33e1d5a7",
    status: "alarm",
    installedDate: "2024-01-10",
    sensors: ["Акустический датчик разбития", "Акселерометр MPU6050", "Освещение"],
    firmware: "STM32-StopMon v1.4.2",
    lastSeen: "2026-10-30 23:10",
    lastEvent: "impact",
    lastDetails: "Зафиксирован сильный механический удар 4.8g"
  }
];

let ready;
export function init() {
  return (ready ||= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, phone text,
      role text NOT NULL, city text, district text, active boolean DEFAULT true,
      password_hash text NOT NULL, created_at timestamptz DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS collections (
      key text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())`;
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
    if (!n) {
      const h = bcrypt.hashSync('demo1234', 8); // демо-пароль для seed-аккаунтов
      for (const u of seed.users) {
        await sql`INSERT INTO users (id,name,email,role,city,district,active,password_hash)
          VALUES (${u.id},${u.name},${u.email.toLowerCase()},${u.role},${u.city},${u.district},true,${h})
          ON CONFLICT DO NOTHING`;
      }
      for (const k of ['stops', 'tickets', 'inspections']) {
        await sql`INSERT INTO collections (key,data) VALUES (${k}, ${JSON.stringify(seed[k])}::jsonb) ON CONFLICT DO NOTHING`;
      }
    }
    const [devCheck] = await sql`SELECT 1 FROM collections WHERE key='devices'`;
    if (!devCheck) {
      await sql`INSERT INTO collections (key,data) VALUES ('devices', ${JSON.stringify(DEFAULT_DEVICES)}::jsonb) ON CONFLICT DO NOTHING`;
    }
  })().catch(e => { ready = null; throw e; }));
}

export const send = (res, code, body) => res.status(code).json(body);
export const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
export const setCookie = (res, token, age = 604800) =>
  res.setHeader('Set-Cookie', `sk=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${age}${process.env.VERCEL ? '; Secure' : ''}`);

export async function getUser(req) {
  const m = /(?:^|;\s*)sk=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  try {
    const { id } = jwt.verify(m[1], SECRET);
    const [u] = await sql`SELECT * FROM users WHERE id=${id} AND active`;
    return u || null;
  } catch { return null; }
}
