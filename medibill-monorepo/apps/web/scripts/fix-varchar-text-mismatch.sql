-- ═══════════════════════════════════════════════════════════════
-- FIX: "structure of query does not match function result type"
--
-- Causa: cups_maestro.codigo es CHARACTER VARYING(10), pero las
-- funciones RPC declaran RETURNS TABLE (codigo TEXT, ...).
-- PostgreSQL plpgsql exige match exacto de tipos.
--
-- Solución: Agregar ::TEXT explícito en todos los SELECTs internos
-- para las columnas que podrían ser VARCHAR en vez de TEXT.
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. Recrear buscar_cups ═══
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
    c.codigo::TEXT,
    c.descripcion::TEXT,
    c.seccion::TEXT,
    c.seccion_nombre::TEXT,
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

-- ═══ 2. Recrear match_documents ═══
DROP FUNCTION IF EXISTS match_documents(vector(768), INT, TEXT);
DROP FUNCTION IF EXISTS match_documents(vector, INT, TEXT);
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
      c.codigo::TEXT,
      c.descripcion::TEXT,
      (1 - (c.embedding <=> query_embedding))::FLOAT AS similitud
    FROM cups_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF tipo = 'cie10' THEN
    RETURN QUERY
    SELECT
      c.codigo::TEXT,
      c.descripcion::TEXT,
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

-- ═══ 3. Recrear buscar_cups_hibrido ═══
DROP FUNCTION IF EXISTS buscar_cups_hibrido(TEXT, vector(768), INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cups_hibrido(TEXT, vector, INT, FLOAT);
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
      c.codigo::TEXT AS codigo,
      c.descripcion::TEXT AS descripcion,
      c.seccion::TEXT AS seccion,
      c.seccion_nombre::TEXT AS seccion_nombre,
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
      c.codigo::TEXT AS codigo,
      1 - (c.embedding <=> vector_busqueda)::FLOAT AS sim_vec
    FROM cups_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> vector_busqueda
    LIMIT limite * 3
  )
  SELECT 
    COALESCE(t.codigo, v.codigo)::TEXT AS codigo,
    COALESCE(t.descripcion, cm.descripcion)::TEXT AS descripcion,
    COALESCE(t.seccion, cm.seccion)::TEXT AS seccion,
    COALESCE(t.seccion_nombre, cm.seccion_nombre)::TEXT AS seccion_nombre,
    COALESCE(t.rel_trgm, 0)::FLOAT AS relevancia,
    COALESCE(v.sim_vec, 0)::FLOAT AS similitud_semantica,
    (
      (1 - peso_semantico) * COALESCE(t.rel_trgm, 0) + 
      peso_semantico * COALESCE(v.sim_vec, 0)
    )::FLOAT AS relevancia_hibrida
  FROM trgm t
  FULL OUTER JOIN vec v ON t.codigo = v.codigo
  LEFT JOIN cups_maestro cm ON v.codigo = cm.codigo::TEXT AND t.codigo IS NULL
  ORDER BY relevancia_hibrida DESC
  LIMIT limite;
END;
$$;

-- ═══ 4. Recrear buscar_cie10_hibrido ═══
DROP FUNCTION IF EXISTS buscar_cie10_hibrido(TEXT, vector(768), INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_cie10_hibrido(TEXT, vector, INT, FLOAT);
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
      c.codigo::TEXT AS codigo,
      c.descripcion::TEXT AS descripcion,
      c.codigo_3::TEXT AS codigo_3,
      c.descripcion_3::TEXT AS descripcion_3,
      c.capitulo::INT AS capitulo,
      c.nombre_capitulo::TEXT AS nombre_capitulo,
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
      c.codigo::TEXT AS codigo,
      1 - (c.embedding <=> vector_busqueda)::FLOAT AS sim_vec
    FROM cie10_maestro c
    WHERE c.vigente = true
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> vector_busqueda
    LIMIT limite * 3
  )
  SELECT 
    COALESCE(t.codigo, v.codigo)::TEXT AS codigo,
    COALESCE(t.descripcion, cm.descripcion)::TEXT AS descripcion,
    COALESCE(t.codigo_3, cm.codigo_3)::TEXT AS codigo_3,
    COALESCE(t.descripcion_3, cm.descripcion_3)::TEXT AS descripcion_3,
    COALESCE(t.capitulo, cm.capitulo)::INT AS capitulo,
    COALESCE(t.nombre_capitulo, cm.nombre_capitulo)::TEXT AS nombre_capitulo,
    COALESCE(t.rel_trgm, 0)::FLOAT AS relevancia,
    COALESCE(v.sim_vec, 0)::FLOAT AS similitud_semantica,
    (
      (1 - peso_semantico) * COALESCE(t.rel_trgm, 0) + 
      peso_semantico * COALESCE(v.sim_vec, 0)
    )::FLOAT AS relevancia_hibrida
  FROM trgm t
  FULL OUTER JOIN vec v ON t.codigo = v.codigo
  LEFT JOIN cie10_maestro cm ON v.codigo = cm.codigo::TEXT AND t.codigo IS NULL
  ORDER BY relevancia_hibrida DESC
  LIMIT limite;
END;
$$;

-- ═══ 5. Recrear buscar_cups_semantico ═══
DROP FUNCTION IF EXISTS buscar_cups_semantico(vector(768), INT);
DROP FUNCTION IF EXISTS buscar_cups_semantico(vector, INT);
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
    c.codigo::TEXT,
    c.descripcion::TEXT,
    c.seccion::TEXT,
    c.seccion_nombre::TEXT,
    (1 - (c.embedding <=> vector_busqueda))::FLOAT AS similitud
  FROM cups_maestro c
  WHERE c.vigente = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> vector_busqueda
  LIMIT limite;
$$;

-- ═══ 6. Recrear buscar_cie10_semantico ═══
DROP FUNCTION IF EXISTS buscar_cie10_semantico(vector(768), INT);
DROP FUNCTION IF EXISTS buscar_cie10_semantico(vector, INT);
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
    c.codigo::TEXT,
    c.descripcion::TEXT,
    c.codigo_3::TEXT,
    c.descripcion_3::TEXT,
    c.capitulo::INT,
    c.nombre_capitulo::TEXT,
    (1 - (c.embedding <=> vector_busqueda))::FLOAT AS similitud
  FROM cie10_maestro c
  WHERE c.vigente = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> vector_busqueda
  LIMIT limite;
$$;

-- ═══ 7. Crear buscar_cie10 (lexical, no existía previamente) ═══
DROP FUNCTION IF EXISTS buscar_cie10(TEXT, INT);
CREATE OR REPLACE FUNCTION buscar_cie10(
  termino TEXT,
  limite INT DEFAULT 10
)
RETURNS TABLE (
  codigo TEXT,
  descripcion TEXT,
  codigo_3 TEXT,
  descripcion_3 TEXT,
  capitulo INT,
  nombre_capitulo TEXT,
  relevancia FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.codigo::TEXT,
    c.descripcion::TEXT,
    c.codigo_3::TEXT,
    c.descripcion_3::TEXT,
    c.capitulo::INT,
    c.nombre_capitulo::TEXT,
    similarity(c.descripcion, termino)::FLOAT AS relevancia
  FROM cie10_maestro c
  WHERE c.vigente = true
    AND (
      c.descripcion % termino
      OR to_tsvector('spanish', c.descripcion) @@ plainto_tsquery('spanish', termino)
    )
  ORDER BY relevancia DESC
  LIMIT limite;
END;
$$;
