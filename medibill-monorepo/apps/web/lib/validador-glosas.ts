/**
 * Servicio Validador de Pre-Radicación — Medibill
 *
 * Ejecuta reglas de validación sobre la factura y su FEV-RIPS ANTES de radicar
 * ante la EPS, con el objetivo de prevenir el ~70% de glosas y devoluciones.
 *
 * Capas de validación:
 *  Capa 1 — Prevención automática: duplicados, plazos, estructura RIPS
 *  Capa 2 — Alerta/verificación: tarifas, autorizaciones, afiliación
 *  Capa 3 — Respuesta/defensa: pertinencia, coherencia clínica
 *
 * Fuente legal: Resolución 2284/2023, Circular 007/2025, Resolución 2275/2023
 */

import type { FevRips, ConsultaRips, ProcedimientoRips } from "@/lib/types/rips";
import type {
  FacturaDB,
  ValidacionPreRadicacionDB,
  ResultadoValidacion,
  SeveridadValidacion,
  CausalGlosaDB,
  Alerta,
  CategoriaAlerta,
  DatosFactura,
  ReglaCoherenciaDB,
} from "@/lib/types/glosas";

// =====================================================================
// TIPOS INTERNOS
// =====================================================================

interface HallazgoInterno {
  codigo_causal: string;
  severidad: SeveridadValidacion;
  mensaje: string;
  campo_afectado?: string;
  valor_encontrado?: string;
  valor_esperado?: string;
  /** Contexto para Alerta */
  categoria: CategoriaAlerta;
  detalle: string;
  como_resolver: string;
  servicio_afectado?: string;
  norma_legal: string;
}

/** Configuración del acuerdo de voluntades (contrato IPS ↔ EPS) */
export interface AcuerdoVoluntades {
  nit_erp: string;
  nombre_erp: string;
  requiere_autorizacion: boolean;
  tarifas: Record<string, number>; // CUPS → valor pactado
  paquetes: string[];              // CUPS incluidos en paquetes agrupados
  descuentos: Record<string, number>; // CUPS → % descuento
  vigencia_desde: string;
  vigencia_hasta: string;
}

/** Contexto completo para la validación */
export interface ContextoValidacion {
  factura: FacturaDB;
  fevRips: FevRips;
  acuerdo?: AcuerdoVoluntades;
  catalogo: CausalGlosaDB[];
  facturasExistentes?: Pick<FacturaDB, "num_factura" | "estado">[];
  /** Datos enriquecidos de factura (paciente, soportes, etc.) */
  datosFactura?: DatosFactura;
  /** Reglas de coherencia diagnóstico-procedimiento-sexo-edad */
  reglasCoherencia?: ReglaCoherenciaDB[];
  /** Fecha de referencia para validaciones temporales (default: new Date()) */
  fechaReferencia?: Date;
}

// =====================================================================
// FESTIVOS COLOMBIANOS 2025-2026 (Ley 51 de 1983)
// =====================================================================

const FESTIVOS_COLOMBIA: Set<string> = new Set([
  // 2025
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José (trasladado)
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-02", // Ascensión del Señor (trasladado)
  "2025-06-23", // Corpus Christi (trasladado)
  "2025-06-30", // Sagrado Corazón (trasladado)
  "2025-07-20", // Independencia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // Asunción de la Virgen (trasladado)
  "2025-10-13", // Día de la Raza (trasladado)
  "2025-11-03", // Todos los Santos (trasladado)
  "2025-11-17", // Independencia de Cartagena (trasladado)
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos (trasladado)
  "2026-03-23", // San José (trasladado)
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión del Señor (trasladado)
  "2026-06-08", // Corpus Christi (trasladado)
  "2026-06-15", // Sagrado Corazón (trasladado)
  "2026-07-20", // Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción de la Virgen (trasladado)
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos (trasladado)
  "2026-11-16", // Independencia de Cartagena (trasladado)
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
]);

/** Verifica si una fecha es festivo colombiano */
function esFestivo(fecha: Date): boolean {
  return FESTIVOS_COLOMBIA.has(fecha.toISOString().slice(0, 10));
}

/** Verifica si una fecha es día hábil (lun-vie, no festivo) */
function esDiaHabil(fecha: Date): boolean {
  const dow = fecha.getDay();
  return dow !== 0 && dow !== 6 && !esFestivo(fecha);
}

// =====================================================================
// UTILIDADES DE FECHA
// =====================================================================

/** Suma N días hábiles (lun-vie, excluye festivos colombianos) a una fecha */
function sumarDiasHabiles(fecha: Date, n: number): Date {
  const result = new Date(fecha);
  let conteo = 0;
  while (conteo < n) {
    result.setDate(result.getDate() + 1);
    if (esDiaHabil(result)) conteo++;
  }
  return result;
}

/** Cuenta días hábiles entre dos fechas (excluye festivos colombianos) */
function diasHabilesEntre(inicio: Date, fin: Date): number {
  let dias = 0;
  const d = new Date(inicio);
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    if (esDiaHabil(d)) dias++;
  }
  return dias;
}

// =====================================================================
// CLASE PRINCIPAL DEL VALIDADOR
// =====================================================================

export class ValidadorPreRadicacion {
  private hallazgos: HallazgoInterno[] = [];
  private ctx: ContextoValidacion;
  private fechaRef: Date;

  constructor(ctx: ContextoValidacion) {
    this.ctx = ctx;
    this.fechaRef = ctx.fechaReferencia ?? new Date();
  }

  // -------------------------------------------------------------------
  // MÉTODO PRINCIPAL
  // -------------------------------------------------------------------

  /** Ejecuta TODAS las reglas y devuelve el resultado */
  validar(): ResultadoValidacion {
    this.hallazgos = [];

    // Capa 1: Prevención automática
    this.validarPlazoRadicacion();
    this.validarDuplicadoFactura();
    this.validarEstructuraRips();
    this.validarConsistenciaCantidades();
    this.validarDuplicadoServicios();
    this.validarSoportesMinimos();
    this.validarSoportesPorTipoServicio();
    this.validarAutorizaciones();
    this.validarVigenciaAutorizacion();
    this.validarCopagos();

    // Capa 2: Alertas y verificaciones
    this.validarAcuerdoVigente();
    this.validarTarifas();
    this.validarPaquetesAgrupados();
    this.validarDescuentos();
    this.validarCoberturaAseguramiento();

    // Capa 3: Coherencia clínica
    this.validarCoherenciaDiagnosticoProcedimiento();
    this.validarCoherenciaSexo();
    this.validarCoherenciaEdad();
    this.validarReglasCoherenciaBD();
    this.validarPertinenciaEstancia();

    // Construir resultado
    const errores = this.hallazgos.filter((h) => h.severidad === "error").length;
    const advertencias = this.hallazgos.filter((h) => h.severidad === "advertencia").length;
    const informativos = this.hallazgos.filter((h) => h.severidad === "info").length;

    const hallazgosDB: ValidacionPreRadicacionDB[] = this.hallazgos.map((h, i) => ({
      id: crypto.randomUUID(),
      factura_id: this.ctx.factura.id,
      codigo_causal: h.codigo_causal,
      severidad: h.severidad,
      mensaje: h.mensaje,
      campo_afectado: h.campo_afectado ?? null,
      valor_encontrado: h.valor_encontrado ?? null,
      valor_esperado: h.valor_esperado ?? null,
      resuelta: false,
      resuelta_en: null,
      resuelta_por: null,
      created_at: new Date().toISOString(),
    }));

    // Construir alertas ricas (Spec §2 — Alerta[])
    const alertas: Alerta[] = this.hallazgos.map((h) => ({
      codigo_glosa: h.codigo_causal,
      tipo: h.severidad === "error" ? "error" as const
        : h.severidad === "advertencia" ? "warning" as const
        : "info" as const,
      categoria: h.categoria,
      mensaje: h.mensaje,
      detalle: h.detalle,
      como_resolver: h.como_resolver,
      servicio_afectado: h.servicio_afectado,
      norma_legal: h.norma_legal,
    }));

    // Códigos únicos de glosa prevenida
    const glosas_potenciales_prevenidas = [
      ...new Set(this.hallazgos.map((h) => h.codigo_causal)),
    ];

    // Puntaje de riesgo: 0-100 (ponderado por severidad)
    const puntaje_riesgo_glosa = this.calcularPuntajeRiesgo();

    return {
      factura_id: this.ctx.factura.id,
      num_factura: this.ctx.factura.num_factura,
      fecha_validacion: new Date().toISOString(),
      total_hallazgos: this.hallazgos.length,
      errores,
      advertencias,
      informativos,
      puede_radicar: errores === 0,
      hallazgos: hallazgosDB,
      alertas,
      puntaje_riesgo_glosa,
      glosas_potenciales_prevenidas,
    };
  }

