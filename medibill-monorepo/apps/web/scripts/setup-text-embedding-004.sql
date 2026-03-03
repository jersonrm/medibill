-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Embeddings con gemini-embedding-001 (768d) + match_documents
--
-- Modelo: gemini-embedding-001 con outputDimensionality=768
-- (el modelo nativo genera 3072d, truncado a 768d para eficiencia)
--
-- IMPORTANTE: Esta migración limpia TODOS los embeddings existentes
-- porque el cambio de dimensión y modelo invalida los vectores previos.
-- Después de ejecutar esto, correr:
--   npx tsx apps/web/scripts/generar-embeddings.ts
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- Asegurar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ 1. Eliminar funciones que referencian la dimensión anterior ═══

DROP FUNCTION IF EXISTS buscar_cups_hibrido(TEXT, vector, INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cie10_hibrido(TEXT, vector, INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cups_semantico(vector, INT);
DROP FUNCTION IF EXISTS buscar_cie10_semantico(vector, INT);
DROP FUNCTION IF EXISTS match_documents(vector, INT, TEXT);

-- ═══ 2. Eliminar índices existentes ═══

DROP INDEX IF EXISTS idx_cups_maestro_embedding;
DROP INDEX IF EXISTS idx_cie10_maestro_embedding;

-- ═══ 3. Limpiar embeddings existentes y cambiar dimensión a 768 ═══

UPDATE cups_maestro SET embedding = NULL WHERE embedding IS NOT NULL;
UPDATE cie10_maestro SET embedding = NULL WHERE embedding IS NOT NULL;

ALTER TABLE cups_maestro ALTER COLUMN embedding TYPE vector(768);
ALTER TABLE cie10_maestro ALTER COLUMN embedding TYPE vector(768);

-- ═══ 4. Crear índices HNSW para 768 dimensiones ═══
-- HNSW es preferible a IVFFlat porque:
--   • No necesita datos de entrenamiento (funciona bien con tabla vacía)
--   • Mejor recall (precisión) en búsquedas de similitud
--   • Sin necesidad de REINDEX tras cargar datos
-- m=16: número de conexiones por nodo (default recomendado)
-- ef_construction=64: calidad de construcción del grafo

CREATE INDEX IF NOT EXISTS idx_cups_maestro_embedding_hnsw
  ON cups_maestro
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_cie10_maestro_embedding_hnsw
  ON cie10_maestro
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Eliminar índices IVFFlat antiguos si existen (reemplazados por HNSW)
DROP INDEX IF EXISTS idx_cups_maestro_embedding;
DROP INDEX IF EXISTS idx_cie10_maestro_embedding;

-- ═══ 5. Función RPC: match_documents ═══
-- Recibe un vector de consulta (generado con task_type=RETRIEVAL_QUERY)
-- y devuelve los N códigos más similares usando distancia coseno.
-- Parámetro tipo: 'cups' o 'cie10' para elegir la tabla.

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count INT DEFAULT 10,
  tipo TEXT DEFAULT 'cups'
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  similitud FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF tipo = 'cups' THEN
    RETURN QUERY
    SELECT
      c.codigo,
      c.descripcion,
      (1 - (c.embedding <=> query_embedding))::FLOAT AS similitud
    FROM cups_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF tipo = 'cie10' THEN
    RETURN QUERY
    SELECT
      c.codigo,
      c.descripcion,
      (1 - (c.embedding <=> query_embedding))::FLOAT AS similitud
    FROM cie10_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
  ELSE
    RAISE EXCEPTION 'Tipo no válido: %. Use "cups" o "cie10".', tipo;
  END IF;
END;
$$;

-- ═══ 6. Recrear función HÍBRIDA CUPS con vector(768) ═══

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

-- ═══ 7. Recrear función HÍBRIDA CIE-10 con vector(768) ═══

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

-- ═══ 8. Funciones semánticas puras con vector(768) ═══

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

-- ═══ NOTA POST-MIGRACIÓN ═══
-- Después de generar todos los embeddings con:
--   npx tsx apps/web/scripts/generar-embeddings.ts
-- Los índices HNSW se actualizan automáticamente con cada INSERT/UPDATE.
-- No es necesario REINDEX como con IVFFlat.
