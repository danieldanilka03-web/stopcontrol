-- Справочно: таблицы создаются автоматически при первом обращении к API.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, phone text,
  role text NOT NULL CHECK (role IN ('admin','inspector','dispatcher','citizen')),
  city text, district text, active boolean DEFAULT true,
  password_hash text NOT NULL, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collections (
  key text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now()
);