  // -------------------------------------------------------------------
  // PUNTAJE DE RIESGO (0-100)
  // -------------------------------------------------------------------

  /**
   * Calcula un score de riesgo de glosa entre 0 y 100.
   * - Cada error suma 15 puntos
   * - Cada advertencia suma 5 puntos
   * - Cada informativo suma 1 punto
   * - Tope en 100
   */
  private calcularPuntajeRiesgo(): number {
    let score = 0;
    for (const h of this.hallazgos) {
      if (h.severidad === "error") score += 15;
      else if (h.severidad === "advertencia") score += 5;
      else score += 1;
    }
    return Math.min(100, score);
  }

  // -------------------------------------------------------------------
  // CAPA 1 — PREVENCIÓN AUTOMÁTICA
  // -------------------------------------------------------------------

  /**
   * DE56 / DE5601 — Plazo de radicación de soportes.
   * 22 días hábiles desde expedición de la FEV.
   * Art. 56 Res. 2284/2023.
   */
  private validarPlazoRadicacion(): void {
    const fechaExp = new Date(this.ctx.factura.fecha_expedicion);
    const limite = sumarDiasHabiles(fechaExp, 22);
    const hoy = this.fechaRef;

    if (hoy > limite) {
      this.emit({
        codigo_causal: "DE5601",
        severidad: "error",
        mensaje: `CRÍTICO: Plazo de 22 días hábiles vencido. Fecha expedición: ${fechaExp.toISOString().slice(0, 10)}, límite: ${limite.toISOString().slice(0, 10)}. La EPS puede devolver la factura.`,
        campo_afectado: "factura.fecha_radicacion",
        valor_encontrado: hoy.toISOString().slice(0, 10),
        valor_esperado: `≤ ${limite.toISOString().slice(0, 10)}`,
      });
    } else {
      const diasRestantes = diasHabilesEntre(hoy, limite);
      if (diasRestantes <= 5) {
        this.emit({
          codigo_causal: "DE5601",
          severidad: "advertencia",
          mensaje: `Quedan ${diasRestantes} días hábiles para radicar soportes. Límite: ${limite.toISOString().slice(0, 10)}.`,
          campo_afectado: "factura.fecha_radicacion",
        });
      }
    }
  }

  /**
   * DE50 / DE5001 / DE5002 — Factura ya pagada o en trámite.
   * No se puede re-radicar una factura ya radicada.
   */
  private validarDuplicadoFactura(): void {
    const existentes = this.ctx.facturasExistentes ?? [];
    const dup = existentes.find(
      (f) =>
        f.num_factura === this.ctx.factura.num_factura &&
        f.estado !== "borrador"
    );
    if (dup) {
      this.emit({
        codigo_causal: dup.estado === "pagada" ? "DE5001" : "DE5002",
        severidad: "error",
        mensaje: `Factura ${this.ctx.factura.num_factura} ya existe con estado "${dup.estado}". No se puede radicar de nuevo.`,
        campo_afectado: "factura.num_factura",
        valor_encontrado: dup.estado,
        valor_esperado: "borrador (nueva)",
      });
    }
  }

  /**
   * Validación estructural del JSON FEV-RIPS (Res. 2275/2023).
   * Verifica campos obligatorios en usuarios y servicios.
   */
  private validarEstructuraRips(): void {
    const fev = this.ctx.fevRips;

    // Raíz
    if (!fev.numDocumentoIdObligado) {
      this.emit({
        codigo_causal: "SO3405",
        severidad: "error",
        mensaje: "Falta NIT del obligado (numDocumentoIdObligado) en FEV-RIPS.",
        campo_afectado: "fevRips.numDocumentoIdObligado",
      });
    }

    if (!fev.numFactura) {
      this.emit({
        codigo_causal: "SO3405",
        severidad: "error",
        mensaje: "Falta número de factura (numFactura) en FEV-RIPS.",
        campo_afectado: "fevRips.numFactura",
      });
    }

    // Usuarios
    if (!fev.usuarios || fev.usuarios.length === 0) {
      this.emit({
        codigo_causal: "SO3405",
        severidad: "error",
        mensaje: "El FEV-RIPS no contiene ningún usuario.",
        campo_afectado: "fevRips.usuarios",
      });
      return;
    }

    for (let i = 0; i < fev.usuarios.length; i++) {
      const u = fev.usuarios[i]!;
      if (!u.numDocumentoIdentificacion) {
        this.emit({
          codigo_causal: "SO3406",
          severidad: "error",
          mensaje: `Usuario[${i}]: falta documento de identificación.`,
          campo_afectado: `fevRips.usuarios[${i}].numDocumentoIdentificacion`,
        });
      }
      if (!u.fechaNacimiento || !/^\d{4}-\d{2}-\d{2}$/.test(u.fechaNacimiento)) {
        this.emit({
          codigo_causal: "SO3405",
          severidad: "error",
          mensaje: `Usuario[${i}]: fecha de nacimiento inválida o faltante. Formato esperado: YYYY-MM-DD.`,
          campo_afectado: `fevRips.usuarios[${i}].fechaNacimiento`,
          valor_encontrado: u.fechaNacimiento ?? "(vacío)",
        });
      }
    }
  }

  /**
   * FA01-FA08, FA23, FA57, FA58 — Consistencia cantidades.
   * Verifica que las cantidades facturadas coincidan con los registros RIPS.
   */
  private validarConsistenciaCantidades(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    // Consultas: verificar que cada consulta tenga diagnóstico principal
    for (let i = 0; i < (servicios.consultas?.length ?? 0); i++) {
      const c = servicios.consultas![i]!;
      if (!c.codDiagnosticoPrincipal) {
        this.emit({
          codigo_causal: "FA0201",
          severidad: "error",
          mensaje: `Consulta[${i}] (CUPS: ${c.codigoConsulta}): falta diagnóstico principal CIE-10.`,
          campo_afectado: `fevRips.servicios.consultas[${i}].codDiagnosticoPrincipal`,
        });
      }
      if (c.vrServicio <= 0) {
        this.emit({
          codigo_causal: "FA0201",
          severidad: "error",
          mensaje: `Consulta[${i}] (CUPS: ${c.codigoConsulta}): valor del servicio es 0 o negativo.`,
          campo_afectado: `fevRips.servicios.consultas[${i}].vrServicio`,
          valor_encontrado: String(c.vrServicio),
          valor_esperado: "> 0",
        });
      }
    }

    // Procedimientos: verificar código y valor
    for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
      const p = servicios.procedimientos![i]!;
      if (!p.codigoProcedimiento) {
        this.emit({
          codigo_causal: "FA5801",
          severidad: "error",
          mensaje: `Procedimiento[${i}]: falta código CUPS.`,
          campo_afectado: `fevRips.servicios.procedimientos[${i}].codigoProcedimiento`,
        });
      }
      if (!p.codDiagnosticoPrincipal) {
        this.emit({
          codigo_causal: "SO0301",
          severidad: "error",
          mensaje: `Procedimiento[${i}] (CUPS: ${p.codigoProcedimiento}): falta diagnóstico principal.`,
          campo_afectado: `fevRips.servicios.procedimientos[${i}].codDiagnosticoPrincipal`,
        });
      }
    }

