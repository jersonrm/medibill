-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN v2: Búsqueda CUPS con contexto jerárquico
-- 
-- Actualiza buscar_cups_hibrido y buscar_cups para incluir
-- contexto_jerarquico en las búsquedas por trigramas/full-text.
--
-- Esto permite que buscar "desbridamiento piel" también matchee
-- códigos cuya jerarquía contiene "PIEL Y TEJIDO CELULAR SUBCUTÁNEO"
-- aunque su descripción directa no diga "piel".
--
-- Ejecutar en Supabase SQL Editor (una sola vez, DESPUÉS de
-- importar-cups-jerarquia.ts)
-- ═══════════════════════════════════════════════════════════════

-- 0. Asegurar que pgvector y el schema extensions estén accesibles
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
SET search_path TO public, extensions;

-- 1. Índice GIN de trigramas sobre contexto_jerarquico (para % operator)
CREATE INDEX IF NOT EXISTS idx_cups_maestro_contexto_jerarquico_trgm
  ON cups_maestro
  USING gin (contexto_jerarquico gin_trgm_ops);

-- 2. Índice GIN de full-text sobre contexto_jerarquico
CREATE INDEX IF NOT EXISTS idx_cups_maestro_contexto_jerarquico_fts
  ON cups_maestro
  USING gin (to_tsvector('spanish', COALESCE(contexto_jerarquico, '')));

-- 3. Columna combinada materializada para búsqueda unificada (descripcion + jerarquía)
-- Usamos un índice funcional en vez de columna materializada para no agregar mantenimiento
CREATE INDEX IF NOT EXISTS idx_cups_maestro_texto_completo_trgm
  ON cups_maestro
  USING gin ((COALESCE(contexto_jerarquico, '') || ' ' || descripcion) gin_trgm_ops);

-- 4. Función HÍBRIDA actualizada: incluye contexto_jerarquico en trigramas
DROP FUNCTION IF EXISTS buscar_cups_hibrido(TEXT, vector(768), INT, FLOAT);
CREATE OR REPLACE FUNCTION buscar_cups_hibrido(
  termino_busqueda TEXT,
  vector_busqueda vector(768),
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
    -- Búsqueda por trigramas: ahora incluye contexto_jerarquico
    SELECT 
      c.codigo,
      c.descripcion,
      c.seccion,
      c.seccion_nombre,
      GREATEST(
        -- Similitud contra descripción directa
        similarity(c.descripcion, termino_busqueda),
        -- Similitud contra texto combinado (jerarquía + descripción)
        similarity(
          COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion, 
          termino_busqueda
        ) * 0.9,  -- Ligeramente menor peso para evitar ruido
        -- Similitud contra solo jerarquía (para términos de categoría como "piel", "laboratorio")
        similarity(COALESCE(c.contexto_jerarquico, ''), termino_busqueda) * 0.7
      )::FLOAT AS rel_trgm
    FROM cups_maestro c
    WHERE c.vigente = true
      AND (
        -- Match directo en descripción
        c.descripcion % termino_busqueda
        -- Match en texto combinado (jerarquía + descripción)
        OR (COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion) % termino_busqueda
        -- Full-text search en descripción
        OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino_busqueda)
        -- Full-text search en jerarquía
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

-- 5. Función SOLO trigramas actualizada: incluye contexto_jerarquico
-- (Reemplaza buscar_cups original para que la búsqueda lexical también use jerarquía)
DROP FUNCTION IF EXISTS buscar_cups(TEXT, INT);
CREATE OR REPLACE FUNCTION buscar_cups(
  termino TEXT,
  limite INT DEFAULT 10
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  seccion TEXT,
  seccion_nombre TEXT,
  relevancia FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.codigo,
    c.descripcion,
    c.seccion,
    c.seccion_nombre,
    GREATEST(
      similarity(c.descripcion, termino),
      similarity(
        COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion,
        termino
      ) * 0.9,
      similarity(COALESCE(c.contexto_jerarquico, ''), termino) * 0.7
    )::FLOAT AS relevancia
  FROM cups_maestro c
  WHERE c.vigente = true
    AND (
      c.descripcion % termino
      OR (COALESCE(c.contexto_jerarquico, '') || ' ' || c.descripcion) % termino
      OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino)
      OR to_tsvector('spanish', COALESCE(c.contexto_jerarquico, '')) @@ plainto_tsquery('spanish', termino)
    )
  ORDER BY relevancia DESC
  LIMIT limite;
END;
$$;
