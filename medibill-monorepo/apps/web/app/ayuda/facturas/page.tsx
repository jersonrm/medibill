export default function FacturasAyudaPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">📄 Facturas</h2>
      <p className="mt-2 text-gray-600">
        Aprende a crear, gestionar y radicar facturas electrónicas en Medibill.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Crear una factura
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <ol className="list-inside space-y-3">
              <li>
                <strong>1.</strong> Navega a{" "}
                <strong>Nueva Factura</strong> desde la barra lateral.
              </li>
              <li>
                <strong>2.</strong> Ingresa los datos del paciente: tipo y
                número de documento, nombre, fecha de nacimiento y sexo. Si el
                paciente ya existe en tu base de datos, escribe su nombre o
                número de documento y selecciónalo de la lista.
              </li>
              <li>
                <strong>3.</strong> Selecciona la EPS/aseguradora del
                paciente, el tipo de usuario (contributivo, subsidiado, etc.) y
                la causa motivo de atención.
              </li>
              <li>
                <strong>4.</strong> Pega o escribe la nota clínica en el
                campo de texto libre. No necesitas un formato específico — la IA
                interpreta texto natural.
              </li>
              <li>
                <strong>5.</strong> Haz clic en <strong>Clasificar</strong>.
                En unos segundos verás los diagnósticos CIE-10 y procedimientos
                CUPS sugeridos.
              </li>
              <li>
                <strong>6.</strong> Revisa y ajusta los resultados si es
                necesario. Puedes cambiar códigos, cantidades o eliminar ítems.
              </li>
              <li>
                <strong>7.</strong> Haz clic en{" "}
                <strong>Guardar Factura</strong>. Se creará como borrador.
              </li>
            </ol>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Estados de una factura
          </h3>
          <div className="mt-3 text-sm text-gray-600">
            <p>Una factura pasa por los siguientes estados:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 pr-4 font-semibold text-medi-dark">Estado</th>
                    <th className="py-2 font-semibold text-medi-dark">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 pr-4 font-medium">Borrador</td>
                    <td className="py-2">Recién creada, editable. Puedes modificar todos sus datos.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Aprobada</td>
                    <td className="py-2">Revisada y confirmada. Se asigna número de factura según tu resolución DIAN.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Descargada</td>
                    <td className="py-2">El archivo RIPS JSON fue generado y descargado.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Radicada</td>
                    <td className="py-2">Entregada a la EPS. Comienza el conteo de plazos legales.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Glosada</td>
                    <td className="py-2">La EPS emitió una glosa. Tienes 15 días hábiles para responder.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Pagada</td>
                    <td className="py-2">El pago fue recibido y conciliado.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Anulada</td>
                    <td className="py-2">Factura cancelada. No puede reactivarse.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Aprobar y descargar RIPS
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <ol className="list-inside space-y-2">
              <li>
                <strong>1.</strong> Ve a <strong>Facturas</strong> y busca la
                factura en estado &quot;Borrador&quot;.
              </li>
              <li>
                <strong>2.</strong> Haz clic para abrir el detalle y revisa
                todos los datos: paciente, diagnósticos, procedimientos y
                valores.
              </li>
              <li>
                <strong>3.</strong> Si todo es correcto, haz clic en{" "}
                <strong>Aprobar</strong>. Se asignará el número de factura
                automáticamente.
              </li>
              <li>
                <strong>4.</strong> Una vez aprobada, el botón{" "}
                <strong>Descargar RIPS</strong> genera y descarga el archivo
                JSON FEV-RIPS conforme a la Resolución 2275 de 2023.
              </li>
            </ol>
            <div className="mt-3 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Antes de aprobar, verifica que tu
                resolución de facturación tenga números disponibles en el rango
                autorizado. Puedes comprobarlo en{" "}
                <strong>Configuración {">"} Perfil</strong>.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Validación de facturas
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Medibill ejecuta validaciones automáticas antes de permitir la
              aprobación de una factura:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Coherencia paciente:</strong> Verifica que la edad, sexo
                y diagnóstico sean coherentes con los procedimientos.
              </li>
              <li>
                <strong>Coherencia anatómica:</strong> Comprueba que la región
                del procedimiento corresponda con lo descrito en la nota
                clínica.
              </li>
              <li>
                <strong>Tarifas:</strong> Valida que los valores coincidan con
                tus tarifas personalizadas o con el manual tarifario
                configurado.
              </li>
              <li>
                <strong>Estructura RIPS:</strong> El archivo JSON es validado
                contra el esquema oficial antes de la descarga.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </article>
  );
}
