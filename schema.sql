-- EnergyLinkFlex: Neon Postgres Schema
-- Run against your Neon database to initialize tables

-- 1. User profiles (replaces Supabase auth.users + user_profiles)
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE NOT NULL,
  display_name        text NOT NULL DEFAULT '',
  avatar_url          text,
  password_hash       text,          -- NULL for Google OAuth users
  system_role         text NOT NULL DEFAULT 'member'
                      CHECK (system_role IN ('super_admin', 'admin', 'member')),
  provider            text NOT NULL DEFAULT 'email',
  reset_token         text,
  reset_token_expires timestamptz,
  last_sign_in_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  pdf_url      text,                -- Vercel Blob URL
  pdf_filename text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
