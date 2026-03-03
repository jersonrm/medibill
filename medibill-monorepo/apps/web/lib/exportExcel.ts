import * as XLSX from "xlsx";
import type { ResultadoAnalisis, DatosPaciente } from "@/lib/types/ui";

/**
 * Exporta el resultado del análisis a un archivo Excel (.xlsx).
 */
export function exportarExcel(resultado: ResultadoAnalisis, datosPaciente: DatosPaciente): void {
  const wb = XLSX.utils.book_new();
  const titulo = [["MEDIBILL - REPORTE DE AUDITORÍA TÉCNICA RIPS"]];
  const infoGeneral = [
    ["Referencia:", "Resolución 2275 de 2023"],
    ["Fecha de Reporte:", new Date().toLocaleDateString()],
    ["Auditor:", "Sistema Inteligente Medibill"],
    [""],
    ["DATOS DEL PACIENTE"],
    ["Nombre:", datosPaciente.nombrePaciente || "No especificado"],
    ["Identificación:", datosPaciente.cedulaPaciente || "No especificado"],
    [""],
  ];

  const diagSeguros = resultado.diagnosticos || [];
  const procSeguros = resultado.procedimientos || [];

  const tablaDiag = [
    ["DIAGNÓSTICOS (CIE-10)"],
    ["CÓDIGO", "DESCRIPCIÓN"],
    ...diagSeguros.map((d) => [d.codigo_cie10, d.descripcion]),
  ];
  const tablaProc = [
    [""],
    ["PROCEDIMIENTOS (CUPS)"],
    ["CÓDIGO", "DESCRIPCIÓN", "CANT."],
    ...procSeguros.map((p) => [p.codigo_cups, p.descripcion, p.cantidad]),
  ];

  const ws = XLSX.utils.aoa_to_sheet([...titulo, [""], ...infoGeneral, ...tablaDiag, ...tablaProc]);
  ws["!cols"] = [{ wch: 20 }, { wch: 65 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
  XLSX.writeFile(
    wb,
    `Reporte_Medibill_${datosPaciente.cedulaPaciente || "RIPS"}_${new Date().getTime()}.xlsx`
  );
}
