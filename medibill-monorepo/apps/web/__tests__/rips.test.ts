/**
 * Tests para construirFevRips — app/actions/rips.ts
 *
 * Verifica generación de estructura FEV-RIPS (Res. 2275):
 * - Estructura raíz y campos obligatorios
 * - Priorización de diagnósticos (principal, causa_externa, relacionados)
 * - Lógica de conceptoRecaudo (ARL/SOAT vs copago)
 * - Routing consulta vs urgencia
 * - Corrección de dx en procedimientos (W/X/Y/V)
 * - Valor de consulta (passthrough de tarifa resuelta)
 * - Validación de fecha nacimiento
 * - Medicamentos y otros servicios
 * - Numeración consecutiva
 */

import { describe, it, expect, vi } from "vitest";
import {
  crearDatosParaRips,
  crearDiagnosticoIA,
  crearDiagnosticoCausaExterna,
  crearDiagnosticoRelacionado,
  crearProcedimientoIA,
  crearMedicamentoInput,
  crearOtroServicioInput,
} from "./helpers/fixtures";

// Mock logger to suppress output during tests
vi.mock("@/lib/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
}));

// Prestador fixture for all tests
const prestador = { nit: "123456789", cod: "HAB001" };

// =====================================================================
// TESTS
// =====================================================================

