-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Actualizar dimensión de embeddings de 768 a 3072
--
-- El modelo text-embedding-004 (768d) fue deprecado.
-- gemini-embedding-001 produce 3072 dimensiones.
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- 1. Eliminar índices IVFFlat existentes (no se puede ALTER tipo de columna con índices)
DROP INDEX IF EXISTS idx_cups_maestro_embedding;
DROP INDEX IF EXISTS idx_cie10_maestro_embedding;

-- 2. Eliminar funciones que referencian vector(768)
DROP FUNCTION IF EXISTS buscar_cups_hibrido(TEXT, vector, INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cie10_hibrido(TEXT, vector, INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cups_semantico(vector, INT);
DROP FUNCTION IF EXISTS buscar_cie10_semantico(vector, INT);

-- 3. Cambiar dimensión de columnas de 768 a 3072
ALTER TABLE cups_maestro ALTER COLUMN embedding TYPE vector(3072);
ALTER TABLE cie10_maestro ALTER COLUMN embedding TYPE vector(3072);

-- 4. Para 3072 dimensiones, ni IVFFlat ni HNSW soportan más de 2000d en Supabase.
-- Con ~6000 CUPS y ~14000 CIE-10, un sequential scan es suficientemente rápido
-- (típicamente <50ms). No se necesita índice vectorial para estas tablas pequeñas.

-- 5. Recrear función HÍBRIDA CUPS con vector(3072)
CREATE OR REPLACE FUNCTION buscar_cups_hibrido(
  termino_busqueda TEXT,
  vector_busqueda vector(3072),
  limite INT DEFAULT 10,
  peso_semantico FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  seccion TEXT,
  seccion_nombre TEXT,
  relevancia FLOAT,
  similitud_semantica FLOAT,
  relevancia_hibrida FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH trgm AS (
    SELECT 
      c.codigo,
      c.descripcion,
      c.seccion,
      c.seccion_nombre,
      GREATEST(
        similarity(c.descripcion, termino_busqueda),
        similarity(
          COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion, 
          termino_busqueda
        ) * 0.9,
        similarity(COALESCE(c.contexto_jerarquico, ''), termino_busqueda) * 0.7
      )::FLOAT AS rel_trgm
    FROM cups_maestro c
    WHERE c.vigente = true
      AND (
        c.descripcion % termino_busqueda
        OR (COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion) % termino_busqueda
        OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino_busqueda)
        OR to_tsvector('spanish', COALESCE(c.contexto_jerarquico, '')) @@ plainto_tsquery('spanish', termino_busqueda)
      )
  ),
  vec AS (
    SELECT 
      c.codigo,
      1 - (c.embedding <=> vector_busqueda)::FLOAT AS sim_vec
    FROM cups_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> vector_busqueda
    LIMIT limite * 3
  )
  SELECT 
    COALESCE(t.codigo, v.codigo) AS codigo,
    COALESCE(t.descripcion, cm.descripcion) AS descripcion,
    COALESCE(t.seccion, cm.seccion) AS seccion,
    COALESCE(t.seccion_nombre, cm.seccion_nombre) AS seccion_nombre,
    COALESCE(t.rel_trgm, 0)::FLOAT AS relevancia,
    COALESCE(v.sim_vec, 0)::FLOAT AS similitud_semantica,
    (
      (1 - peso_semantico) * COALESCE(t.rel_trgm, 0) + 
      peso_semantico * COALESCE(v.sim_vec, 0)
    )::FLOAT AS relevancia_hibrida
  FROM trgm t
  FULL OUTER JOIN vec v ON t.codigo = v.codigo
  LEFT JOIN cups_maestro cm ON v.codigo = cm.codigo AND t.codigo IS NULL
  ORDER BY relevancia_hibrida DESC
  LIMIT limite;
END;
$$;

-- 6. Recrear función HÍBRIDA CIE-10 con vector(3072)
CREATE OR REPLACE FUNCTION buscar_cie10_hibrido(
  termino_busqueda TEXT,
  vector_busqueda vector(3072),
  limite INT DEFAULT 10,
  peso_semantico FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  codigo_3 TEXT,
  descripcion_3 TEXT,
  capitulo INT,
  nombre_capitulo TEXT,
  relevancia FLOAT,
  similitud_semantica FLOAT,
  relevancia_hibrida FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH trgm AS (
    SELECT 
      c.codigo,
      c.descripcion,
      c.codigo_3,
      c.descripcion_3,
      c.capitulo,
      c.nombre_capitulo,
      similarity(c.descripcion, termino_busqueda)::FLOAT AS rel_trgm
    FROM cie10_maestro c
    WHERE c.vigente = true
      AND (
        c.descripcion % termino_busqueda
        OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino_busqueda)
      )
  ),
  vec AS (
    SELECT 
      c.codigo,
      1 - (c.embedding <=> vector_busqueda)::FLOAT AS sim_vec
    FROM cie10_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> vector_busqueda
    LIMIT limite * 3
  )
  SELECT 
    COALESCE(t.codigo, v.codigo) AS codigo,
    COALESCE(t.descripcion, cm.descripcion) AS descripcion,
    COALESCE(t.codigo_3, cm.codigo_3) AS codigo_3,
    COALESCE(t.descripcion_3, cm.descripcion_3) AS descripcion_3,
    COALESCE(t.capitulo, cm.capitulo) AS capitulo,
    COALESCE(t.nombre_capitulo, cm.nombre_capitulo) AS nombre_capitulo,
    COALESCE(t.rel_trgm, 0)::FLOAT AS relevancia,
    COALESCE(v.sim_vec, 0)::FLOAT AS similitud_semantica,
    (
      (1 - peso_semantico) * COALESCE(t.rel_trgm, 0) + 
      peso_semantico * COALESCE(v.sim_vec, 0)
    )::FLOAT AS relevancia_hibrida
  FROM trgm t
  FULL OUTER JOIN vec v ON t.codigo = v.codigo
  LEFT JOIN cie10_maestro cm ON v.codigo = cm.codigo AND t.codigo IS NULL
  ORDER BY relevancia_hibrida DESC
  LIMIT limite;
END;
$$;

-- 7. Recrear funciones semánticas puras con vector(3072)
CREATE OR REPLACE FUNCTION buscar_cups_semantico(
  vector_busqueda vector(3072),
  limite INT DEFAULT 10
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  seccion TEXT,
  seccion_nombre TEXT,
  similitud FLOAT
)
LANGUAGE sql
AS $$
  SELECT 
    c.codigo,
    c.descripcion,
    c.seccion,
    c.seccion_nombre,
    (1 - (c.embedding <=> vector_busqueda))::FLOAT AS similitud
  FROM cups_maestro c
  WHERE c.vigente = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> vector_busqueda
  LIMIT limite;
$$;

CREATE OR REPLACE FUNCTION buscar_cie10_semantico(
  vector_busqueda vector(3072),
  limite INT DEFAULT 10
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  codigo_3 TEXT,
  descripcion_3 TEXT,
  capitulo INT,
  nombre_capitulo TEXT,
  similitud FLOAT
)
LANGUAGE sql
AS $$
  SELECT 
    c.codigo,
    c.descripcion,
    c.codigo_3,
    c.descripcion_3,
    c.capitulo,
    c.nombre_capitulo,
    (1 - (c.embedding <=> vector_busqueda))::FLOAT AS similitud
  FROM cie10_maestro c
  WHERE c.vigente = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> vector_busqueda
  LIMIT limite;
$$;
