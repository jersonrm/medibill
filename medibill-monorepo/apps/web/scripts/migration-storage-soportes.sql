-- ============================================================
-- Migration: Supabase Storage bucket para soportes de glosas
-- Usado por respuesta-glosas.ts → subirSoporteGlosa()
-- ============================================================

-- Crear bucket (ejecutar en Supabase Dashboard > Storage o via API)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'soportes-glosas',
  'soportes-glosas',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: solo el dueño puede subir/ver/borrar sus archivos
-- Path pattern: {user_id}/{glosa_id}/{filename}

CREATE POLICY "Usuarios suben soportes a su carpeta"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'soportes-glosas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios ven sus soportes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'soportes-glosas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuarios eliminan sus soportes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'soportes-glosas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
