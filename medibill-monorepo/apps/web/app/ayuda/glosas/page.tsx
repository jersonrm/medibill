export default function GlosasAyudaPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">⚠️ Glosas</h2>
      <p className="mt-2 text-gray-600">
        Aprende a gestionar las glosas recibidas de las EPS, responder dentro
        de los plazos legales y usar las sugerencias de IA.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            ¿Qué es una glosa?
          </h3>
          <div className="mt-3 text-sm text-gray-600">
            <p>
              Una glosa es una objeción que la EPS hace a una factura radicada.
              Puede ser por inconsistencias en los códigos, falta de
              documentación, tarifas incorrectas u otros motivos definidos en la
              Resolución 2284 de 2023. Las glosas se clasifican por causales:
            </p>
            <ul className="mt-3 space-y-1">
              <li><strong>FA:</strong> Facturación (errores en valores o conceptos)</li>
              <li><strong>TA:</strong> Tarifas (discrepancias en tarifas aplicadas)</li>
              <li><strong>SO:</strong> Soportes (falta de documentación)</li>
              <li><strong>AU:</strong> Autorización (problemas con autorizaciones)</li>
              <li><strong>PE:</strong> Pertinencia (cuestionamiento médico)</li>
              <li><strong>SC:</strong> Servicios no cubiertos</li>
              <li><strong>DE:</strong> Devolución (problemas formales en la radicación)</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Registrar una glosa recibida
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <ol className="list-inside space-y-3">
              <li>
                <strong>1.</strong> Ve a <strong>Glosas</strong> en la barra
                lateral.
              </li>
              <li>
                <strong>2.</strong> Haz clic en <strong>Registrar Glosa</strong>.
              </li>
              <li>
                <strong>3.</strong> Selecciona la factura afectada (puedes
                buscar por número de factura).
              </li>
              <li>
                <strong>4.</strong> Ingresa la EPS que emite la glosa, la
                fecha de notificación, el causal y el monto glosado.
              </li>
              <li>
                <strong>5.</strong> Adjunta la descripción o detalle de la
                glosa tal como la recibiste de la EPS.
              </li>
              <li>
                <strong>6.</strong> Haz clic en <strong>Guardar</strong>.
                Medibill calculará automáticamente la fecha límite de respuesta
                (15 días hábiles).
              </li>
            </ol>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Responder una glosa
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>Existen cinco tipos de respuesta según la Resolución 2284 de 2023:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 pr-4 font-semibold text-medi-dark">Código</th>
                    <th className="py-2 pr-4 font-semibold text-medi-dark">Tipo</th>
                    <th className="py-2 font-semibold text-medi-dark">Cuándo usar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 pr-4 font-medium">RS01</td>
                    <td className="py-2 pr-4">Aceptar</td>
                    <td className="py-2">Cuando reconoces que la glosa es válida. Genera una nota crédito.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">RS02</td>
                    <td className="py-2 pr-4">Subsanar</td>
                    <td className="py-2">Cuando puedes corregir el error o aportar documentación faltante.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">RS03</td>
                    <td className="py-2 pr-4">Rechazar</td>
                    <td className="py-2">Cuando la glosa no tiene fundamento y puedes argumentarlo.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">RS04</td>
                    <td className="py-2 pr-4">Extemporánea</td>
                    <td className="py-2">Cuando la EPS emitió la glosa fuera del plazo de 20 días hábiles.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">RS05</td>
                    <td className="py-2 pr-4">Excepción</td>
                    <td className="py-2">Cuando existen razones legales para rechazar la glosa.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Sugerencia IA:</strong> Al abrir una glosa, Medibill
                analiza el causal y la documentación disponible para sugerirte
                el tipo de respuesta más apropiado y generar un borrador de
                argumentación. Siempre revisa y personaliza la respuesta antes
                de enviarla.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Plazos legales
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>Medibill calcula los plazos en días hábiles automáticamente (excluyendo fines de semana y festivos colombianos):</p>
            <ul className="mt-3 space-y-2">
              <li><strong>22 días hábiles:</strong> Para radicar la factura desde su emisión.</li>
              <li><strong>5 días hábiles:</strong> Plazo de la EPS para devolver si la documentación está incompleta.</li>
              <li><strong>20 días hábiles:</strong> Plazo de la EPS para emitir glosa desde la radicación.</li>
              <li><strong>15 días hábiles:</strong> Tu plazo para responder la glosa.</li>
              <li><strong>15 días hábiles:</strong> Plazo de la EPS para tomar decisión después de tu respuesta.</li>
            </ul>
            <div className="mt-3 rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Importante:</strong> Las glosas con plazo próximo a
                vencer aparecen con un badge rojo en la barra lateral. Revísalas
                diariamente para no perder un vencimiento.
              </p>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
