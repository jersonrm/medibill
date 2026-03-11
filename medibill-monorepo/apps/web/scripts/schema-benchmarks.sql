-- =====================================================================
-- FASE 3: Inteligencia Colectiva — Benchmarks y Tarifario Colaborativo
-- =====================================================================

-- 3.1: Consentimiento para compartir datos anonimizados
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS compartir_datos_anonimos BOOLEAN DEFAULT false;

-- =====================================================================
-- 3.2: Vistas materializadas (solo datos de orgs con compartir=true)
-- Regla: mínimo 3 organizaciones distintas por EPS para exponer benchmark
-- =====================================================================

-- Vista 1: Tasa de glosa por EPS
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tasa_glosa_por_eps AS
SELECT
  f.nit_erp AS eps_codigo,
  COUNT(DISTINCT uo.organizacion_id) AS num_organizaciones,
  COUNT(DISTINCT f.id) AS total_facturas,
  COUNT(DISTINCT gr.id) AS total_glosadas,
  ROUND(
    CASE WHEN COUNT(DISTINCT f.id) > 0
      THEN COUNT(DISTINCT gr.id)::NUMERIC / COUNT(DISTINCT f.id) * 100
      ELSE 0
    END, 2
  ) AS tasa_glosa_pct,
  ROUND(COALESCE(AVG(gr.valor_glosado), 0), 0) AS promedio_valor_glosa
FROM facturas f
JOIN usuarios_organizacion uo ON uo.user_id = f.user_id
JOIN organizaciones o ON o.id = uo.organizacion_id AND o.compartir_datos_anonimos = true
LEFT JOIN glosas_recibidas gr ON gr.factura_id = f.id AND gr.user_id = f.user_id
WHERE f.estado NOT IN ('borrador', 'anulada')
GROUP BY f.nit_erp
HAVING COUNT(DISTINCT uo.organizacion_id) >= 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tasa_glosa_eps
  ON mv_tasa_glosa_por_eps(eps_codigo);

-- Vista 2: Días de pago por EPS
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dias_pago_por_eps AS
SELECT
  f.nit_erp AS eps_codigo,
  COUNT(DISTINCT uo.organizacion_id) AS num_organizaciones,
  ROUND(AVG(
    EXTRACT(DAY FROM (p.fecha_pago::TIMESTAMP - COALESCE((f.metadata->>'fecha_radicacion')::TIMESTAMP, f.created_at)))
  ), 0) AS promedio_dias,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(DAY FROM (p.fecha_pago::TIMESTAMP - COALESCE((f.metadata->>'fecha_radicacion')::TIMESTAMP, f.created_at)))
  )::INT AS mediana_dias,
  PERCENTILE_CONT(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(DAY FROM (p.fecha_pago::TIMESTAMP - COALESCE((f.metadata->>'fecha_radicacion')::TIMESTAMP, f.created_at)))
  )::INT AS percentil_90_dias
FROM facturas f
JOIN pagos p ON p.factura_id = f.id
JOIN usuarios_organizacion uo ON uo.user_id = f.user_id
JOIN organizaciones o ON o.id = uo.organizacion_id AND o.compartir_datos_anonimos = true
WHERE f.estado IN ('pagada', 'pagada_parcial')
GROUP BY f.nit_erp
HAVING COUNT(DISTINCT uo.organizacion_id) >= 3;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dias_pago_eps
  ON mv_dias_pago_por_eps(eps_codigo);

-- Vista 3: Causales frecuentes por EPS
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_causales_frecuentes AS
SELECT
  gr.eps_codigo,
  gr.codigo_glosa AS causal,
  COUNT(DISTINCT uo.organizacion_id) AS num_organizaciones,
  COUNT(gr.id) AS frecuencia,
  ROUND(
    COUNT(gr.id)::NUMERIC / SUM(COUNT(gr.id)) OVER (PARTITION BY gr.eps_codigo) * 100, 2
  ) AS porcentaje_del_total
FROM glosas_recibidas gr
JOIN usuarios_organizacion uo ON uo.user_id = gr.user_id
JOIN organizaciones o ON o.id = uo.organizacion_id AND o.compartir_datos_anonimos = true
WHERE gr.codigo_glosa IS NOT NULL
GROUP BY gr.eps_codigo, gr.codigo_glosa
HAVING COUNT(DISTINCT uo.organizacion_id) >= 3;

CREATE INDEX IF NOT EXISTS idx_mv_causales_eps
  ON mv_causales_frecuentes(eps_codigo);

-- Vista 4: Tarifa real por CUPS y EPS
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tarifa_real_por_cups AS
SELECT
  a.eps_codigo,
  ta.cups_codigo,
  COUNT(DISTINCT uo.organizacion_id) AS num_organizaciones,
  ROUND(AVG(ta.valor_pactado), 0) AS valor_promedio,
  MIN(ta.valor_pactado) AS valor_min,
  MAX(ta.valor_pactado) AS valor_max,
  COUNT(ta.id) AS total_registros
FROM acuerdo_tarifas ta
JOIN acuerdos_voluntades a ON a.id = ta.acuerdo_id
JOIN usuarios_organizacion uo ON uo.user_id = a.prestador_id
JOIN organizaciones o ON o.id = uo.organizacion_id AND o.compartir_datos_anonimos = true
WHERE ta.valor_pactado > 0
GROUP BY a.eps_codigo, ta.cups_codigo
HAVING COUNT(DISTINCT uo.organizacion_id) >= 3;

CREATE INDEX IF NOT EXISTS idx_mv_tarifa_cups_eps
  ON mv_tarifa_real_por_cups(eps_codigo, cups_codigo);

-- =====================================================================
-- 3.3: Función RPC para refrescar vistas materializadas desde el cron
-- =====================================================================
CREATE OR REPLACE FUNCTION refresh_benchmark_views()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tasa_glosa_por_eps;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dias_pago_por_eps;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_causales_frecuentes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tarifa_real_por_cups;
  RETURN 'ok';
END;
$$;
