export default function PagosAyudaPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">💰 Pagos y Cartera</h2>
      <p className="mt-2 text-gray-600">
        Gestiona tu cartera, importa sábanas de pago y concilia automáticamente
        los pagos de las EPS.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Vista de cartera
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              La sección <strong>Cartera</strong> en la barra lateral te muestra
              todas las facturas pendientes de pago, organizadas por:
            </p>
            <ul className="mt-3 space-y-2">
              <li><strong>Estado:</strong> Radicadas, en trámite, glosadas, por cobrar.</li>
              <li><strong>Antigüedad:</strong> Días desde la radicación.</li>
              <li><strong>EPS:</strong> Agrupadas por entidad pagadora.</li>
            </ul>
            <p className="mt-3">
              Las facturas con pago vencido se destacan con un indicador rojo
              y aparecen en el badge del sidebar.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Importar sábana de pagos
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Cuando una EPS realiza un pago, normalmente envía un archivo Excel
              (&quot;sábana&quot;) con el detalle de las facturas incluidas. Para
              importarla:
            </p>
            <ol className="mt-3 list-inside space-y-3">
              <li>
                <strong>1.</strong> Ve a{" "}
                <strong>Cartera {">"} Importar sábana</strong>.
              </li>
              <li>
                <strong>2.</strong> Arrastra o selecciona el archivo Excel
                (.xlsx).
              </li>
              <li>
                <strong>3.</strong> Medibill detecta automáticamente las columnas
                del archivo y mapea los campos: número de factura, valor
                facturado, valor aprobado, valor glosado y valor pagado.
              </li>
              <li>
                <strong>4.</strong> Revisa el mapeo y ajústalo si es necesario.
              </li>
              <li>
                <strong>5.</strong> Haz clic en <strong>Procesar</strong>. El
                sistema cruzará los datos del archivo con tus facturas y
                actualizará los estados automáticamente.
              </li>
            </ol>
            <div className="mt-3 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Cada EPS puede tener un formato diferente
                de sábana. Medibill recuerda el mapeo anterior para cada EPS,
                así que la importación se vuelve más rápida con el uso.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Conciliación automática
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              La conciliación automática cruza el pago reportado en la sábana
              con el valor facturado para cada factura:
            </p>
            <ul className="mt-3 space-y-3">
              <li>
                <strong>Pago total:</strong> Si el monto pagado coincide con
                el facturado, la factura se marca como <strong>Pagada</strong>.
              </li>
              <li>
                <strong>Pago parcial:</strong> Si el monto pagado es menor, se
                calcula la diferencia y se puede generar una glosa o registrar
                un saldo pendiente.
              </li>
              <li>
                <strong>Sin pago:</strong> Si la factura no aparece en la
                sábana, permanece como pendiente de pago.
              </li>
            </ul>
            <p className="mt-3">
              Después de la conciliación, puedes ver un resumen con el total
              facturado vs. total pagado y el porcentaje de recuperación por EPS.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Indicadores de cartera
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              En el <strong>Dashboard</strong> puedes ver indicadores clave de
              tu cartera:
            </p>
            <ul className="mt-3 space-y-2">
              <li>• Total facturado en el período</li>
              <li>• Total cobrado / pagado</li>
              <li>• Total glosado</li>
              <li>• Porcentaje de recuperación</li>
              <li>• Distribución por EPS</li>
              <li>• Facturas con mayor antigüedad</li>
            </ul>
          </div>
        </div>
      </section>
    </article>
  );
}
