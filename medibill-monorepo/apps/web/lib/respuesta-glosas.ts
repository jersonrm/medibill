/**
 * Módulo de Respuesta a Glosas — Medibill
 *
 * Genera respuestas automatizadas o asistidas por IA para cada glosa recibida,
 * basándose en el catálogo taxativo de la Res. 2284/2023 y los plazos legales.
 *
 * Códigos de respuesta:
 *  RS01 — Acepta la glosa → genera nota crédito
 *  RS02 — Subsana → adjunta soporte faltante/corregido
 *  RS03 — Rechaza por improcedente → cita norma y evidencia
 *  RS04 — Rechaza por extemporánea → glosa fuera de plazo
 *  RS05 — Rechaza por excepción → urgencias, CRUE, etc.
 */

import type {
  GlosaDB,
  GlosaConDetalle,
  RespuestaGlosaDB,
  CodigoRespuesta,
  CausalGlosaDB,
  AuditoriaPlazoUI,
  FacturaDB,
} from "@/lib/types/glosas";
import { PLAZOS_LEGALES } from "@/lib/types/glosas";

// =====================================================================
// TIPOS
// =====================================================================

/** Solicitud para generar una respuesta */
export interface SolicitudRespuesta {
  glosa: GlosaConDetalle;
  modo: "automatica" | "asistida" | "manual";
  /** Si modo=manual, el usuario provee estos datos */
  datos_manuales?: {
    codigo_respuesta: CodigoRespuesta;
    justificacion: string;
    fundamento_legal?: string;
    soporte_url?: string;
    soporte_nombre?: string;
  };
}

/** Resultado de la generación de respuesta */
export interface ResultadoRespuesta {
  exito: boolean;
  respuesta: RespuestaGlosaDB | null;
  advertencias: string[];
  /** Si RS01 → monto que se debe acreditar */
  nota_credito?: number;
}

// =====================================================================
// REGLAS DE EXCEPCIONES (Res. 2284/2023)
// =====================================================================

/** Excepciones que invalidan ciertas glosas y devoluciones */
const EXCEPCIONES_LEGALES: Record<string, {
  aplica_para: string[];
  condicion: string;
  fundamento: string;
}> = {
  urgencias: {
    aplica_para: ["DE4401", "DE4402", "AU0101", "AU0102"],
    condicion: "Atención fue prestada en contexto de urgencias (Art. 168 Ley 100/1993)",
    fundamento: "Art. 168 Ley 100/1993 — Atención de urgencias obligatoria sin autorización previa. " +
      "Art. 67 Ley 715/2001. Res. 2284/2023 Anexo Técnico 3, notas AU.",
  },
  crue: {
    aplica_para: ["DE4401", "DE4402"],
    condicion: "Prestador fue asignado por el CRUE (Centro Regulador de Urgencias y Emergencias)",
    fundamento: "Res. 2284/2023 Anexo Técnico 3 — Excepción DE44: cuando CRUE define prestador.",
  },
  autorizacion_previa: {
    aplica_para: ["DE4401", "DE4402"],
    condicion: "La ERP autorizó previamente la atención en este prestador",
    fundamento: "Res. 2284/2023 Anexo Técnico 3 — Excepción DE44: cuando ERP autorizó previamente.",
  },
  silencio_erp: {
    aplica_para: ["DE4401", "DE4402"],
    condicion: "La ERP no se pronunció dentro del plazo legal",
    fundamento: "Res. 2284/2023 Anexo Técnico 3 — Silencio ERP: devolución se entiende injustificada. " +
      "Art. 57 Ley 1438/2011.",
  },
  sin_contrato_lista_precios: {
    aplica_para: ["TA0201", "TA0301", "TA5801"],
    condicion: "No existe acuerdo de voluntades vigente — se aplica lista de precios del prestador",
    fundamento: "Circular Conjunta 007/2025 — En ausencia de acuerdo, aplican tarifas del prestador. " +
      "Art. 2.5.3.4.2.2.1 Dcto 780/2016.",
  },
  paciente_inconsciente: {
    aplica_para: ["DE1601"],
    condicion: "Paciente llegó inconsciente/indocumentado y fue reportado a entidad territorial",
    fundamento: "Res. 2284/2023 Anexo Técnico 3 — Excepción DE16: paciente inconsciente reportado.",
  },
};

// =====================================================================
// GENERADOR DE RESPUESTAS
// =====================================================================