describe("construirFevRips", () => {
  describe("Estructura raíz FevRips", () => {
    it("genera estructura con NIT del prestador y número de factura", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ numFactura: "FV-006" });
      const result = construirFevRips(datos, prestador);

      expect(result.numDocumentoIdObligado).toBe("123456789");
      expect(result.numFactura).toBe("FV-006");
      expect(result.usuarios).toHaveLength(1);
      expect(result.tipoNota).toBeNull();
      expect(result.numNota).toBeNull();
    });

    it("incluye datos del paciente en el usuario", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        tipoDocumentoPaciente: "CC",
        documentoPaciente: "987654321",
        sexoPaciente: "F",
        tipoUsuarioPaciente: "02",
        fechaNacimientoPaciente: "1985-03-20",
      });
      const result = construirFevRips(datos, prestador);
      const usuario = result.usuarios[0]!;

      expect(usuario.tipoDocumentoIdentificacion).toBe("CC");
      expect(usuario.numDocumentoIdentificacion).toBe("987654321");
      expect(usuario.codSexo).toBe("F");
      expect(usuario.tipoUsuario).toBe("02");
      expect(usuario.fechaNacimiento).toBe("1985-03-20");
    });
  });

  describe("Diagnósticos — priorización de slots", () => {
    it("usa el primer diagnóstico como principal", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        diagnosticos: [
          crearDiagnosticoIA({ codigo_cie10: "J060" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M545" }),
        ],
      });
      const result = construirFevRips(datos, prestador);
      const consulta = result.usuarios[0]!.servicios.consultas[0]!;

      expect(consulta.codDiagnosticoPrincipal).toBe("J060");
      expect(consulta.codDiagnosticoRelacionado1).toBe("M545");
    });

    it("reserva slot para causa_externa (W/X/Y/V) cuando existe", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        diagnosticos: [
          crearDiagnosticoIA({ codigo_cie10: "S832" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M235" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M171" }),
          crearDiagnosticoCausaExterna({ codigo_cie10: "W010" }),
        ],
      });
      const result = construirFevRips(datos, prestador);
      const consulta = result.usuarios[0]!.servicios.consultas[0]!;

      expect(consulta.codDiagnosticoPrincipal).toBe("S832");
      const slots = [
        consulta.codDiagnosticoRelacionado1,
        consulta.codDiagnosticoRelacionado2,
        consulta.codDiagnosticoRelacionado3,
      ];
      expect(slots).toContain("W010");
      expect(slots.filter(s => s !== null).length).toBeGreaterThanOrEqual(2);
    });

    it("llena máximo 3 slots de diagnósticos relacionados", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        diagnosticos: [
          crearDiagnosticoIA({ codigo_cie10: "J060" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M545" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M235" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M171" }),
          crearDiagnosticoRelacionado({ codigo_cie10: "M791" }),
        ],
      });
      const result = construirFevRips(datos, prestador);
      const consulta = result.usuarios[0]!.servicios.consultas[0]!;

      const filled = [
        consulta.codDiagnosticoRelacionado1,
        consulta.codDiagnosticoRelacionado2,
        consulta.codDiagnosticoRelacionado3,
      ].filter(s => s !== null);
      expect(filled).toHaveLength(3);
    });
  });

  describe("ConceptoRecaudo", () => {
    it('retorna "05" (No aplica) para tipo_usuario "04" (particular)', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ tipoUsuarioPaciente: "04" });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("05");
    });

    it('retorna "05" (No aplica) para tipo_usuario "05" (no asegurado)', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ tipoUsuarioPaciente: "05" });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("05");
    });

    it('retorna "05" para causa "01" (Accidente de Trabajo — ARL paga todo)', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, causa: "01" },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("05");
    });

    it('retorna "05" para causa "02" (Accidente de Tránsito — SOAT paga todo)', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, causa: "02" },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("05");
    });

    it('retorna "05" para causa "13" (Enfermedad Profesional — ARL paga todo)', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, causa: "13" },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("05");
    });

    it('retorna "01" (Cuota moderadora) para régimen contributivo causa estándar', async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        tipoUsuarioPaciente: "01",
        atencionIA: { ...crearDatosParaRips().atencionIA, causa: "15" },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.conceptoRecaudo).toBe("01");
    });
  });

  describe("Routing: consulta vs urgencia", () => {
    it("genera ConsultaRips y urgencias vacías para tipo_servicio consulta", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, tipo_servicio: "consulta" },
      });
      const result = construirFevRips(datos, prestador);
      const servicios = result.usuarios[0]!.servicios;

      expect(servicios.consultas).toHaveLength(1);
      expect(servicios.urgencias).toHaveLength(0);
    });

    it("genera UrgenciaRips y consultas vacías para tipo_servicio urgencias", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, tipo_servicio: "urgencias" },
      });
      const result = construirFevRips(datos, prestador);
      const servicios = result.usuarios[0]!.servicios;

      expect(servicios.consultas).toHaveLength(0);
      expect(servicios.urgencias).toHaveLength(1);
      expect(servicios.urgencias[0]!.codDiagnosticoPrincipal).toBe("Z000");
    });

    it("viaIngreso es '01' (demanda espontánea) para urgencias", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, tipo_servicio: "urgencias" },
        procedimientos: [crearProcedimientoIA({ codigo_cups: "881602" })],
      });
      const result = construirFevRips(datos, prestador);
      const proc = result.usuarios[0]!.servicios.procedimientos[0]!;

      expect(proc.viaIngresoServicioSalud).toBe("01");
    });

    it("viaIngreso es '02' (remitido) para consultas", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        procedimientos: [crearProcedimientoIA({ codigo_cups: "881602" })],
      });
      const result = construirFevRips(datos, prestador);
      const proc = result.usuarios[0]!.servicios.procedimientos[0]!;

      expect(proc.viaIngresoServicioSalud).toBe("02");
    });
  });

  describe("Procedimientos — corrección de dx", () => {
    it("reemplaza dx W/X/Y/V en procedimiento con diagnóstico principal", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        diagnosticos: [crearDiagnosticoIA({ codigo_cie10: "S832" })],
        procedimientos: [
          crearProcedimientoIA({
            codigo_cups: "881602",
            diagnostico_asociado: "W010",
          }),
        ],
      });
      const result = construirFevRips(datos, prestador);
      const proc = result.usuarios[0]!.servicios.procedimientos[0]!;

      expect(proc.codDiagnosticoPrincipal).toBe("S832");
    });

    it("mantiene dx normal en procedimiento cuando no es W/X/Y/V", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        diagnosticos: [crearDiagnosticoIA({ codigo_cie10: "S832" })],
        procedimientos: [
          crearProcedimientoIA({
            codigo_cups: "881602",
            diagnostico_asociado: "M545",
          }),
        ],
      });
      const result = construirFevRips(datos, prestador);
      const proc = result.usuarios[0]!.servicios.procedimientos[0]!;

      expect(proc.codDiagnosticoPrincipal).toBe("M545");
    });
  });

  describe("Valor de consulta", () => {
    it("usa el valor_consulta proporcionado como vrServicio", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, valor_consulta: 75000 },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.vrServicio).toBe(75000);
    });

    it("pasa el valor estándar cuando no hay override de tarifa", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, valor_consulta: 50000 },
      });
      const result = construirFevRips(datos, prestador);

      expect(result.usuarios[0]!.servicios.consultas[0]!.vrServicio).toBe(50000);
    });
  });

  describe("Validación fecha de nacimiento", () => {
    it("rechaza año anterior a 1900", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ fechaNacimientoPaciente: "1800-01-01" });

      expect(() => construirFevRips(datos, prestador)).toThrow("Fecha de nacimiento inválida");
    });

    it("rechaza año mayor al actual", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ fechaNacimientoPaciente: "2030-01-01" });

      expect(() => construirFevRips(datos, prestador)).toThrow("Fecha de nacimiento inválida");
    });

    it("acepta fecha de nacimiento válida", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({ fechaNacimientoPaciente: "2000-06-15" });

      const result = construirFevRips(datos, prestador);
      expect(result.usuarios[0]!.fechaNacimiento).toBe("2000-06-15");
    });
  });

  describe("Medicamentos", () => {
    it("mapea medicamentos con vrServicio = unit × cantidad", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        medicamentos: [crearMedicamentoInput({ vrUnitMedicamento: 500, cantidadMedicamento: 21 })],
      });
      const result = construirFevRips(datos, prestador);
      const med = result.usuarios[0]!.servicios.medicamentos[0]!;

      expect(med.vrServicio).toBe(500 * 21);
      expect(med.vrUnitMedicamento).toBe(500);
      expect(med.cantidadMedicamento).toBe(21);
      expect(med.nomTecnologiaSalud).toBe("Amoxicilina");
    });
  });

  describe("Otros Servicios", () => {
    it("mapea otros servicios con vrServicio = unit × cantidad", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        otrosServicios: [crearOtroServicioInput({ vrUnitTecnologia: 15000, cantidad: 2 })],
      });
      const result = construirFevRips(datos, prestador);
      const otro = result.usuarios[0]!.servicios.otrosServicios[0]!;

      expect(otro.vrServicio).toBe(15000 * 2);
      expect(otro.cantidad).toBe(2);
    });
  });

  describe("Numeración consecutiva", () => {
    it("numera consecutivamente consulta + procedimientos + medicamentos + otros", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        procedimientos: [
          crearProcedimientoIA({ codigo_cups: "881602" }),
          crearProcedimientoIA({ codigo_cups: "881603" }),
        ],
        medicamentos: [crearMedicamentoInput()],
        otrosServicios: [crearOtroServicioInput()],
      });
      const result = construirFevRips(datos, prestador);
      const s = result.usuarios[0]!.servicios;

      expect(s.consultas[0]!.consecutivo).toBe(1);
      expect(s.procedimientos[0]!.consecutivo).toBe(2);
      expect(s.procedimientos[1]!.consecutivo).toBe(3);
      expect(s.medicamentos[0]!.consecutivo).toBe(4);
      expect(s.otrosServicios[0]!.consecutivo).toBe(5);
    });

    it("numera desde urgencia cuando es tipo urgencias", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips({
        atencionIA: { ...crearDatosParaRips().atencionIA, tipo_servicio: "urgencias" },
        procedimientos: [crearProcedimientoIA({ codigo_cups: "881602" })],
      });
      const result = construirFevRips(datos, prestador);
      const s = result.usuarios[0]!.servicios;

      expect(s.urgencias[0]!.consecutivo).toBe(1);
      expect(s.procedimientos[0]!.consecutivo).toBe(2);
    });
  });

  describe("Secciones stub vacías", () => {
    it("incluye secciones hospitalización y recién nacidos como arrays vacíos", async () => {
      const { construirFevRips } = await import("@/lib/construir-fev-rips");
      const datos = crearDatosParaRips();
      const result = construirFevRips(datos, prestador);
      const s = result.usuarios[0]!.servicios;

      expect(s.hospitalizacion).toEqual([]);
      expect(s.recienNacidos).toEqual([]);
    });
  });
});
