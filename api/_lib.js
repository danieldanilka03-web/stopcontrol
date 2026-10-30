import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import seed from './_seed.js';

export const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
