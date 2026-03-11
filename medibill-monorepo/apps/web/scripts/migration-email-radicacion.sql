-- =====================================================================
-- MIGRATION: Agregar campo email_radicacion a acuerdos_voluntades
-- Fase 1: Radicación por Email
-- Fecha: 2026-03-10
-- =====================================================================

ALTER TABLE acuerdos_voluntades ADD COLUMN IF NOT EXISTS email_radicacion TEXT;

COMMENT ON COLUMN acuerdos_voluntades.email_radicacion IS 'Email de radicación de la EPS para envío automático de FEV-RIPS';
