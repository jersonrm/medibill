export default function ConfiguracionAyudaPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">⚙️ Configuración</h2>
      <p className="mt-2 text-gray-600">
        Personaliza tu perfil profesional, gestiona tu equipo, configura
        acuerdos con EPS y administra tu suscripción.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Perfil profesional
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En <strong>Configuración {">"} Perfil</strong> puedes actualizar:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Datos personales:</strong> Nombre, tipo y número de
                documento de identidad.
              </li>
              <li>
                <strong>Datos de facturación:</strong> NIT, razón social, régimen
                tributario.
              </li>
              <li>
                <strong>Ubicación:</strong> Departamento y municipio (código
                DIVIPOLA) — necesario para los registros RIPS.
              </li>
              <li>
                <strong>Resolución de facturación:</strong> Número de resolución
                DIAN, prefijo, rango autorizado (desde-hasta) y fecha de
                vigencia. Es fundamental mantener esta información actualizada
                para la correcta numeración de facturas.
              </li>
            </ul>
            <div className="mt-3 rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Importante:</strong> Si tu resolución de facturación se
                agota o vence, no podrás aprobar nuevas facturas. Solicita una
                nueva resolución ante la DIAN con anticipación.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Acuerdos con EPS
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En <strong>Configuración {">"} Acuerdos</strong> puedes registrar
              los acuerdos de voluntades con cada EPS o aseguradora:
            </p>
            <ol className="mt-3 list-inside space-y-2">
              <li>
                <strong>1.</strong> Haz clic en <strong>Nuevo Acuerdo</strong>.
              </li>
              <li>
                <strong>2.</strong> Selecciona la EPS/aseguradora.
              </li>
              <li>
                <strong>3.</strong> Define el manual tarifario base (SOAT, ISS,
                propio).
              </li>
              <li>
                <strong>4.</strong> Configura las tarifas pactadas por
                procedimiento o grupo de servicios.
              </li>
              <li>
                <strong>5.</strong> Guarda el acuerdo. Los valores se aplicarán
                automáticamente en las facturas para esa EPS.
              </li>
            </ol>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Tarifas personalizadas
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En <strong>Configuración {">"} Tarifas</strong> puedes definir tus
              tarifas personalizadas por código CUPS. Estas tarifas se priorizan
              sobre el manual tarifario cuando generas una factura:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Tarifa propia:</strong> Se usa tu tarifa personalizada si
                existe.
              </li>
              <li>
                <strong>Tarifa de acuerdo:</strong> Si no tienes tarifa propia,
                se usa la del acuerdo con la EPS.
              </li>
              <li>
                <strong>Manual base:</strong> Si no hay acuerdo ni tarifa propia,
                se indica que no se encontró tarifa y debes ingresarla
                manualmente.
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Gestión de equipo
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En <strong>Configuración {">"} Equipo</strong> (disponible en
              planes Clínica) puedes:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Invitar miembros:</strong> Envía invitaciones por email.
                El invitado acepta y queda vinculado a tu organización.
              </li>
              <li>
                <strong>Asignar roles:</strong> Los roles disponibles son:
                <ul className="ml-6 mt-2 space-y-1">
                  <li>• <strong>Owner:</strong> Control total, incluida facturación y configuración.</li>
                  <li>• <strong>Admin:</strong> Gestión de equipo y configuración, sin cambiar suscripción.</li>
                  <li>• <strong>Doctor:</strong> Crear y clasificar facturas.</li>
                  <li>• <strong>Facturador:</strong> Aprobar, descargar y radicar facturas.</li>
                  <li>• <strong>Auditor:</strong> Sólo lectura — ver facturas, glosas y reportes.</li>
                </ul>
              </li>
              <li>
                <strong>Revocar acceso:</strong> Elimina miembros del equipo
                cuando sea necesario.
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Suscripción y facturación
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En <strong>Configuración {">"} Suscripción</strong> puedes:
            </p>
            <ul className="mt-3 space-y-2">
              <li>• Ver tu plan actual y uso mensual (clasificaciones, facturas).</li>
              <li>• Cambiar de plan (upgrade o downgrade).</li>
              <li>• Ver historial de pagos.</li>
              <li>• Actualizar tu método de pago.</li>
              <li>• Cancelar tu suscripción (se mantiene activa hasta el final del período).</li>
            </ul>
            <p className="mt-3">
              Aceptamos tarjetas de crédito/débito, PSE y Nequi a través de
              Wompi.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
