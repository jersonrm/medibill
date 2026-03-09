-- =====================================================================
-- MIGRACIÓN: Fase 5 — Completar RLS en todas las tablas
-- Medibill — Auditoría de seguridad
--
-- Tablas afectadas:
--   A) perfiles                  — sin RLS (CRÍTICO: datos del prestador)
--   B) pacientes                 — sin RLS (CRÍTICO: datos de pacientes)
--   C) resoluciones_facturacion  — sin RLS (datos de facturación)
--   D) auditorias_rips           — sin RLS (clasificaciones RIPS)
--   E) auditoria_plazos          — política SELECT rota (referencia tabla incorrecta)
--   F) validaciones_pre_radicacion — solo SELECT, falta INSERT
--   G) glosas                    — falta UPDATE
--   H) facturas                  — falta DELETE (para anulaciones)
--
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- =====================================================================


-- ═════════════════════════════════════════════════════════════════════
-- A) PERFILES — RLS completo (SELECT + UPSERT)
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven su perfil" ON perfiles;
CREATE POLICY "Usuarios ven su perfil"
  ON perfiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan su perfil" ON perfiles;
CREATE POLICY "Usuarios insertan su perfil"
  ON perfiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan su perfil" ON perfiles;
CREATE POLICY "Usuarios actualizan su perfil"
  ON perfiles FOR UPDATE
  USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════
-- B) PACIENTES — RLS completo (SELECT + INSERT + UPDATE)
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus pacientes" ON pacientes;
CREATE POLICY "Usuarios ven sus pacientes"
  ON pacientes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan pacientes" ON pacientes;
CREATE POLICY "Usuarios insertan pacientes"
  ON pacientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus pacientes" ON pacientes;
CREATE POLICY "Usuarios actualizan sus pacientes"
  ON pacientes FOR UPDATE
  USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════
-- C) RESOLUCIONES_FACTURACION — RLS completo (SELECT + INSERT + UPDATE)
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE resoluciones_facturacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus resoluciones" ON resoluciones_facturacion;
CREATE POLICY "Usuarios ven sus resoluciones"
  ON resoluciones_facturacion FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan resoluciones" ON resoluciones_facturacion;
CREATE POLICY "Usuarios insertan resoluciones"
  ON resoluciones_facturacion FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus resoluciones" ON resoluciones_facturacion;
CREATE POLICY "Usuarios actualizan sus resoluciones"
  ON resoluciones_facturacion FOR UPDATE
  USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════
-- D) AUDITORIAS_RIPS — RLS (SELECT + INSERT, inmutable)
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE auditorias_rips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus auditorias rips" ON auditorias_rips;
CREATE POLICY "Usuarios ven sus auditorias rips"
  ON auditorias_rips FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan auditorias rips" ON auditorias_rips;
CREATE POLICY "Usuarios insertan auditorias rips"
  ON auditorias_rips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE: las auditorías son inmutables


-- ═════════════════════════════════════════════════════════════════════
-- E) AUDITORIA_PLAZOS — Fix política SELECT rota + agregar INSERT
-- ═════════════════════════════════════════════════════════════════════

-- La política actual hace JOIN a glosas_recibidas pero la columna
-- glosa_id puede apuntar a glosas O glosas_recibidas según entidad.
-- Corregimos para soportar ambas rutas (factura directa + glosa).

DROP POLICY IF EXISTS "Usuarios ven plazos de sus glosas" ON auditoria_plazos;
CREATE POLICY "Usuarios ven plazos de sus entidades"
  ON auditoria_plazos FOR SELECT USING (
    CASE
      WHEN entidad = 'factura' THEN
        EXISTS (SELECT 1 FROM facturas f WHERE f.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid())
      WHEN entidad = 'glosa' THEN
        EXISTS (
          SELECT 1 FROM glosas_recibidas g
          JOIN facturas f ON f.id = g.factura_id
          WHERE g.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid()
        )
      WHEN entidad = 'respuesta' THEN
        EXISTS (
          SELECT 1 FROM respuestas_glosas r
          JOIN glosas_recibidas g ON g.id = r.glosa_id
          JOIN facturas f ON f.id = g.factura_id
          WHERE r.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid()
        )
      ELSE false
    END
  );

DROP POLICY IF EXISTS "Usuarios insertan plazos" ON auditoria_plazos;
CREATE POLICY "Usuarios insertan plazos"
  ON auditoria_plazos FOR INSERT WITH CHECK (
    CASE
      WHEN entidad = 'factura' THEN
        EXISTS (SELECT 1 FROM facturas f WHERE f.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid())
      WHEN entidad = 'glosa' THEN
        EXISTS (
          SELECT 1 FROM glosas_recibidas g
          JOIN facturas f ON f.id = g.factura_id
          WHERE g.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid()
        )
      WHEN entidad = 'respuesta' THEN
        EXISTS (
          SELECT 1 FROM respuestas_glosas r
          JOIN glosas_recibidas g ON g.id = r.glosa_id
          JOIN facturas f ON f.id = g.factura_id
          WHERE r.id = auditoria_plazos.entidad_id AND f.user_id = auth.uid()
        )
      ELSE false
    END
  );


-- ═════════════════════════════════════════════════════════════════════
-- F) VALIDACIONES_PRE_RADICACION — agregar INSERT (transitiva)
-- ═════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Usuarios insertan validaciones de sus facturas" ON validaciones_pre_radicacion;
CREATE POLICY "Usuarios insertan validaciones de sus facturas"
  ON validaciones_pre_radicacion FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = validaciones_pre_radicacion.factura_id AND f.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Usuarios eliminan validaciones de sus facturas" ON validaciones_pre_radicacion;
CREATE POLICY "Usuarios eliminan validaciones de sus facturas"
  ON validaciones_pre_radicacion FOR DELETE USING (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = validaciones_pre_radicacion.factura_id AND f.user_id = auth.uid())
  );


-- ═════════════════════════════════════════════════════════════════════
-- G) GLOSAS — agregar UPDATE (para cambio de estado)
-- ═════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Usuarios actualizan glosas de sus facturas" ON glosas;
CREATE POLICY "Usuarios actualizan glosas de sus facturas"
  ON glosas FOR UPDATE USING (
    EXISTS (SELECT 1 FROM facturas f WHERE f.id = glosas.factura_id AND f.user_id = auth.uid())
  );


-- ═════════════════════════════════════════════════════════════════════
-- H) FACTURAS — agregar DELETE (para anulación/limpieza)
-- ═════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Usuarios eliminan sus facturas" ON facturas;
CREATE POLICY "Usuarios eliminan sus facturas"
  ON facturas FOR DELETE
  USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═════════════════════════════════════════════════════════════════════

-- Ejecutar para confirmar que TODAS las tablas tienen RLS:

-- SELECT t.tablename,
--        CASE WHEN t.rowsecurity THEN '✅ RLS' ELSE '❌ SIN RLS' END as rls,
--        count(p.policyname) as politicas
-- FROM pg_tables t
-- LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
-- WHERE t.schemaname = 'public'
-- GROUP BY t.tablename, t.rowsecurity
-- ORDER BY t.tablename;

-- Esperado: TODAS las tablas con ✅ RLS, excepto las 4 de referencia:
--   catalogo_causales_glosa, cups_alias, cups_categorias, reglas_coherencia
