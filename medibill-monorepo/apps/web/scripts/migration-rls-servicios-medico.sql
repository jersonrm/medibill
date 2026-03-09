-- =====================================================================
-- RLS: servicios_medico — cada usuario solo accede a sus tarifas
-- =====================================================================

ALTER TABLE servicios_medico ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Usuarios ven sus tarifas" ON servicios_medico;
CREATE POLICY "Usuarios ven sus tarifas"
  ON servicios_medico FOR SELECT USING (auth.uid() = usuario_id);

-- INSERT
DROP POLICY IF EXISTS "Usuarios insertan sus tarifas" ON servicios_medico;
CREATE POLICY "Usuarios insertan sus tarifas"
  ON servicios_medico FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- UPDATE
DROP POLICY IF EXISTS "Usuarios actualizan sus tarifas" ON servicios_medico;
CREATE POLICY "Usuarios actualizan sus tarifas"
  ON servicios_medico FOR UPDATE USING (auth.uid() = usuario_id);

-- DELETE
DROP POLICY IF EXISTS "Usuarios eliminan sus tarifas" ON servicios_medico;
CREATE POLICY "Usuarios eliminan sus tarifas"
  ON servicios_medico FOR DELETE USING (auth.uid() = usuario_id);
