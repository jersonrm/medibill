-- =====================================================================
-- SEED: Catálogo de Causales de Glosa y Devolución — Medibill
-- Fuente: Resolución 2284/2023 (Anexo Técnico 3)
-- Ejecutar DESPUÉS de schema-glosas.sql
-- =====================================================================

-- Limpiar datos previos (idempotente) — desactivar FK temporalmente
ALTER TABLE catalogo_causales_glosa DROP CONSTRAINT IF EXISTS catalogo_causales_glosa_codigo_padre_fkey;

DELETE FROM catalogo_causales_glosa WHERE codigo IN (
  'FA0101','FA0102','FA0103','TA0101','TA0102',
  'SO0101','SO0102','AU0101','AU0102',
  'PE0101','PE0102','SC0101','SC0102',
  'DE5601','DE5602','DE5603',
  'FA01','TA01','SO01','AU01','PE01','SC01','DE56',
  'FA','TA','SO','AU','PE','SC','DE'
);

-- =====================================================================
-- GLOSAS POR FACTURACIÓN (FA)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','FA','Facturación','FA','Glosas relacionadas con errores de facturación', NULL, NULL, 1, true, 'Validar factura antes de radicar'),
  ('glosa','FA','Facturación','FA01','Error en datos de facturación', 'FA', NULL, 1, true, 'Verificar campos obligatorios'),
  ('glosa','FA','Facturación','FA0101','Factura sin número de autorización requerido', 'FA01', 'total', 1, true, 'Validar que servicios con autorización incluyan el número'),
  ('glosa','FA','Facturación','FA0102','Valor facturado no coincide con tarifa pactada', 'FA01', 'parcial', 1, true, 'Cruzar valor vs acuerdo de voluntades antes de radicar'),
  ('glosa','FA','Facturación','FA0103','Factura con datos del usuario incompletos o erróneos', 'FA01', 'total', 1, true, 'Validar documento, nombre y datos demográficos del paciente');

-- =====================================================================
-- GLOSAS POR TARIFAS (TA)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','TA','Tarifas','TA','Glosas por diferencias tarifarias', NULL, NULL, 1, true, 'Validar tarifas contra acuerdo vigente'),
  ('glosa','TA','Tarifas','TA01','Diferencia en tarifa aplicada', 'TA', NULL, 1, true, 'Comparar tarifa facturada vs pactada'),
  ('glosa','TA','Tarifas','TA0101','Tarifa superior a la pactada en acuerdo de voluntades', 'TA01', 'parcial', 1, true, 'Aplicar automáticamente tarifa del acuerdo vigente'),
  ('glosa','TA','Tarifas','TA0102','Cobro de materiales incluidos en tarifa integral/paquete', 'TA01', 'parcial', 1, true, 'Verificar si el acuerdo incluye materiales en la tarifa');

-- =====================================================================
-- GLOSAS POR SOPORTES (SO)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','SO','Soportes','SO','Glosas por falta o inconsistencia en soportes', NULL, NULL, 2, true, 'Verificar soportes antes de radicar'),
  ('glosa','SO','Soportes','SO01','Soporte faltante o incompleto', 'SO', NULL, 2, true, 'Checklist de soportes por tipo de servicio'),
  ('glosa','SO','Soportes','SO0101','Historia clínica no adjunta o incompleta', 'SO01', 'total', 2, true, 'Validar que HC esté adjunta y firmada'),
  ('glosa','SO','Soportes','SO0102','Orden médica o fórmula no adjunta', 'SO01', 'total', 2, true, 'Verificar existencia de orden/fórmula para el servicio');

