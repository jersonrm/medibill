export default function ClasificacionIaAyudaPage() {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-8">
      <h2 className="text-2xl font-bold text-medi-deep">🤖 Clasificación con IA</h2>
      <p className="mt-2 text-gray-600">
        Entiende cómo funciona el motor de clasificación automática de códigos
        CUPS y CIE-10 con inteligencia artificial.
      </p>

      <hr className="my-6 border-gray-100" />

      <section className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            ¿Cómo funciona?
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Cuando pegas una nota clínica y haces clic en
              <strong> Clasificar</strong>, el sistema ejecuta un flujo de
              cuatro etapas:
            </p>
            <ol className="mt-3 list-inside space-y-3">
              <li>
                <strong>1. Anonimización:</strong> Se eliminan nombres, números
                de documento y datos personales del texto antes de enviarlo al
                modelo de IA.
              </li>
              <li>
                <strong>2. Búsqueda semántica (RAG):</strong> Se extraen
                términos médicos de la nota y se buscan candidatos en nuestra
                base de datos de códigos CUPS y CIE-10 usando embeddings
                vectoriales. Esto permite encontrar el código correcto incluso
                cuando la descripción en la nota no es exacta.
              </li>
              <li>
                <strong>3. Clasificación con IA:</strong> Con los candidatos
                encontrados, el modelo de inteligencia artificial genera una
                lista estructurada de diagnósticos (con roles: principal,
                relacionados, causa externa) y procedimientos (con cantidades y
                códigos).
              </li>
              <li>
                <strong>4. Validación:</strong> Cada código es validado contra
                los catálogos oficiales. Se verifica coherencia
                diagnóstico-procedimiento, coherencia anatómica y se aplican tus
                tarifas personalizadas.
              </li>
            </ol>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Tips para mejores resultados
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <ul className="space-y-3">
              <li>
                <strong>Sé específico en la nota clínica:</strong> Incluye el
                motivo de consulta, hallazgos clínicos relevantes, diagnóstico y
                plan de manejo. Cuanta más información, más precisa será la
                clasificación.
              </li>
              <li>
                <strong>Incluye lateralidad:</strong> Si un procedimiento es
                bilateral (ej: &quot;oído derecho&quot;), menciónalo en la nota.
                La IA usa esta información para la validación anatómica.
              </li>
              <li>
                <strong>Menciona procedimientos realizados:</strong> Si
                aplicaste una inyección, tomaste una muestra o realizaste una
                curación, descríbelo brevemente.
              </li>
              <li>
                <strong>No te preocupes por el formato:</strong> Puedes escribir
                en texto libre, con abreviaturas médicas o en formato SOAP.
                El modelo entiende múltiples formatos.
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Revisar y ajustar resultados
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Después de la clasificación, verás dos paneles de resultados:
            </p>
            <ul className="mt-3 space-y-3">
              <li>
                <strong>Diagnósticos (CIE-10):</strong> Lista con el diagnóstico
                principal, diagnósticos relacionados y causa externa (si
                aplica). Cada diagnóstico muestra el código, descripción y
                alternativas sugeridas que puedes seleccionar con un clic.
              </li>
              <li>
                <strong>Procedimientos (CUPS):</strong> Lista de procedimientos
                con código, descripción, cantidad, valor unitario (según tus
                tarifas) e indicador de fuente tarifaria. Puedes editar la
                cantidad o eliminar procedimientos.
              </li>
            </ul>
            <div className="mt-3 rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Si un código sugerido no es exacto, puedes
                usar el buscador de códigos (icono de lupa) para buscar
                manualmente por nombre o código CUPS/CIE-10.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-medi-dark">
            Auditoría y trazabilidad
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              Cada clasificación queda registrada en el registro de auditoría con:
            </p>
            <ul className="mt-3 space-y-2">
              <li>• La nota clínica original (anonimizada)</li>
              <li>• Los códigos sugeridos por la IA</li>
              <li>• Los códigos finales seleccionados por el profesional</li>
              <li>• Fecha, hora y usuario que realizó la clasificación</li>
            </ul>
            <p className="mt-3">
              Esta información es útil para auditorías internas y para demostrar
              el proceso de codificación ante las EPS.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