export class GeneradorRespuestaGlosas {
  /** Catálogo de causales para verificación de legalidad */
  private catalogoCodigos: Set<string> | null = null;

  /**
   * Configura el catálogo de códigos válidos para detectar glosas ilegales.
   * Debe llamarse con los códigos de la tabla catalogo_causales_glosa.
   */
  configurarCatalogo(codigos: string[]): void {
    this.catalogoCodigos = new Set(codigos);
  }

  /**
   * Genera una respuesta para una glosa individual.
   */
  generarRespuesta(solicitud: SolicitudRespuesta): ResultadoRespuesta {
    const { glosa, modo } = solicitud;
    const advertencias: string[] = [];

    // 1. Verificar si la glosa fue formulada fuera de plazo → RS04
    const respuestaExtemporanea = this.verificarExtemporaneidad(glosa);
    if (respuestaExtemporanea) {
      return {
        exito: true,
        respuesta: respuestaExtemporanea,
        advertencias: ["Glosa extemporánea detectada. Respuesta automática RS04 generada."],
      };
    }

    // 2. Verificar si el código de glosa existe en el Manual Único (Circular 007/2025)
    const respuestaIlegal = this.verificarLegalidad(glosa);
    if (respuestaIlegal) {
      return {
        exito: true,
        respuesta: respuestaIlegal,
        advertencias: [
          "Glosa ILEGAL detectada: el código no existe en el Manual Único (Res. 2284/2023). " +
          "Respuesta automática RS05 generada citando Art. 4 Res. 2284/2023 y Circular 007/2025.",
        ],
      };
    }

    // 3. Verificar excepciones legales → RS05
    const respuestaExcepcion = this.verificarExcepciones(glosa);
    if (respuestaExcepcion && modo !== "manual") {
      advertencias.push("Excepción legal detectada. Se sugiere RS05.");
      if (modo === "automatica") {
        return { exito: true, respuesta: respuestaExcepcion, advertencias };
      }
      // modo asistida → prepara borrador pero no envía
    }

    // 4. Modo manual: usar datos del usuario
    if (modo === "manual" && solicitud.datos_manuales) {
      const resp = this.crearRespuesta(
        glosa,
        solicitud.datos_manuales.codigo_respuesta,
        solicitud.datos_manuales.justificacion,
        "manual",
        solicitud.datos_manuales.fundamento_legal,
        solicitud.datos_manuales.soporte_url,
        solicitud.datos_manuales.soporte_nombre,
      );

      if (resp.codigo_respuesta === "RS01") {
        return {
          exito: true,
          respuesta: resp,
          advertencias,
          nota_credito: glosa.valor_glosado,
        };
      }

      return { exito: true, respuesta: resp, advertencias };
    }

    // 5. Modo automática/asistida: elegir mejor respuesta
    const respuestaAuto = this.generarRespuestaAutomatica(glosa);
    if (respuestaAuto.codigo_respuesta === "RS01") {
      advertencias.push(
        `Se recomienda aceptar esta glosa. Razón: ${respuestaAuto.justificacion}`
      );
      return {
        exito: true,
        respuesta: respuestaAuto,
        advertencias,
        nota_credito: glosa.valor_glosado,
      };
    }

    return { exito: true, respuesta: respuestaAuto, advertencias };
  }

  /**
   * Genera respuestas masivas para múltiples glosas.
   */
  generarRespuestasMasivas(
    glosas: GlosaConDetalle[],
    modo: "automatica" | "asistida" = "automatica"
  ): ResultadoRespuesta[] {
    return glosas.map((glosa) =>
      this.generarRespuesta({ glosa, modo })
    );
  }

  // -------------------------------------------------------------------
  // VERIFICACIONES LEGALES
  // -------------------------------------------------------------------

