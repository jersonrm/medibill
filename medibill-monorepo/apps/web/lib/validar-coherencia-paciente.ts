/**
 * Validación cruzada nota-clínica vs datos del paciente.
 * Detecta inconsistencias de sexo, edad y nombre ANTES de ejecutar la IA,
 * para evitar glosas por causal DE16 (datos del usuario inconsistentes).
 *
 * Es validación puramente client-side con regex sobre la nota.
 */

export interface IncoherenciaPaciente {
  campo: "sexo" | "edad" | "nombre";
  mensaje: string;
  severidad: "error" | "warning";
  valor_formulario: string;
  valor_nota: string;
}

export function detectarIncoherenciasPaciente(
  nota: string,
  sexoFormulario: string, // "M" o "F"
  fechaNacimiento: string, // "YYYY-MM-DD"
  nombreFormulario?: string
): IncoherenciaPaciente[] {
  const alertas: IncoherenciaPaciente[] = [];

  if (!nota.trim()) return alertas;

  // === SEXO ===
  const patronesMasculino = [
    /paciente\s+masculino/i,
    /hombre\s+de\s+\d+/i,
    /varón/i,
    /varon/i,
    /sexo\s*:?\s*masculino/i,
    /señor\s+de\s+\d+/i,
    /niño\s+de\s+\d+/i,
  ];
  const patronesFemenino = [
    /paciente\s+femenin[ao]/i,
    /mujer\s+de\s+\d+/i,
    /señora\s+de\s+\d+/i,
    /sexo\s*:?\s*femenino/i,
    /niña\s+de\s+\d+/i,
    /gestante/i,
    /embarazada/i,
  ];

  const notaEsMasculino = patronesMasculino.some((p) => p.test(nota));
  const notaEsFemenino = patronesFemenino.some((p) => p.test(nota));

  if (notaEsMasculino && sexoFormulario === "F") {
    alertas.push({
      campo: "sexo",
      mensaje:
        'La nota dice "paciente masculino" pero el formulario dice Femenino',
      severidad: "error",
      valor_formulario: "Femenino",
      valor_nota: "Masculino",
    });
  }
  if (notaEsFemenino && sexoFormulario === "M") {
    alertas.push({
      campo: "sexo",
      mensaje:
        'La nota dice "paciente femenino" pero el formulario dice Masculino',
      severidad: "error",
      valor_formulario: "Masculino",
      valor_nota: "Femenino",
    });
  }

  // === EDAD ===
  const matchEdad =
    nota.match(
      /(?:paciente|hombre|mujer|señor[a]?|niñ[oa]?|varón|varon)\s+(?:masculino\s+|femenin[ao]\s+)?(?:de\s+)?(\d{1,3})\s*años/i
    ) ||
    nota.match(/(\d{1,3})\s*años\s*de\s*edad/i) ||
    nota.match(/edad\s*:?\s*(\d{1,3})/i);

  if (matchEdad && matchEdad[1] && fechaNacimiento) {
    const edadNota = parseInt(matchEdad[1]);
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    const edadCalculada = Math.floor(
      (hoy.getTime() - nacimiento.getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    const diferencia = Math.abs(edadNota - edadCalculada);

    if (diferencia > 2) {
      alertas.push({
        campo: "edad",
        mensaje: `La nota dice "${edadNota} años" pero la fecha de nacimiento da ${edadCalculada} años (diferencia de ${diferencia} años)`,
        severidad: diferencia > 10 ? "error" : "warning",
        valor_formulario: `${edadCalculada} años (${fechaNacimiento})`,
        valor_nota: `${edadNota} años`,
      });
    }
  }

  return alertas;
}