-- =====================================================================
-- GLOSAS POR AUTORIZACIÓN (AU)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','AU','Autorización','AU','Glosas por problemas de autorización', NULL, NULL, 2, true, 'Validar autorización antes de prestar servicio'),
  ('glosa','AU','Autorización','AU01','Problema con autorización del servicio', 'AU', NULL, 2, true, 'Verificar vigencia y cobertura de autorización'),
  ('glosa','AU','Autorización','AU0101','Servicio prestado sin autorización vigente', 'AU01', 'total', 2, true, 'Verificar autorización ANTES de prestar el servicio'),
  ('glosa','AU','Autorización','AU0102','Autorización vencida al momento del servicio', 'AU01', 'total', 2, true, 'Alertar si la autorización está próxima a vencer');

-- =====================================================================
-- GLOSAS POR PERTINENCIA (PE)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','PE','Pertinencia','PE','Glosas por pertinencia médica', NULL, NULL, 3, false, 'Revisión clínica por auditor médico'),
  ('glosa','PE','Pertinencia','PE01','Cuestionamiento de pertinencia clínica', 'PE', NULL, 3, false, 'Documentar justificación clínica detallada'),
  ('glosa','PE','Pertinencia','PE0101','Procedimiento no coherente con diagnóstico CIE-10', 'PE01', 'total', 3, false, 'Verificar coherencia Dx-Px con reglas automáticas'),
  ('glosa','PE','Pertinencia','PE0102','Estancia hospitalaria superior a la esperada', 'PE01', 'parcial', 3, false, 'Documentar justificación de estancia prolongada en HC');

-- =====================================================================
-- GLOSAS POR SUBCUENTA (SC) — Cobertura / régimen
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('glosa','SC','Subcuenta/Cobertura','SC','Glosas por problemas de cobertura o subcuenta', NULL, NULL, 2, true, 'Verificar cobertura del usuario antes de facturar'),
  ('glosa','SC','Subcuenta/Cobertura','SC01','Error en asignación de cobertura', 'SC', NULL, 2, true, 'Validar régimen y estado de afiliación'),
  ('glosa','SC','Subcuenta/Cobertura','SC0101','Usuario no afiliado a la EPS al momento del servicio', 'SC01', 'total', 2, true, 'Consultar BDUA/ADRES antes de prestar el servicio'),
  ('glosa','SC','Subcuenta/Cobertura','SC0102','Servicio no cubierto por el plan de beneficios', 'SC01', 'total', 2, true, 'Verificar cobertura PBS/complementario antes de facturar');

-- =====================================================================
-- DEVOLUCIONES (DE)
-- =====================================================================
INSERT INTO catalogo_causales_glosa
  (tipo, concepto, concepto_desc, codigo, descripcion, codigo_padre, afecta, capa_medibill, prevenible, accion_medibill)
VALUES
  ('devolucion','DE','Devolución','DE','Devoluciones de la factura completa', NULL, NULL, 1, true, 'Validación pre-radicación completa'),
  ('devolucion','DE','Devolución','DE56','Errores formales en la factura', 'DE', NULL, 1, true, 'Validar formato FEV antes de radicar'),
  ('devolucion','DE','Devolución','DE5601','Factura no cumple requisitos formales de la DIAN', 'DE56', 'total', 1, true, 'Validar estructura XML-FEV contra esquema DIAN'),
  ('devolucion','DE','Devolución','DE5602','RIPS no coinciden con la factura electrónica', 'DE56', 'total', 1, true, 'Cruzar RIPS vs FEV automáticamente antes de radicar'),
  ('devolucion','DE','Devolución','DE5603','Radicación fuera del plazo legal (extemporánea)', 'DE56', 'total', 1, true, 'Alertar cuando la factura está próxima a vencer el plazo de 22 días hábiles');

-- Restaurar FK auto-referencial
ALTER TABLE catalogo_causales_glosa
  ADD CONSTRAINT catalogo_causales_glosa_codigo_padre_fkey
  FOREIGN KEY (codigo_padre) REFERENCES catalogo_causales_glosa(codigo);

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- Debería retornar 30 registros
SELECT tipo, concepto, COUNT(*) as total
FROM catalogo_causales_glosa
GROUP BY tipo, concepto
ORDER BY tipo, concepto;
