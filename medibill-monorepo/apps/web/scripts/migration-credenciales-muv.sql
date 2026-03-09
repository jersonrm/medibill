-- =====================================================================
-- MIGRACIÓN: Tabla credenciales_muv (MinSalud)
-- Almacena credenciales del prestador para el portal MUV
-- La contraseña se guarda encriptada con AES-256-GCM a nivel de app
-- Fecha: 2026-03-09
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.credenciales_muv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizacion_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  tipo_usuario TEXT NOT NULL DEFAULT '02',
  tipo_identificacion TEXT NOT NULL DEFAULT 'NIT',
  numero_identificacion TEXT NOT NULL,
  contrasena_encrypted TEXT NOT NULL,
  nit_prestador TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.credenciales_muv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own MUV credentials"
  ON public.credenciales_muv
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice
CREATE INDEX IF NOT EXISTS idx_credenciales_muv_user
  ON public.credenciales_muv(user_id);
