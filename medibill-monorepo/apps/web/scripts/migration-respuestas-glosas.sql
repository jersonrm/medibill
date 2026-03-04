-- =====================================================================
-- MIGRACIÓN: Módulo de Respuesta de Glosas RS01-RS05
-- Medibill — Capa 3
--
-- Base normativa:
--   Resolución 2284 de 2023, Anexo Técnico No. 3
--   Ley 1438 de 2011, Art. 57
--   Circular Conjunta 007 de 2025 (MinSalud + SuperSalud)
--
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- 1. Eliminar tablas vacías anteriores (ambas están vacías según el usuario)
DROP TABLE IF EXISTS respuestas_glosa;
DROP TABLE IF EXISTS respuestas_glosas;

-- 2. Crear nueva tabla respuestas_glosas con esquema enriquecido
CREATE TABLE respuestas_glosas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  glosa_id UUID NOT NULL REFERENCES glosas_recibidas(id),
  -- Respuesta del prestador
  codigo_respuesta VARCHAR(4) NOT NULL CHECK (codigo_respuesta IN ('RS01', 'RS02', 'RS03', 'RS04', 'RS05')),
  justificacion TEXT,
  fundamento_legal TEXT,
  -- Valores
  valor_aceptado NUMERIC(15,2) DEFAULT 0,      -- Lo que el prestador acepta (genera nota crédito)
  valor_controvertido NUMERIC(15,2) DEFAULT 0,  -- Lo que el prestador rechaza (debe pagar la EPS)
  valor_nota_credito NUMERIC(15,2) DEFAULT 0,   -- = valor_aceptado (para nota crédito DIAN)
  -- Soportes adjuntos
  soportes JSONB DEFAULT '[]'::jsonb,           -- Array de {nombre, tipo, url?}
  -- Origen de la respuesta
  origen_respuesta VARCHAR(15) DEFAULT 'manual' CHECK (origen_respuesta IN ('manual', 'automatica', 'ia')),
  -- Número de registro de la respuesta (campo 2.2.1 del Anexo 3)
  numero_registro_respuesta TEXT,
  -- Fechas
  fecha_respuesta DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX idx_resp_glosas_glosa ON respuestas_glosas(glosa_id);
CREATE INDEX idx_resp_glosas_codigo ON respuestas_glosas(codigo_respuesta);
CREATE INDEX idx_resp_glosas_fecha ON respuestas_glosas(fecha_respuesta);

-- 4. Función RPC para calcular días hábiles entre dos fechas
-- (excluye sábados y domingos; en producción integrar festivos colombianos)
CREATE OR REPLACE FUNCTION dias_habiles_entre(fecha_inicio DATE, fecha_fin DATE)
RETURNS INTEGER AS $$
DECLARE
  dias INTEGER := 0;
  current_date_iter DATE := fecha_inicio;
BEGIN
  WHILE current_date_iter <= fecha_fin LOOP
    IF EXTRACT(DOW FROM current_date_iter) NOT IN (0, 6) THEN
      dias := dias + 1;
    END IF;
    current_date_iter := current_date_iter + 1;
  END LOOP;
  RETURN dias;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Habilitar RLS (Row Level Security) si es necesario
-- ALTER TABLE respuestas_glosas ENABLE ROW LEVEL SECURITY;

-- 6. Verificar
-- SELECT * FROM respuestas_glosas LIMIT 1;
-- SELECT * FROM glosas_recibidas LIMIT 5;
-- SELECT dias_habiles_entre('2026-02-10', '2026-03-03'); -- debería ~15