    // Medicamentos
    for (let i = 0; i < (servicios.medicamentos?.length ?? 0); i++) {
      const m = servicios.medicamentos![i]!;
      if (!m.codigoMedicamento) {
        this.emit({
          codigo_causal: "FA0701",
          severidad: "error",
          mensaje: `Medicamento[${i}]: falta código CUM/ATC.`,
          campo_afectado: `fevRips.servicios.medicamentos[${i}].codigoMedicamento`,
        });
      }
      if (m.cantidadDispensada <= 0) {
        this.emit({
          codigo_causal: "FA0701",
          severidad: "advertencia",
          mensaje: `Medicamento[${i}] (${m.nombreGenerico || m.codigoMedicamento}): cantidad dispensada es 0 o negativa.`,
          campo_afectado: `fevRips.servicios.medicamentos[${i}].cantidadDispensada`,
          valor_encontrado: String(m.cantidadDispensada),
        });
      }
    }
  }

  /**
   * FA2702 — Detección de servicios duplicados.
   * Mismo paciente + mismo CUPS + misma fecha = posible duplicado.
   */
  private validarDuplicadoServicios(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    const claves = new Set<string>();
    const todos = [
      ...(servicios.consultas ?? []).map((c: ConsultaRips) => ({
        cups: c.codigoConsulta,
        doc: c.numDocumentoIdentificacion,
        fecha: c.fechaInicioAtencion,
        tipo: "consulta",
      })),
      ...(servicios.procedimientos ?? []).map((p: ProcedimientoRips) => ({
        cups: p.codigoProcedimiento,
        doc: p.numDocumentoIdentificacion,
        fecha: p.fechaInicioAtencion,
        tipo: "procedimiento",
      })),
    ];

    for (const s of todos) {
      const clave = `${s.doc}|${s.cups}|${s.fecha?.slice(0, 10)}`;
      if (claves.has(clave)) {
        this.emit({
          codigo_causal: "FA2702",
          severidad: "error",
          mensaje: `Servicio duplicado: ${s.tipo} CUPS ${s.cups}, paciente ${s.doc}, fecha ${s.fecha?.slice(0, 10)}. Ya existe en esta factura.`,
          campo_afectado: `fevRips.servicios`,
          valor_encontrado: clave,
        });
      }
      claves.add(clave);
    }
  }

  /**
   * SO21, SO34, SO37 — Soportes mínimos.
   * Verifica que campos de autorización estén presentes cuando aplique.
   */
  private validarSoportesMinimos(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    const requiereAuth = this.ctx.acuerdo?.requiere_autorizacion ?? true;

    // Consultas: verificar autorización si el acuerdo la requiere
    if (requiereAuth) {
      for (let i = 0; i < (servicios.consultas?.length ?? 0); i++) {
        const c = servicios.consultas![i]!;
        if (!c.numAutorizacion) {
          this.emit({
            codigo_causal: "AU0101",
            severidad: "advertencia",
            mensaje: `Consulta[${i}] (CUPS: ${c.codigoConsulta}): falta número de autorización. El acuerdo de voluntades lo requiere.`,
            campo_afectado: `fevRips.servicios.consultas[${i}].numAutorizacion`,
          });
        }
      }
      for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
        const p = servicios.procedimientos![i]!;
        if (!p.numAutorizacion) {
          this.emit({
            codigo_causal: "AU0101",
            severidad: "advertencia",
            mensaje: `Procedimiento[${i}] (CUPS: ${p.codigoProcedimiento}): falta autorización. Riesgo de glosa AU01.`,
            campo_afectado: `fevRips.servicios.procedimientos[${i}].numAutorizacion`,
          });
        }
      }
    }
  }

  /**
   * AU01, AU02 — Validaciones de autorización.
   * Si el acuerdo requiere autorización, verifica que cada servicio tenga
   * número de autorización (AU0101) y que aparezca en el JSON RIPS (SO2101).
   * Excepción: urgencias no requieren autorización previa.
   */
  private validarAutorizaciones(): void {
    const df = this.ctx.datosFactura;
    if (!df) return;

    const requiereAuth = this.ctx.acuerdo?.requiere_autorizacion ?? false;
    if (!requiereAuth) return;
    if (df.es_urgencia) return;

    // Set para rastrear glosas AU0101+SO2101 por el mismo servicio (deduplicación)
    const serviciosConAmbasGlosas = new Set<string>();

    for (const srv of df.servicios) {
      // Servicios que normalmente requieren autorización
      const requiereAuthTipo = [
        "consulta", "apoyo_dx", "procedimiento_qx", "procedimiento_no_qx",
        "medicamento", "dispositivo", "terapia",
      ].includes(srv.tipo_servicio);

      if (!requiereAuthTipo) continue;

      const sinAuthDatos = !srv.numero_autorizacion;

      // Verificar si también falta en RIPS
      const sinAuthRips = this.verificarAuthEnRips(srv.cups_codigo);

      if (sinAuthDatos) {
        this.emit({
          codigo_causal: "AU0101",
          severidad: "error",
          mensaje: `Servicio ${srv.cups_codigo} (${srv.tipo_servicio}): falta número de autorización. El acuerdo requiere autorización previa.`,
          campo_afectado: "servicios.numero_autorizacion",
          servicio_afectado: srv.cups_codigo,
          como_resolver: "Solicite el número de autorización a la EPS e inclúyalo en la factura y en el RIPS.",
          norma_legal: "Res. 3047/2008 Art. 12. Res. 2284/2023, Anexo Técnico 3, AU01.",
        });

        if (sinAuthRips) {
          serviciosConAmbasGlosas.add(srv.cups_codigo);
        }
      }

      if (sinAuthRips) {
        this.emit({
          codigo_causal: "SO2101",
          severidad: "error",
          mensaje: `Servicio ${srv.cups_codigo} (${srv.tipo_servicio}): número de autorización vacío en el RIPS.`,
          campo_afectado: "fevRips.servicios.*.numAutorizacion",
          servicio_afectado: srv.cups_codigo,
          como_resolver: "Incluya el número de autorización en el campo numAutorizacion del JSON RIPS.",
          norma_legal: "Res. 2275/2023, Anexo Técnico 1. Res. 2284/2023, SO21.",
        });
      }
    }

    // Deduplicar: si AU0101 y SO2101 se emiten para el mismo servicio,
    // solo contar una glosa prevenida (se aplica en construir resultado)
    if (serviciosConAmbasGlosas.size > 0) {
      // Marcar para deduplicación posterior — se maneja en el cálculo de
      // glosas_potenciales_prevenidas eliminando duplicados por código
      // (ya se hace con new Set en validar())
    }
  }

  /**
   * Helper: verifica si un CUPS tiene autorización vacía en el JSON RIPS.
   */
  private verificarAuthEnRips(cupsCodigo: string): boolean {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return false;

    // Buscar en consultas
    for (const c of servicios.consultas ?? []) {
      if (c.codigoConsulta === cupsCodigo && !c.numAutorizacion) return true;
    }
    // Buscar en procedimientos
    for (const p of servicios.procedimientos ?? []) {
      if (p.codigoProcedimiento === cupsCodigo && !p.numAutorizacion) return true;
    }
    // Buscar en medicamentos
    for (const m of servicios.medicamentos ?? []) {
      if (m.codigoMedicamento === cupsCodigo && !(m as unknown as Record<string, unknown>).numAutorizacion) return true;
    }
    return false;
  }

  /**
   * FA20 / FA2006 — Copagos y cuotas moderadoras.
   * Verifica que los valores de recaudo estén presentes y sean >= 0.
   * Compara copago_recaudado vs copago_calculado si ambos están disponibles.
   */
  private validarCopagos(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    for (let i = 0; i < (servicios.consultas?.length ?? 0); i++) {
      const c = servicios.consultas![i]!;
      if (c.valorPagoModerador < 0) {
        this.emit({
          codigo_causal: "FA2006",
          severidad: "error",
          mensaje: `Consulta[${i}]: valor de pago moderador negativo (${c.valorPagoModerador}).`,
          campo_afectado: `fevRips.servicios.consultas[${i}].valorPagoModerador`,
          valor_encontrado: String(c.valorPagoModerador),
          valor_esperado: ">= 0",
          como_resolver: "Corrija el valor de pago moderador para que sea mayor o igual a 0.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, concepto FA20 — Copagos.",
        });
      }
    }

    // Comparar copago recaudado vs calculado (DatosFactura)
    const df = this.ctx.datosFactura;
    if (df && df.copago_recaudado !== undefined && df.copago_calculado !== undefined) {
      if (df.copago_recaudado !== df.copago_calculado) {
        this.emit({
          codigo_causal: "FA2006",
          severidad: "advertencia",
          mensaje: `Copago recaudado ($${df.copago_recaudado.toLocaleString()}) difiere del calculado ($${df.copago_calculado.toLocaleString()}) según tabla vigente.`,
          campo_afectado: "datosFactura.copago_recaudado",
          valor_encontrado: String(df.copago_recaudado),
          valor_esperado: String(df.copago_calculado),
          como_resolver: "Verifique el valor del copago según la categoría del afiliado y la tabla vigente de copagos.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, FA2006 — Diferencia en copago recaudado.",
        });
      }
    }
  }

  /**
   * SO34 — Soportes documentales por tipo de servicio.
   * Verifica que los soportes necesarios estén presentes según el tipo de atención.
   * Solo aplica si se proveen DatosFactura con soportes.
   */
  private validarSoportesPorTipoServicio(): void {
    const df = this.ctx.datosFactura;
    if (!df) return;

    const soportes = df.soportes;
    const requiereAuth = this.ctx.acuerdo?.requiere_autorizacion ?? true;

    for (const srv of df.servicios) {
      switch (srv.tipo_servicio) {
        case "consulta":
          // Consulta ambulatoria → resumen de atención obligatorio
          if (!soportes.tiene_resumen_atencion) {
            this.emit({
              codigo_causal: "SO3405",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (consulta): falta resumen de atención.`,
              campo_afectado: "soportes.tiene_resumen_atencion",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte el resumen de atención del paciente para esta consulta.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34 — Soportes. Res. 2275/2023, Anexo Técnico 1.",
            });
          }
          // Si no requiere autorización, la orden/prescripción es soporte principal
          if (!requiereAuth && !soportes.tiene_orden_prescripcion) {
            this.emit({
              codigo_causal: "SO3701",
              severidad: "advertencia",
              mensaje: `Servicio ${srv.cups_codigo} (consulta): falta orden o prescripción médica.`,
              campo_afectado: "soportes.tiene_orden_prescripcion",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la orden o prescripción médica del servicio.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO37 — Comprobante y orden médica.",
            });
          }
          break;

        case "urgencia":
          if (!soportes.tiene_hoja_urgencias) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (urgencia): falta hoja de atención de urgencias.`,
              campo_afectado: "soportes.tiene_hoja_urgencias",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la hoja de atención de urgencias.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34. Res. 2275/2023, Anexo Técnico 1.",
            });
          }
          break;

        case "estancia":
          // Internación/observación → epicrisis
          if (!soportes.tiene_epicrisis) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (estancia/internación): falta epicrisis.`,
              campo_afectado: "soportes.tiene_epicrisis",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la epicrisis del paciente.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          break;

        case "procedimiento_qx":
          // Procedimiento quirúrgico → epicrisis + descripción Qx + registro anestesia
          if (!soportes.tiene_epicrisis) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (procedimiento Qx): falta epicrisis.`,
              campo_afectado: "soportes.tiene_epicrisis",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la epicrisis del procedimiento quirúrgico.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          if (!soportes.tiene_descripcion_qx) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (procedimiento Qx): falta descripción quirúrgica.`,
              campo_afectado: "soportes.tiene_descripcion_qx",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la descripción quirúrgica detallada.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          if (!soportes.tiene_registro_anestesia) {
            this.emit({
              codigo_causal: "SO3405",
              severidad: "advertencia",
              mensaje: `Servicio ${srv.cups_codigo} (procedimiento Qx): falta registro de anestesia.`,
              campo_afectado: "soportes.tiene_registro_anestesia",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte el registro de anestesia del procedimiento.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          break;

        case "medicamento":
          // Medicamentos ambulatorios → comprobante recibido + hoja de medicamentos
          if (!soportes.tiene_comprobante_recibido) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (medicamento): falta comprobante de recibido.`,
              campo_afectado: "soportes.tiene_comprobante_recibido",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte el comprobante de entrega del medicamento firmado por el paciente.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          if (!soportes.tiene_hoja_medicamentos) {
            this.emit({
              codigo_causal: "SO3405",
              severidad: "advertencia",
              mensaje: `Servicio ${srv.cups_codigo} (medicamento): falta hoja de administración de medicamentos.`,
              campo_afectado: "soportes.tiene_hoja_medicamentos",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la hoja de administración de medicamentos.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          break;

        case "traslado":
          if (!soportes.tiene_hoja_traslado) {
            this.emit({
              codigo_causal: "SO3401",
              severidad: "error",
              mensaje: `Servicio ${srv.cups_codigo} (traslado): falta hoja de traslado.`,
              campo_afectado: "soportes.tiene_hoja_traslado",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte la hoja de remisión/traslado con destino y motivo.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO34.",
            });
          }
          break;

        case "apoyo_dx":
        case "procedimiento_no_qx": {
          // Apoyo diagnóstico / procedimiento no Qx: verificar soporte de autorización
          const haySoportesBasicos = soportes.tiene_resumen_atencion || soportes.tiene_comprobante_recibido;
          if (requiereAuth && !srv.numero_autorizacion && haySoportesBasicos) {
            this.emit({
              codigo_causal: "SO2101",
              severidad: "advertencia",
              mensaje: `Servicio ${srv.cups_codigo} (${srv.tipo_servicio}): falta soporte de autorización.`,
              campo_afectado: "servicios.numero_autorizacion",
              servicio_afectado: srv.cups_codigo,
              como_resolver: "Adjunte el soporte de autorización del servicio o solicite a la EPS.",
              norma_legal: "Res. 2284/2023, Anexo Técnico 3, SO21 — Soportes de autorización.",
            });
          }
          break;
        }
      }
    }
  }

  /**
   * AU02 / AU0201 — Vigencia de la autorización.
   * Si el servicio tiene autorización, verifica que la fecha de prestación
   * esté dentro de la vigencia de dicha autorización.
   * Nota: En producción se cruzaría con BD de autorizaciones de la EPS.
   */
  private validarVigenciaAutorizacion(): void {
    // Placeholder: requiere tabla de autorizaciones con fecha_desde/fecha_hasta.
    // En esta versión, alertamos si hay autorización pero sin poder verificar
    // vigencia sin datos externos.
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    // Alerta informativa si se detectan autorizaciones (para que el usuario verifique)
    const todosConAuth = [
      ...(servicios.consultas ?? []).filter((c: ConsultaRips) => c.numAutorizacion),
      ...(servicios.procedimientos ?? []).filter((p: ProcedimientoRips) => p.numAutorizacion),
    ];

    if (todosConAuth.length > 0 && !this.ctx.acuerdo) {
      this.emit({
        codigo_causal: "AU0201",
        severidad: "info",
        mensaje: `${todosConAuth.length} servicio(s) con autorización. Verifique que las fechas de prestación estén dentro de la vigencia de cada autorización.`,
        campo_afectado: "servicios.*.numAutorizacion",
        como_resolver: "Confirme que cada autorización estaba vigente en la fecha de prestación del servicio.",
        norma_legal: "Res. 2284/2023, Anexo Técnico 3, concepto AU02 — Vigencia de autorización.",
      });
    }
  }

  // -------------------------------------------------------------------
  // CAPA 2 — ALERTAS Y VERIFICACIONES
  // -------------------------------------------------------------------

  /**
   * DE44 — Acuerdo de voluntades vigente.
   * Valida que el prestador tenga un acuerdo vigente con la EPS.
   * Excepción: urgencias (Art. 168 Ley 100/1993).
   */
  private validarAcuerdoVigente(): void {
    const df = this.ctx.datosFactura;
    const esUrgencia = df?.es_urgencia ?? false;
    const hoy = this.fechaRef;

    if (!this.ctx.acuerdo && !esUrgencia) {
      this.emit({
        codigo_causal: "DE4401",
        severidad: "error",
        mensaje: `No se encontró acuerdo de voluntades vigente con la EPS ${this.ctx.factura.nit_erp}. Sin contrato, la EPS puede devolver la factura (excepto urgencias).`,
        campo_afectado: "acuerdo",
        como_resolver: "Verifique que exista un acuerdo de voluntades vigente con esta EPS o marque la atención como urgencia si aplica.",
        norma_legal: "Res. 2284/2023, Anexo Técnico 3, DE44. Art. 2.5.3.4.2.2.1 Dcto 780/2016.",
      });
    } else if (this.ctx.acuerdo) {
      // Verificar vigencia
      const desde = new Date(this.ctx.acuerdo.vigencia_desde);
      const hasta = new Date(this.ctx.acuerdo.vigencia_hasta);
      if (hoy < desde || hoy > hasta) {
        this.emit({
          codigo_causal: "DE4402",
          severidad: "error",
          mensaje: `Acuerdo de voluntades con ${this.ctx.acuerdo.nombre_erp} no está vigente. Vigencia: ${this.ctx.acuerdo.vigencia_desde} a ${this.ctx.acuerdo.vigencia_hasta}.`,
          campo_afectado: "acuerdo.vigencia",
          valor_encontrado: hoy.toISOString().slice(0, 10),
          valor_esperado: `${this.ctx.acuerdo.vigencia_desde} — ${this.ctx.acuerdo.vigencia_hasta}`,
          como_resolver: "Renueve el acuerdo de voluntades o facture con lista de precios propia si no hay contrato.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, DE44. Circular 007/2025 — Sin acuerdo aplica lista de precios.",
        });
      }
    }
  }

  /**
   * TA01-TA59 — Validación de tarifas contra acuerdo de voluntades.
   * Si hay tarifario configurado, compara valor facturado vs pactado.
   * Diferencia entre tarifa distinta (TA02/TA08/TA58) y recargo no pactado (TA29).
   */
  private validarTarifas(): void {
    if (!this.ctx.acuerdo?.tarifas) return;
    const tarifas = this.ctx.acuerdo.tarifas;
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    // Consultas → TA0201 o TA2901
    for (let i = 0; i < (servicios.consultas?.length ?? 0); i++) {
      const c = servicios.consultas![i]!;
      const pactado = tarifas[c.codigoConsulta];
      if (pactado !== undefined && c.vrServicio !== pactado) {
        const diff = Math.abs(c.vrServicio - pactado);
        if (diff <= 100) continue; // Tolerancia de $100

        const esRecargo = c.vrServicio > pactado && diff > pactado * 0.10;
        this.emit({
          codigo_causal: esRecargo ? "TA2901" : "TA0201",
          severidad: "advertencia",
          mensaje: esRecargo
            ? `Consulta[${i}] CUPS ${c.codigoConsulta}: posible recargo no pactado. Facturado: $${c.vrServicio.toLocaleString()}, pactado: $${pactado.toLocaleString()} (diferencia: +$${diff.toLocaleString()}).`
            : `Consulta[${i}] CUPS ${c.codigoConsulta}: valor facturado ($${c.vrServicio.toLocaleString()}) difiere del pactado ($${pactado.toLocaleString()}).`,
          campo_afectado: `fevRips.servicios.consultas[${i}].vrServicio`,
          valor_encontrado: String(c.vrServicio),
          valor_esperado: String(pactado),
          como_resolver: esRecargo
            ? "Verifique que el recargo esté contemplado en el acuerdo de voluntades. Si no está pactado, ajuste al valor acordado."
            : "Ajuste el valor facturado al valor pactado en el acuerdo de voluntades.",
          norma_legal: esRecargo
            ? "Res. 2284/2023, Anexo Técnico 3, TA29 — Recargos no pactados."
            : "Res. 2284/2023, Anexo Técnico 3, TA02 — Tarifa diferente.",
        });
      }
    }

    // Procedimientos → TA0801/TA5801 o TA2901
    for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
      const p = servicios.procedimientos![i]!;
      const pactado = tarifas[p.codigoProcedimiento];
      if (pactado !== undefined && p.vrServicio !== pactado) {
        const diff = Math.abs(p.vrServicio - pactado);
        if (diff <= 100) continue; // Tolerancia de $100

        const esRecargo = p.vrServicio > pactado && diff > pactado * 0.10;
        // Determinar si es Qx (TA5801) o no (TA0801)
        const esProcQx = this.esProcedimientoQuirurgico(p.codigoProcedimiento);
        const codigoTarifa = esRecargo ? "TA2901" : (esProcQx ? "TA5801" : "TA0801");

        this.emit({
          codigo_causal: codigoTarifa,
          severidad: "advertencia",
          mensaje: esRecargo
            ? `Procedimiento[${i}] CUPS ${p.codigoProcedimiento}: posible recargo no pactado. Facturado: $${p.vrServicio.toLocaleString()}, pactado: $${pactado.toLocaleString()} (diferencia: +$${diff.toLocaleString()}).`
            : `Procedimiento[${i}] CUPS ${p.codigoProcedimiento}: valor facturado ($${p.vrServicio.toLocaleString()}) difiere del pactado ($${pactado.toLocaleString()}).`,
          campo_afectado: `fevRips.servicios.procedimientos[${i}].vrServicio`,
          valor_encontrado: String(p.vrServicio),
          valor_esperado: String(pactado),
          como_resolver: esRecargo
            ? "Verifique que el recargo esté contemplado en el acuerdo de voluntades. Si no está pactado, ajuste al valor acordado."
            : "Ajuste el valor facturado al valor pactado en el acuerdo de voluntades.",
          norma_legal: esRecargo
            ? "Res. 2284/2023, Anexo Técnico 3, TA29 — Recargos no pactados."
            : `Res. 2284/2023, Anexo Técnico 3, ${esProcQx ? "TA58" : "TA08"} — Tarifa diferente.`,
        });
      }
    }

    // Medicamentos → TA0701 o TA2901
    for (let i = 0; i < (servicios.medicamentos?.length ?? 0); i++) {
      const m = servicios.medicamentos![i]!;
      const pactado = tarifas[m.codigoMedicamento];
      if (pactado !== undefined) {
        const valorMed = (m as unknown as Record<string, unknown>).vrServicio as number | undefined;
        if (valorMed !== undefined && valorMed !== pactado) {
          const diff = Math.abs(valorMed - pactado);
          if (diff <= 100) continue;

          const esRecargo = valorMed > pactado && diff > pactado * 0.10;
          this.emit({
            codigo_causal: esRecargo ? "TA2901" : "TA0701",
            severidad: "advertencia",
            mensaje: esRecargo
              ? `Medicamento[${i}] ${m.codigoMedicamento}: posible recargo no pactado. Facturado: $${valorMed.toLocaleString()}, pactado: $${pactado.toLocaleString()}.`
              : `Medicamento[${i}] ${m.codigoMedicamento}: valor facturado ($${valorMed.toLocaleString()}) difiere del pactado ($${pactado.toLocaleString()}).`,
            campo_afectado: `fevRips.servicios.medicamentos[${i}].vrServicio`,
            valor_encontrado: String(valorMed),
            valor_esperado: String(pactado),
            como_resolver: esRecargo
              ? "Verifique que el recargo esté pactado en el acuerdo de voluntades."
              : "Ajuste el valor del medicamento al valor pactado en el acuerdo.",
            norma_legal: "Res. 2284/2023, Anexo Técnico 3, TA07 — Tarifa medicamentos.",
          });
        }
      }
    }
  }

  /**
   * Helper: determina si un CUPS corresponde a procedimiento quirúrgico.
   * Usa los datos de DatosFactura si están disponibles.
   */
  private esProcedimientoQuirurgico(cupsCodigo: string): boolean {
    const df = this.ctx.datosFactura;
    if (!df) return false;
    const srv = df.servicios.find(s => s.cups_codigo === cupsCodigo);
    return srv?.tipo_servicio === "procedimiento_qx";
  }

  /**
   * FA0103, FA0203, FA0303, etc. — Servicios incluidos en paquetes.
   * Si el acuerdo tiene paquetes, alerta si se facturan por separado.
   */
  private validarPaquetesAgrupados(): void {
    if (!this.ctx.acuerdo?.paquetes || this.ctx.acuerdo.paquetes.length === 0) return;
    const paquetes = new Set(this.ctx.acuerdo.paquetes);
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
      const p = servicios.procedimientos![i]!;
      if (paquetes.has(p.codigoProcedimiento)) {
        this.emit({
          codigo_causal: "FA5803",
          severidad: "advertencia",
          mensaje: `Procedimiento[${i}] CUPS ${p.codigoProcedimiento} está incluido en un paquete/atención agrupada. ¿Se está facturando aparte?`,
          campo_afectado: `fevRips.servicios.procedimientos[${i}].codigoProcedimiento`,
        });
      }
    }
  }

  /**
   * FA19 / FA1905 — Descuentos pactados no aplicados.
   */
  private validarDescuentos(): void {
    if (!this.ctx.acuerdo?.descuentos) return;
    const descuentos = this.ctx.acuerdo.descuentos;
    const tarifas = this.ctx.acuerdo.tarifas ?? {};
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
      const p = servicios.procedimientos![i]!;
      const desc = descuentos[p.codigoProcedimiento];
      const base = tarifas[p.codigoProcedimiento];
      if (desc !== undefined && base !== undefined) {
        const esperado = Math.round(base * (1 - desc / 100));
        if (p.vrServicio > esperado) {
          this.emit({
            codigo_causal: "FA1905",
            severidad: "advertencia",
            mensaje: `Procedimiento[${i}] CUPS ${p.codigoProcedimiento}: descuento pactado ${desc}% no aplicado. ` +
              `Valor facturado: $${p.vrServicio.toLocaleString()}, esperado con descuento: $${esperado.toLocaleString()}.`,
            campo_afectado: `fevRips.servicios.procedimientos[${i}].vrServicio`,
            valor_encontrado: String(p.vrServicio),
            valor_esperado: String(esperado),
          });
        }
      }
    }
  }

  /**
   * DE16 / FA16 — Persona o servicio pertenece a otro responsable.
   * En producción se cruzaría con BDUA/ADRES para verificar afiliación real.
   * Esta versión valida datos mínimos disponibles localmente.
   */
  private validarCoberturaAseguramiento(): void {
    const df = this.ctx.datosFactura;
    if (!df) return;

    // Verificar que el paciente tenga tipo de afiliado definido
    if (!df.paciente?.tipo_afiliado) {
      this.emit({
        codigo_causal: "DE1601",
        severidad: "advertencia",
        mensaje: "No se pudo verificar tipo de afiliación del paciente. Valide manualmente en ADRES/BDUA.",
        campo_afectado: "datosFactura.paciente.tipo_afiliado",
        como_resolver: "Consulte el estado de afiliación del paciente en la plataforma ADRES (https://www.adres.gov.co/) antes de radicar.",
        norma_legal: "Res. 2284/2023, Anexo Técnico 3, DE16. Dcto 780/2016 Art. 2.5.3.4.2.2.1.",
      });
    }

    // Verificar categoría de afiliado válida
    if (df.paciente?.categoria && !["A", "B", "C"].includes(df.paciente.categoria)) {
      this.emit({
        codigo_causal: "FA1605",
        severidad: "advertencia",
        mensaje: `Categoría de afiliado '${df.paciente.categoria}' no reconocida. Categorías válidas: A, B, C.`,
        campo_afectado: "datosFactura.paciente.categoria",
        valor_encontrado: df.paciente.categoria,
        valor_esperado: "A | B | C",
        como_resolver: "Verifique la categoría del afiliado en el carné de EPS o en ADRES.",
        norma_legal: "Res. 2284/2023, Anexo Técnico 3, FA16.",
      });
    }

    // TODO: En producción, consultar API ADRES/BDUA para verificar:
    //  - Paciente afiliado a la EPS de destino
    //  - Estado de afiliación activo
    //  - Régimen contributivo/subsidiado
  }

  // -------------------------------------------------------------------
  // CAPA 3 — COHERENCIA CLÍNICA
  // -------------------------------------------------------------------

  /**
   * PE01 — Coherencia diagnóstico ↔ procedimiento.
   * Verifica que cada procedimiento tenga un diagnóstico relacionado válido.
   */
  private validarCoherenciaDiagnosticoProcedimiento(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios) return;

    const diagnosticosConsultas = new Set(
      (servicios.consultas ?? [])
        .map((c: ConsultaRips) => c.codDiagnosticoPrincipal)
        .filter(Boolean)
    );

    for (let i = 0; i < (servicios.procedimientos?.length ?? 0); i++) {
      const p = servicios.procedimientos![i]!;
      if (p.codDiagnosticoPrincipal && diagnosticosConsultas.size > 0 && !diagnosticosConsultas.has(p.codDiagnosticoPrincipal)) {
        this.emit({
          codigo_causal: "PE0101",
          severidad: "info",
          mensaje: `Procedimiento[${i}] CUPS ${p.codigoProcedimiento}: su diagnóstico CIE-10 (${p.codDiagnosticoPrincipal}) no aparece en ninguna consulta de esta factura. Verificar pertinencia.`,
          campo_afectado: `fevRips.servicios.procedimientos[${i}].codDiagnosticoPrincipal`,
          como_resolver: "Verifique que el diagnóstico del procedimiento es coherente con la consulta asociada.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, concepto PE01 — Pertinencia.",
        });
      }
    }
  }

  /**
   * PE0101 — Coherencia diagnóstico ↔ sexo.
   * Detecta diagnósticos ginecológicos/obstétricos en hombres y
   * diagnósticos prostáticos en mujeres.
   */
  private validarCoherenciaSexo(): void {
    const df = this.ctx.datosFactura;
    if (!df) return;

    // Rangos CIE-10 exclusivos de sexo femenino (ginecología/obstetricia)
    const femeninoPrefijos = ["O", "N70", "N71", "N72", "N73", "N74", "N75", "N76", "N77", "N80", "N81", "N82", "N83", "N84", "N85", "N86", "N87", "N88", "N89", "N90", "N91", "N92", "N93", "N94", "N95", "N96", "N97", "N98"];
    // Rangos CIE-10 exclusivos de sexo masculino (próstata/testicular)
    const masculinoPrefijos = ["N40", "N41", "N42", "N43", "N44", "N45", "N46", "N47", "N48", "N49", "N50", "N51"];

    for (const srv of df.servicios) {
      const dx = srv.diagnostico_principal;
      if (!dx) continue;

      if (df.paciente.sexo === "M") {
        // Hombre con diagnóstico exclusivamente femenino
        if (femeninoPrefijos.some((p) => dx.startsWith(p))) {
          this.emit({
            codigo_causal: "PE0101",
            severidad: "advertencia",
            mensaje: `Diagnóstico ${dx} (ginecología/obstetricia) asignado a paciente masculino. Posible error de codificación.`,
            campo_afectado: `servicios.diagnostico_principal`,
            servicio_afectado: srv.cups_codigo,
            como_resolver: "Verifique que el código CIE-10 corresponda al sexo del paciente.",
            norma_legal: "Res. 2284/2023, Anexo Técnico 3, PE0101 — Coherencia diagnóstico-sexo.",
          });
        }
      } else {
        // Mujer con diagnóstico exclusivamente masculino
        if (masculinoPrefijos.some((p) => dx.startsWith(p))) {
          this.emit({
            codigo_causal: "PE0101",
            severidad: "advertencia",
            mensaje: `Diagnóstico ${dx} (patología prostática/testicular) asignado a paciente femenina. Posible error de codificación.`,
            campo_afectado: `servicios.diagnostico_principal`,
            servicio_afectado: srv.cups_codigo,
            como_resolver: "Verifique que el código CIE-10 corresponda al sexo del paciente.",
            norma_legal: "Res. 2284/2023, Anexo Técnico 3, PE0101 — Coherencia diagnóstico-sexo.",
          });
        }
      }
    }
  }

  /**
   * PE0101 — Coherencia diagnóstico ↔ edad.
   * Detecta diagnósticos pediátricos en adultos y viceversa.
   */
  private validarCoherenciaEdad(): void {
    const df = this.ctx.datosFactura;
    if (!df || !df.paciente.fecha_nacimiento) return;

    const nacimiento = new Date(df.paciente.fecha_nacimiento);
    const hoy = this.fechaRef;
    const edadAnos = Math.floor((hoy.getTime() - nacimiento.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Diagnósticos exclusivamente neonatales (P00-P96)
    const esPediatricoExclusivo = (dx: string) => dx.startsWith("P");
    // Diagnósticos geriátricos / degenerativos raros en <18 (M80-M81 osteoporosis)
    const esGeriatrico = (dx: string) => ["M80", "M81", "G30"].some((p) => dx.startsWith(p));

    for (const srv of df.servicios) {
      const dx = srv.diagnostico_principal;
      if (!dx) continue;

      // Adulto (>14 años) con diagnóstico neonatal
      if (edadAnos > 14 && esPediatricoExclusivo(dx)) {
        this.emit({
          codigo_causal: "PE0101",
          severidad: "advertencia",
          mensaje: `Diagnóstico ${dx} (patología neonatal/perinatal) asignado a paciente de ${edadAnos} años. Posible error.`,
          campo_afectado: `servicios.diagnostico_principal`,
          servicio_afectado: srv.cups_codigo,
          como_resolver: "Verifique que el diagnóstico CIE-10 corresponda a la edad del paciente.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, PE0101 — Coherencia diagnóstico-edad.",
        });
      }

      // Niño (<18 años) con diagnóstico geriátrico
      if (edadAnos < 18 && esGeriatrico(dx)) {
        this.emit({
          codigo_causal: "PE0101",
          severidad: "advertencia",
          mensaje: `Diagnóstico ${dx} (patología geriátrica/degenerativa) asignado a paciente de ${edadAnos} años. Verificar pertinencia.`,
          campo_afectado: `servicios.diagnostico_principal`,
          servicio_afectado: srv.cups_codigo,
          como_resolver: "Verifique que el diagnóstico CIE-10 sea apropiado para la edad del paciente.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, PE0101 — Coherencia diagnóstico-edad.",
        });
      }
    }
  }

  /**
   * PE0101 — Validación contra tabla reglas_coherencia (BD).
   * Evalúa condiciones JSONB de la tabla para validaciones más complejas.
   */
  private validarReglasCoherenciaBD(): void {
    const reglas = this.ctx.reglasCoherencia;
    if (!reglas || reglas.length === 0) return;

    const df = this.ctx.datosFactura;
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios && !df) return;

    for (const regla of reglas) {
      if (!regla.activo) continue;

      // Obtener todos los diagnósticos y procedimientos presentes
      const diagnosticos = [
        ...(servicios?.consultas ?? []).map((c: ConsultaRips) => c.codDiagnosticoPrincipal),
        ...(servicios?.procedimientos ?? []).map((p: ProcedimientoRips) => p.codDiagnosticoPrincipal),
        ...(df?.servicios ?? []).map((s) => s.diagnostico_principal),
      ].filter(Boolean);

      const procedimientos = [
        ...(servicios?.procedimientos ?? []).map((p: ProcedimientoRips) => p.codigoProcedimiento),
        ...(df?.servicios ?? []).map((s) => s.cups_codigo),
      ].filter(Boolean);

      const codigosPresentes = [...diagnosticos, ...procedimientos];

      // ¿El código de referencia de la regla está presente?
      if (!codigosPresentes.includes(regla.codigo_referencia)) continue;

      // Evaluar condición
      const condicion = regla.condicion as Record<string, unknown>;
      let viola = false;

      if (regla.tipo === "sexo_diagnostico" || regla.tipo === "sexo_procedimiento") {
        const sexoRequerido = condicion["sexo"] as string | undefined;
        const sexoPaciente = df?.paciente.sexo;
        if (sexoRequerido && sexoPaciente && sexoPaciente !== sexoRequerido) {
          viola = true;
        }
      }

      if (regla.tipo === "edad_diagnostico") {
        const edadMin = condicion["edad_min"] as number | undefined;
        const edadMax = condicion["edad_max"] as number | undefined;
        if (df?.paciente.fecha_nacimiento) {
          const nac = new Date(df.paciente.fecha_nacimiento);
          const edad = Math.floor((Date.now() - nac.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if ((edadMin !== undefined && edad < edadMin) || (edadMax !== undefined && edad > edadMax)) {
            viola = true;
          }
        }
      }

      if (regla.tipo === "diagnostico_procedimiento") {
        const dxRequeridos = condicion["diagnosticos_validos"] as string[] | undefined;
        if (dxRequeridos && dxRequeridos.length > 0) {
          const tieneAlguno = dxRequeridos.some((dx) => diagnosticos.includes(dx));
          if (!tieneAlguno) viola = true;
        }
      }

      if (viola) {
        this.emit({
          codigo_causal: "PE0101",
          severidad: regla.severidad === "error" ? "error" : "advertencia",
          mensaje: regla.mensaje_error,
          campo_afectado: `regla_coherencia.${regla.tipo}`,
          como_resolver: "Revise la coherencia entre diagnóstico, procedimiento, sexo y edad del paciente.",
          norma_legal: "Res. 2284/2023, Anexo Técnico 3, PE0101 — Coherencia clínica. Tabla reglas_coherencia.",
        });
      }
    }
  }

  /**
   * PE0102 — Pertinencia de estancia/duración.
   * Alerta si urgencias tienen estancia > 72h (informativo).
   */
  private validarPertinenciaEstancia(): void {
    const servicios = this.ctx.fevRips.servicios;
    if (!servicios?.urgencias) return;

    for (let i = 0; i < servicios.urgencias.length; i++) {
      const u = servicios.urgencias[i]!;
      if (u.fechaInicioAtencion && u.fechaEgreso) {
        const inicio = new Date(u.fechaInicioAtencion);
        const fin = new Date(u.fechaEgreso);
        const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
        if (horas > 72) {
          this.emit({
            codigo_causal: "PE0102",
            severidad: "info",
            mensaje: `Urgencia[${i}]: estancia de ${Math.round(horas)} horas (> 72h). Puede requerir justificación adicional.`,
            campo_afectado: `fevRips.servicios.urgencias[${i}]`,
            valor_encontrado: `${Math.round(horas)}h`,
            valor_esperado: "≤ 72h (referencial)",
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // UTILIDAD INTERNA
  // -------------------------------------------------------------------

  private agregar(h: HallazgoInterno): void {
    this.hallazgos.push(h);
  }

  /** Helper: infiere categoría a partir del prefijo del código causal */
  private inferirCategoria(codigo: string): CategoriaAlerta {
    const prefijo = codigo.slice(0, 2);
    switch (prefijo) {
      case "DE": return "devolucion";
      case "FA": return "facturacion";
      case "TA": return "tarifa";
      case "SO": return "soporte";
      case "AU": return "autorizacion";
      case "PE": return "pertinencia";
      case "SC": return "seguimiento";
      default: return "facturacion";
    }
  }

  /** Shorthand para agregar con defaults de categoría y norma */
  private emit(h: Omit<HallazgoInterno, "categoria" | "detalle" | "como_resolver" | "norma_legal"> & {
    categoria?: CategoriaAlerta;
    detalle?: string;
    como_resolver?: string;
    norma_legal?: string;
    servicio_afectado?: string;
  }): void {
    this.agregar({
      ...h,
      categoria: h.categoria ?? this.inferirCategoria(h.codigo_causal),
      detalle: h.detalle ?? h.mensaje,
      como_resolver: h.como_resolver ?? "Revise el campo indicado y corrija el valor.",
      norma_legal: h.norma_legal ?? "Res. 2284/2023, Anexo Técnico 3",
    });
  }
}

// =====================================================================
// FUNCIÓN HELPER: ejecutar validación desde un server action
// =====================================================================

/**
 * Ejecuta la validación completa y retorna el resultado.
 * Diseñada para ser llamada desde un server action de Next.js.
 */
export function ejecutarValidacion(ctx: ContextoValidacion): ResultadoValidacion {
  const validador = new ValidadorPreRadicacion(ctx);
  return validador.validar();
}

// =====================================================================
// FUNCIÓN validarFactura() — Orquestador de alto nivel
// =====================================================================

export interface ValidarFacturaInput {
  /** Factura leída de Supabase */
  factura: FacturaDB;
  /** Acuerdo de voluntades con tarifas (opcional) */
  acuerdo?: {
    id: string;
    eps_codigo: string;
    nombre_eps: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    requiere_autorizacion: boolean;
    tarifas: { cups_codigo: string; valor_pactado: number }[];
  };
  /** Reglas de coherencia cargadas de BD */
  reglasCoherencia?: ReglaCoherenciaDB[];
  /** Facturas existentes para detección de duplicados */
  facturasExistentes?: Pick<FacturaDB, "num_factura" | "estado">[];
  /** Catálogo de causales (opcional, se usa array vacío si no se provee) */
  catalogo?: CausalGlosaDB[];
  /** Fecha de referencia para cálculos temporales (default: hoy) */
  fechaReferencia?: Date;
}

/**
 * Valida una factura completa contra todas las reglas anti-glosa.
 *
 * Orquesta la construcción del ContextoValidacion a partir de los datos
 * de la factura (metadata, fev_rips_json) y ejecuta ValidadorPreRadicacion.
 *
 * Incluye festivos colombianos 2025-2026 para días hábiles.
 */
export function validarFactura(input: ValidarFacturaInput): ResultadoValidacion {
  const { factura, acuerdo, reglasCoherencia, facturasExistentes, catalogo } = input;

  // Extraer FEV-RIPS del JSON de la factura
  const fevRips = (factura.fev_rips_json ?? {}) as unknown as FevRips;

  // Construir AcuerdoVoluntades para el validador
  let acuerdoCtx: AcuerdoVoluntades | undefined;
  if (acuerdo) {
    const tarifasMap: Record<string, number> = {};
    for (const t of acuerdo.tarifas) {
      tarifasMap[t.cups_codigo] = t.valor_pactado;
    }
    acuerdoCtx = {
      nit_erp: acuerdo.eps_codigo,
      nombre_erp: acuerdo.nombre_eps ?? acuerdo.eps_codigo,
      requiere_autorizacion: acuerdo.requiere_autorizacion,
      tarifas: tarifasMap,
      paquetes: [],
      descuentos: {},
      vigencia_desde: acuerdo.fecha_inicio,
      vigencia_hasta: acuerdo.fecha_fin,
    };
  }

  // Extraer DatosFactura del metadata
  const meta = factura.metadata as Record<string, unknown> | null;
  let datosFactura: DatosFactura | undefined;
  if (meta) {
    datosFactura = {
      prestador_id: factura.user_id,
      eps_codigo: factura.nit_erp,
      paciente: meta.paciente as DatosFactura["paciente"],
      servicios: (meta.servicios ?? []) as DatosFactura["servicios"],
      soportes: (meta.soportes ?? {}) as DatosFactura["soportes"],
      fecha_expedicion_fev: (meta.fecha_expedicion_fev as string) ?? factura.fecha_expedicion,
      fecha_radicacion_prevista: (meta.fecha_radicacion_prevista as string) ?? new Date().toISOString().slice(0, 10),
      copago_recaudado: meta.copago_recaudado as number | undefined,
      copago_calculado: meta.copago_calculado as number | undefined,
      es_urgencia: (meta.es_urgencia as boolean) ?? false,
      tiene_contrato: (meta.tiene_contrato as boolean) ?? !!acuerdo,
    };
  }

  // Fecha de referencia: preferir la proporcionada, luego hoy
  const fechaReferencia = input.fechaReferencia ?? new Date();

  // Construir contexto completo
  const ctx: ContextoValidacion = {
    factura,
    fevRips,
    acuerdo: acuerdoCtx,
    catalogo: catalogo ?? [],
    facturasExistentes,
    datosFactura,
    reglasCoherencia,
    fechaReferencia,
  };

  return ejecutarValidacion(ctx);
}
