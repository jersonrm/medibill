-- =====================================================================
-- MIGRACIÓN: Usuarios existentes → Organizaciones
-- Ejecutar DESPUÉS de schema-suscripciones.sql
-- Cada usuario actual obtiene: 1 org + 1 membership (owner) + 1 suscripción trial
-- =====================================================================

DO $$
DECLARE
  r RECORD;
  new_org_id UUID;
BEGIN
  FOR r IN
    SELECT
      p.user_id,
      p.razon_social,
      p.email_facturacion,
      p.tipo_prestador,
      p.numero_documento
    FROM perfiles p
    WHERE p.organizacion_id IS NULL
  LOOP
    -- 1. Crear organización
    INSERT INTO organizaciones (
      nombre, nit, tipo, email_billing, max_usuarios
    ) VALUES (
      COALESCE(r.razon_social, 'Sin nombre'),
      r.numero_documento,
      CASE
        WHEN r.tipo_prestador = 'profesional_independiente' THEN 'independiente'
        WHEN r.tipo_prestador = 'ips_basica' THEN 'clinica'
        WHEN r.tipo_prestador = 'ips_compleja' THEN 'clinica'
        ELSE 'independiente'
      END,
      COALESCE(r.email_facturacion, 'sin-email@placeholder.com'),
      CASE
        WHEN r.tipo_prestador = 'profesional_independiente' THEN 1
        ELSE 20
      END
    ) RETURNING id INTO new_org_id;

    -- 2. Vincular usuario como owner
    INSERT INTO usuarios_organizacion (organizacion_id, user_id, rol, accepted_at)
    VALUES (new_org_id, r.user_id, 'owner', now());

    -- 3. Crear suscripción trial (14 días)
    INSERT INTO suscripciones (organizacion_id, plan_id, estado, trial_inicio, trial_fin)
    VALUES (
      new_org_id,
      CASE
        WHEN r.tipo_prestador = 'profesional_independiente' THEN 'starter'
        WHEN r.tipo_prestador = 'ips_basica' THEN 'clinica'
        WHEN r.tipo_prestador = 'ips_compleja' THEN 'clinica'
        ELSE 'starter'
      END,
      'trialing',
      now(),
      now() + INTERVAL '14 days'
    );

    -- 4. Actualizar tablas existentes con organizacion_id
    UPDATE perfiles SET organizacion_id = new_org_id WHERE user_id = r.user_id;
    UPDATE facturas SET organizacion_id = new_org_id WHERE user_id = r.user_id;
    UPDATE resoluciones_facturacion SET organizacion_id = new_org_id WHERE user_id = r.user_id;
    UPDATE acuerdos_voluntades SET organizacion_id = new_org_id WHERE prestador_id = r.user_id;
    UPDATE pacientes SET organizacion_id = new_org_id WHERE user_id = r.user_id;
    UPDATE auditorias_rips SET organizacion_id = new_org_id WHERE user_id = r.user_id;

    RAISE NOTICE 'Migrado usuario % → org %', r.user_id, new_org_id;
  END LOOP;
END $$;
