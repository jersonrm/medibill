-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Tabla cups_categorias para jerarquía CUPS
-- Almacena los códigos padre (2-5 dígitos) del CUPS que
-- proporcionan contexto semántico a cada procedimiento.
--
-- Ejemplo de jerarquía para 862603:
--   86   → PROCEDIMIENTOS EN PIEL Y TEJIDO CELULAR SUBCUTÁNEO
--   862  → ESCISIÓN O ABLACIÓN DE LESIÓN O TEJIDO DE PIEL...
--   8626 → OTROS DESBRIDAMIENTOS
--   862603 → DESBRIDAMIENTO (MECÁNICO O FÍSICO) CON DISPOSITIVO
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de categorías/jerarquía CUPS
CREATE TABLE IF NOT EXISTS cups_categorias (
  codigo TEXT PRIMARY KEY,          -- "86", "862", "8626", etc.
  descripcion TEXT NOT NULL,        -- Descripción del grupo
  nivel INT NOT NULL,               -- 2=sección, 3=grupo, 4=subgrupo, 5=sub-subgrupo
  codigo_padre TEXT,                -- Referencia al nivel superior
  CONSTRAINT fk_padre FOREIGN KEY (codigo_padre) REFERENCES cups_categorias(codigo) ON DELETE SET NULL
);

-- 2. Índice para búsqueda rápida por prefijo
CREATE INDEX IF NOT EXISTS idx_cups_categorias_codigo 
  ON cups_categorias(codigo);

-- 3. Agregar columnas de jerarquía a cups_maestro 
-- para que cada CUPS tenga su contexto jerárquico precalculado
ALTER TABLE cups_maestro 
  ADD COLUMN IF NOT EXISTS contexto_jerarquico TEXT;

-- 4. Función para obtener la ruta jerárquica completa de un CUPS
CREATE OR REPLACE FUNCTION obtener_jerarquia_cups(codigo_cups TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  resultado TEXT := '';
  prefijo TEXT;
  desc_cat TEXT;
BEGIN
  -- Nivel 2 (sección): primeros 2 dígitos
  prefijo := LEFT(codigo_cups, 2);
  SELECT descripcion INTO desc_cat FROM cups_categorias WHERE codigo = prefijo;
  IF desc_cat IS NOT NULL THEN
    resultado := desc_cat;
  END IF;

  -- Nivel 3 (grupo): primeros 3 dígitos
  prefijo := LEFT(codigo_cups, 3);
  SELECT descripcion INTO desc_cat FROM cups_categorias WHERE codigo = prefijo;
  IF desc_cat IS NOT NULL THEN
    resultado := resultado || ' > ' || desc_cat;
  END IF;

  -- Nivel 4 (subgrupo): primeros 4 dígitos
  prefijo := LEFT(codigo_cups, 4);
  SELECT descripcion INTO desc_cat FROM cups_categorias WHERE codigo = prefijo;
  IF desc_cat IS NOT NULL THEN
    resultado := resultado || ' > ' || desc_cat;
  END IF;

  -- Nivel 5 (sub-subgrupo): primeros 5 dígitos (si existe)
  IF LENGTH(codigo_cups) >= 6 THEN
    prefijo := LEFT(codigo_cups, 5);
    SELECT descripcion INTO desc_cat FROM cups_categorias WHERE codigo = prefijo;
    IF desc_cat IS NOT NULL THEN
      resultado := resultado || ' > ' || desc_cat;
    END IF;
  END IF;

  RETURN NULLIF(TRIM(resultado), '');
END;
$$;

-- 5. Función para actualizar masivamente el contexto jerárquico en cups_maestro
-- Ejecutar DESPUÉS de importar las categorías con importar-cups-jerarquia.ts
CREATE OR REPLACE FUNCTION actualizar_contexto_jerarquico()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  filas_actualizadas INT;
BEGIN
  UPDATE cups_maestro 
  SET contexto_jerarquico = obtener_jerarquia_cups(codigo)
  WHERE vigente = true;
  
  GET DIAGNOSTICS filas_actualizadas = ROW_COUNT;
  RETURN filas_actualizadas;
END;
$$;