  /**
   * RS04 — Verifica si la glosa fue formulada fuera del plazo de 20 días hábiles.
   * Art. 57 Ley 1438/2011.
   */
  private verificarExtemporaneidad(glosa: GlosaConDetalle): RespuestaGlosaDB | null {
    // Si tenemos plazo y está marcado como vencido (formulación)
    if (glosa.plazo?.vencido && glosa.plazo.tipo_plazo === "formulacion_glosa") {
      return this.crearRespuesta(
        glosa,
        "RS04",
        `Se rechaza la glosa ${glosa.codigo_causal} por EXTEMPORÁNEA. ` +
          `La EPS formuló la glosa fuera del plazo legal de ${PLAZOS_LEGALES.formulacion_glosa} días hábiles ` +
          `desde la radicación de los soportes. Fecha formulación: ${new Date(glosa.fecha_formulacion).toLocaleDateString("es-CO")}. ` +
          `Fecha límite: ${new Date(glosa.plazo.fecha_limite).toLocaleDateString("es-CO")}.`,
        "automatica",
        "Art. 57 Ley 1438/2011: la EPS tiene 20 días hábiles para formular glosas. " +
          "Res. 2284/2023, Art. 8: plazos para formulación. " +
          "Vencido el plazo, opera silencio administrativo positivo a favor del prestador.",
      );
    }

    // Verificación directa si tenemos fecha de radicación de la factura
    if (glosa.factura && glosa.tipo === "glosa") {
      // Usar created_at de la factura como proxy de radicación
      const fechaRadicacion = new Date(glosa.created_at);
      const fechaFormulacion = new Date(glosa.fecha_formulacion);
      if (!esGlosaEnPlazo(fechaRadicacion, fechaFormulacion)) {
        return this.crearRespuesta(
          glosa,
          "RS04",
          `Se rechaza la glosa ${glosa.codigo_causal} por EXTEMPORÁNEA. ` +
            `Transcurrieron más de ${PLAZOS_LEGALES.formulacion_glosa} días hábiles entre la radicación y la formulación.`,
          "automatica",
          "Art. 57 Ley 1438/2011. Res. 2284/2023, Art. 8.",
        );
      }
    }

    return null;
  }

  /**
   * Verifica si el código de la glosa existe en el Manual Único de Glosas
   * (Res. 2284/2023). Las causas del Manual son TAXATIVAS — la EPS NO puede
   * inventar códigos nuevos (Circular 007/2025).
   */
  private verificarLegalidad(glosa: GlosaConDetalle): RespuestaGlosaDB | null {
    // Si no se configuró el catálogo, no podemos verificar
    if (!this.catalogoCodigos) return null;

    if (!this.catalogoCodigos.has(glosa.codigo_causal)) {
      return this.crearRespuesta(
        glosa,
        "RS05",
        `Se rechaza la glosa con código "${glosa.codigo_causal}" por ILEGAL. ` +
          `El código utilizado por la EPS NO existe en el Manual Único de Devoluciones, Glosas y Respuestas ` +
          `(Resolución 2284 de 2023, Anexo Técnico 3). Las causas de glosa y devolución son TAXATIVAS ` +
          `y la EPS no puede formular glosas con códigos no contemplados en el Manual. ` +
          `Se solicita el levantamiento inmediato de la glosa y el pago de los intereses moratorios correspondientes.`,
        "automatica",
        "Art. 4 Resolución 2284 de 2023: las causas de devolución y glosa son las establecidas " +
          "en el Anexo Técnico No. 3 y son de carácter TAXATIVO. " +
          "Circular Conjunta 007 de 2025 (MinSalud + SuperSalud), §2: " +
          "las ERP no podrán formular glosas con causas distintas a las del Manual Único. " +
          "Art. 57 Ley 1438/2011: intereses moratorios por glosas infundadas.",
      );
    }

    return null;
  }

  /**
   * RS05 — Verifica si aplica alguna excepción legal.
   */
  private verificarExcepciones(glosa: GlosaConDetalle): RespuestaGlosaDB | null {
    for (const [nombre, excepcion] of Object.entries(EXCEPCIONES_LEGALES)) {
      if (excepcion.aplica_para.includes(glosa.codigo_causal)) {
        // En producción, se cruzaría con datos reales (ej: ¿fue urgencia?)
        // Por ahora, generar borrador de respuesta
        return this.crearRespuesta(
          glosa,
          "RS05",
          `La glosa ${glosa.codigo_causal} no procede. ${excepcion.condicion}. ` +
            `Se rechaza con base en la excepción de "${nombre}".`,
          "automatica",
          excepcion.fundamento,
        );
      }
    }
    return null;
  }

  // -------------------------------------------------------------------
  // GENERACIÓN AUTOMÁTICA
  // -------------------------------------------------------------------

