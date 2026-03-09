-- =============================================================================
-- Migración: Función atómica para asignar consecutivo de factura
-- Corrige race condition en aprobarFactura() — el consecutivo se lee e
-- incrementa en una sola sentencia UPDATE ... RETURNING con row lock implícito.
-- =============================================================================

CREATE OR REPLACE FUNCTION siguiente_numero_factura(p_user_id UUID)
RETURNS TABLE (
  numero        TEXT,
  resolucion_id UUID,
  consecutivo   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefijo          TEXT;
  v_rango_hasta      INTEGER;
  v_rango_desde      INTEGER;
  v_consecutivo_prev INTEGER;
  v_nuevo            INTEGER;
  v_resolucion_id    UUID;
BEGIN
  -- Incrementar atómicamente con row lock implícito del UPDATE
  UPDATE resoluciones_facturacion
  SET    consecutivo_actual = CASE
           WHEN consecutivo_actual IS NULL THEN COALESCE(rango_desde, 1)
           ELSE consecutivo_actual + 1
         END
  WHERE  user_id = p_user_id
    AND  activa  = TRUE
  RETURNING
    id,
    prefijo,
    rango_hasta,
    rango_desde,
    consecutivo_actual   -- ya es el valor NUEVO tras el UPDATE
  INTO
    v_resolucion_id,
    v_prefijo,
    v_rango_hasta,
    v_rango_desde,
    v_nuevo;

  -- Sin resolución activa → devolver NULL (la app genera fallback)
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Validar que el nuevo consecutivo no exceda el rango autorizado
  IF v_rango_hasta IS NOT NULL AND v_nuevo > v_rango_hasta THEN
    -- Revertir el incremento para no consumir un número inválido
    UPDATE resoluciones_facturacion
    SET    consecutivo_actual = v_nuevo - 1
    WHERE  id = v_resolucion_id;

    RAISE EXCEPTION 'Rango de resolución agotado (máximo: %). Configure una nueva resolución.', v_rango_hasta;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_prefijo, '') || v_nuevo::TEXT,
    v_resolucion_id,
    v_nuevo;
END;
$$;

-- Permitir que usuarios autenticados invoquen la función vía RPC
GRANT EXECUTE ON FUNCTION siguiente_numero_factura(UUID) TO authenticated;
