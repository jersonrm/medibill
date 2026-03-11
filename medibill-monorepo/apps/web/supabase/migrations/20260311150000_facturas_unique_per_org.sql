-- =============================================================================
-- Migración: Cambiar UNIQUE de facturas.num_factura de global a per-org
--
-- Problema (DB-002): El constraint facturas_num_factura_key es UNIQUE global.
-- Dos organizaciones distintas no pueden tener el mismo número de factura
-- (ej. FV-001), lo cual es incorrecto en un sistema multi-tenant.
--
-- Solución: Reemplazar UNIQUE(num_factura) por UNIQUE(organizacion_id, num_factura).
-- Esto es estrictamente más permisivo — toda data existente que cumplía la
-- unicidad global automáticamente cumple la unicidad per-org.
--
-- Riesgo: BAJO. No hay código que use ON CONFLICT sobre num_factura ni que
-- referencie el constraint name directamente. Todas las queries ya filtran
-- por organizacion_id.
-- =============================================================================

BEGIN;

-- 1. Eliminar constraint UNIQUE global
ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_num_factura_key;

-- 2. Crear constraint UNIQUE per-org (permite FV-001 en org A y FV-001 en org B)
ALTER TABLE facturas
  ADD CONSTRAINT facturas_org_num_factura_key UNIQUE (organizacion_id, num_factura);

-- 3. Índice de apoyo para queries frecuentes (listarFacturas, dashboard badges)
-- que filtran por (organizacion_id, estado) constantemente
CREATE INDEX IF NOT EXISTS idx_facturas_org_estado
  ON facturas (organizacion_id, estado);

COMMIT;