  /**
   * Genera la mejor respuesta automática según el tipo de glosa.
   */
  private generarRespuestaAutomatica(glosa: GlosaConDetalle): RespuestaGlosaDB {
    const concepto = glosa.codigo_causal.slice(0, 2);

    switch (concepto) {
      case "FA":
        return this.responderFacturacion(glosa);
      case "TA":
        return this.responderTarifas(glosa);
      case "SO":
        return this.responderSoportes(glosa);
      case "AU":
        return this.responderAutorizacion(glosa);
      case "PE":
        return this.responderPertinencia(glosa);
      case "SC":
        return this.responderSeguimiento(glosa);
      default:
        // Devoluciones (DE) u otros
        return this.crearRespuesta(
          glosa,
          "RS03",
          `Se rechaza la glosa ${glosa.codigo_causal} por improcedente. ` +
            `Se adjuntan soportes que demuestran la correcta facturación del servicio.`,
          "automatica",
          "Res. 2284/2023 Anexo Técnico 3",
        );
    }
  }

  /** Respuesta a glosas de FACTURACIÓN (FA) */
  private responderFacturacion(glosa: GlosaConDetalle): RespuestaGlosaDB {
    // Si es diferencia de cantidades → subsanar si hay error, rechazar si no
    if (glosa.codigo_causal.endsWith("01")) {
      // Subcausales tipo XX01 = diferencias entre soportes y factura
      return this.crearRespuesta(
        glosa,
        "RS02",
        `Se adjuntan soportes actualizados que demuestran la concordancia entre ` +
          `los servicios prestados y las cantidades facturadas. ` +
          `Se solicita el levantamiento de la glosa ${glosa.codigo_causal}.`,
        "automatica",
        "Res. 2284/2023, Anexo Técnico 3, concepto FA — Facturación",
      );
    }

    // Duplicados (FA2702) → revisar, posible aceptación
    if (glosa.codigo_causal === "FA2702") {
      return this.crearRespuesta(
        glosa,
        "RS01",
        `Se acepta la glosa. Se verifica que el servicio fue facturado por duplicado. ` +
          `Se procederá a generar nota crédito por $${glosa.valor_glosado.toLocaleString("es-CO")}.`,
        "automatica",
      );
    }

    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. Los soportes adjuntos demuestran ` +
        `la correcta facturación del servicio conforme al acuerdo de voluntades vigente.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3",
    );
  }

  /** Respuesta a glosas de TARIFAS (TA) */
  private responderTarifas(glosa: GlosaConDetalle): RespuestaGlosaDB {
    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. El valor facturado corresponde a las ` +
        `tarifas pactadas en el acuerdo de voluntades vigente entre las partes. ` +
        `Se adjunta copia del acuerdo de voluntades con la tarifa aplicable.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3, concepto TA. " +
        "Art. 2.5.3.4.2.2.1 Dcto 780/2016 (obligatoriedad del acuerdo de voluntades). " +
        "Circular 007/2025 §4.3 (prohibición de mallas validadoras no oficiales).",
    );
  }

  /** Respuesta a glosas de SOPORTES (SO) */
  private responderSoportes(glosa: GlosaConDetalle): RespuestaGlosaDB {
    // Soportes faltantes → subsanar
    if (glosa.codigo_causal.endsWith("01") || glosa.codigo_causal.endsWith("03")) {
      return this.crearRespuesta(
        glosa,
        "RS02",
        `Se subsana la glosa ${glosa.codigo_causal}. Se adjunta el soporte ` +
          `faltante/corregido correspondiente al servicio glosado. ` +
          `Se solicita el levantamiento de la glosa.`,
        "automatica",
        "Res. 2284/2023, Anexo Técnico 3, concepto SO — Soportes. " +
          "Res. 2275/2023, Anexo Técnico 1 (contenido de soportes).",
      );
    }

    // Soporte no corresponde a persona → subsanar
    if (glosa.codigo_causal.endsWith("02")) {
      return this.crearRespuesta(
        glosa,
        "RS02",
        `Se subsana la glosa ${glosa.codigo_causal}. Se adjunta soporte ` +
          `corregido con la identificación correcta del paciente.`,
        "automatica",
        "Res. 2284/2023, Anexo Técnico 3, concepto SO.",
      );
    }

    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. Los soportes presentados se ` +
        `encuentran completos y corresponden a la persona atendida, conforme al ` +
        `Anexo Técnico 1 de la Res. 2275/2023.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3, concepto SO. Res. 2275/2023, Anexo Técnico 1.",
    );
  }

  /** Respuesta a glosas de AUTORIZACIÓN (AU) */
  private responderAutorizacion(glosa: GlosaConDetalle): RespuestaGlosaDB {
    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. El servicio cuenta con ` +
        `autorización vigente al momento de la prestación. Se adjunta copia de la ` +
        `autorización y evidencia de la prestación del servicio dentro de su vigencia.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3, concepto AU. " +
        "Art. 130 Dcto Ley 019/2012 (silencio administrativo positivo en autorización). " +
        "Circular 007/2025 §3.2.",
    );
  }

  /** Respuesta a glosas de PERTINENCIA (PE) */
  private responderPertinencia(glosa: GlosaConDetalle): RespuestaGlosaDB {
    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. El servicio o tecnología en salud ` +
        `fue pertinente de acuerdo con la condición clínica documentada del paciente. ` +
        `Se adjuntan: (1) historia clínica con diagnóstico sustentado, ` +
        `(2) guía de práctica clínica o evidencia científica aplicable, ` +
        `(3) resumen de atención con justificación médica.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3, concepto PE. " +
        "Art. 105 Ley 1438/2011 (autonomía médica). " +
        "Ley 1751/2015 Art. 17 (autonomía profesional). " +
        "Circular 007/2025 §5.1 (prohibición de barreras al profesional).",
    );
  }

  /** Respuesta a glosas de SEGUIMIENTO a acuerdos (SC) */
  private responderSeguimiento(glosa: GlosaConDetalle): RespuestaGlosaDB {
    return this.crearRespuesta(
      glosa,
      "RS03",
      `Se rechaza la glosa ${glosa.codigo_causal}. Los indicadores de seguimiento ` +
        `pactados en el acuerdo de voluntades se encuentran dentro de los rangos ` +
        `acordados. Se adjunta reporte de indicadores del período.`,
      "automatica",
      "Res. 2284/2023, Anexo Técnico 3, concepto SC — Seguimiento a Acuerdos. " +
        "Acuerdo de voluntades vigente.",
    );
  }

  // -------------------------------------------------------------------
  // FACTORY
  // -------------------------------------------------------------------

  private crearRespuesta(
    glosa: GlosaConDetalle,
    codigo: CodigoRespuesta,
    justificacion: string,
    origen: "manual" | "automatica" | "ia",
    fundamento_legal?: string,
    soporte_url?: string,
    soporte_nombre?: string,
  ): RespuestaGlosaDB {
    return {
      id: crypto.randomUUID(),
      glosa_id: glosa.id,
      codigo_respuesta: codigo,
      justificacion,
      soporte_url: soporte_url ?? null,
      soporte_nombre: soporte_nombre ?? null,
      fundamento_legal: fundamento_legal ?? null,
      valor_nota_credito: codigo === "RS01" ? glosa.valor_glosado : 0,
      decision_erp: "pendiente",
      fecha_decision_erp: null,
      observacion_erp: null,
      generada_por: origen,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

// =====================================================================
// HELPERS DE PLAZOS
// =====================================================================

/** Calcula el plazo de respuesta para una glosa recibida hoy */
export function calcularPlazoRespuesta(fechaFormulacion: Date): {
  fecha_limite: Date;
  dias_habiles: number;
} {
  const dias = PLAZOS_LEGALES.respuesta_prestador;
  const limite = sumarDiasHabilesJS(fechaFormulacion, dias);
  return { fecha_limite: limite, dias_habiles: dias };
}

/** Calcula días hábiles restantes para responder */
export function diasHabilesRestantes(fechaLimite: Date): number {
  const hoy = new Date();
  if (hoy >= fechaLimite) return 0;
  let dias = 0;
  const d = new Date(hoy);
  while (d < fechaLimite) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) dias++;
  }
  return dias;
}

/** Verifica si una glosa fue formulada dentro de plazo (20 días hábiles) */
export function esGlosaEnPlazo(fechaRadicacion: Date, fechaFormulacion: Date): boolean {
  const limite = sumarDiasHabilesJS(fechaRadicacion, PLAZOS_LEGALES.formulacion_glosa);
  return fechaFormulacion <= limite;
}

function sumarDiasHabilesJS(fecha: Date, n: number): Date {
  const result = new Date(fecha);
  let conteo = 0;
  while (conteo < n) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) conteo++;
  }
  return result;
}

// =====================================================================
// INSTANCIA SINGLETON
// =====================================================================

export const generadorRespuestas = new GeneradorRespuestaGlosas();
