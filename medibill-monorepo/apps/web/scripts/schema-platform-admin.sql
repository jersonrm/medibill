-- =====================================================================
-- SCHEMA: Platform Admins — Medibill
-- Super-administradores de la plataforma (no confundir con roles de org)
-- Acceso exclusivo a /admin/* para gestión global de organizaciones,
-- suscripciones y métricas.
-- =====================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SIN RLS — acceso solo vía service role key desde server actions
