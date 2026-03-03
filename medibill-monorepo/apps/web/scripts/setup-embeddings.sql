-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar búsqueda vectorial (pgvector) a CUPS y CIE-10
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- 1. Habilitar extensión pgvector (Supabase ya la tiene instalada)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Agregar columna de embedding a cups_maestro
-- Gemini text-embedding-004 genera vectores de 768 dimensiones
ALTER TABLE cups_maestro 
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Agregar columna de embedding a cie10_maestro
ALTER TABLE cie10_maestro 
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 4. Crear índice IVFFlat para búsqueda rápida en CUPS (~6000 filas → lists=50)
-- Usar cosine distance (mejor para texto según benchmarks)
CREATE INDEX IF NOT EXISTS idx_cups_maestro_embedding 
  ON cups_maestro 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 50);

-- 5. Crear índice IVFFlat para CIE-10 (~14000 filas → lists=100)
CREATE INDEX IF NOT EXISTS idx_cie10_maestro_embedding 
  ON cie10_maestro 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- 6. Función de búsqueda HÍBRIDA para CUPS (trigrama + vector)
-- Combina relevancia lexical (pg_trgm) con similitud semántica (pgvector)
CREATE OR REPLACE FUNCTION buscar_cups_hibrido(
  termino_busqueda TEXT,
  vector_busqueda vector(768),
  limite INT DEFAULT 10,
  peso_semantico FLOAT DEFAULT 0.6  -- Más peso al significado que a la forma
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
    -- Búsqueda por trigramas (lexical)
    SELECT 
      c.codigo,
      c.descripcion,
      c.seccion,
      c.seccion_nombre,
      similarity(c.descripcion, termino_busqueda)::FLOAT AS rel_trgm
    FROM cups_maestro c
    WHERE c.vigente = true
      AND (
        c.descripcion % termino_busqueda
        OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino_busqueda)
      )
  ),
  vec AS (
    -- Búsqueda por vector similarity (semántica)
    SELECT 
      c.codigo,
      1 - (c.embedding <=> vector_busqueda)::FLOAT AS sim_vec
    FROM cups_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> vector_busqueda
    LIMIT limite * 3  -- Traer más candidatos para merge
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

-- 7. Función de búsqueda HÍBRIDA para CIE-10
CREATE OR REPLACE FUNCTION buscar_cie10_hibrido(
  termino_busqueda TEXT,
  vector_busqueda vector(768),
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

-- 8. Función auxiliar: búsqueda SOLO vectorial (para cuando pg_trgm no retorna nada)
CREATE OR REPLACE FUNCTION buscar_cups_semantico(
  vector_busqueda vector(768),
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
  vector_busqueda vector(768),
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
