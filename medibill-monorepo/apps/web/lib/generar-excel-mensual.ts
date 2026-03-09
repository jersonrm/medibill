import * as XLSX from "xlsx";

interface FacturaExport {
  num_factura: string;
  fecha_expedicion: string;
  paciente_nombre: string;
  paciente_documento: string;
  eps_nombre: string;
  subtotal: number;
  copago: number;
  cuota_moderadora: number;
  valor_total: number;
  estado: string;
  procedimientos: {
    codigo_cups: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
  }[];
}

/**
 * Genera y descarga un Excel con el resumen mensual de facturas.
 * 3 hojas: Facturas, Servicios, Resumen.
 */
export function generarExcelMensual(facturas: FacturaExport[], mes: string, anio: string) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Facturas ──
  const facturasData = facturas.map((f) => ({
    "N° Factura": f.num_factura,
    Fecha: f.fecha_expedicion,
    Paciente: f.paciente_nombre,
    Documento: f.paciente_documento,
    EPS: f.eps_nombre,
    Subtotal: f.subtotal,
    Copago: f.copago,
    "Cuota Mod.": f.cuota_moderadora,
    "Valor Total": f.valor_total,
    Estado: f.estado,
  }));
  const wsFacturas = XLSX.utils.json_to_sheet(facturasData);
  wsFacturas["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
    { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFacturas, "Facturas");

  // ── Hoja 2: Servicios ──
  const serviciosData: Record<string, unknown>[] = [];
  for (const f of facturas) {
    for (const p of f.procedimientos) {
      serviciosData.push({
        "N° Factura": f.num_factura,
        Fecha: f.fecha_expedicion,
        Paciente: f.paciente_nombre,
        "Código CUPS": p.codigo_cups,
        Descripción: p.descripcion,
        Cantidad: p.cantidad,
        "Valor Unitario": p.valor_unitario,
        Subtotal: p.valor_unitario * p.cantidad,
      });
    }
  }
  const wsServicios = XLSX.utils.json_to_sheet(serviciosData);
  wsServicios["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
    { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsServicios, "Servicios");

  // ── Hoja 3: Resumen ──
  const totalGeneral = facturas.reduce((s, f) => s + f.valor_total, 0);
  const totalCopago = facturas.reduce((s, f) => s + f.copago, 0);

  // Agrupar por EPS
  const porEPS: Record<string, { cantidad: number; valor: number }> = {};
  for (const f of facturas) {
    const eps = f.eps_nombre || "Sin EPS";
    if (!porEPS[eps]) porEPS[eps] = { cantidad: 0, valor: 0 };
    porEPS[eps].cantidad++;
    porEPS[eps].valor += f.valor_total;
  }

  const resumenData: Record<string, unknown>[] = [
    { Concepto: "RESUMEN MENSUAL", Valor: `${mes}/${anio}` },
    { Concepto: "Total facturas", Valor: facturas.length },
    { Concepto: "Valor total facturado", Valor: totalGeneral },
    { Concepto: "Total copagos", Valor: totalCopago },
    { Concepto: "Promedio por factura", Valor: facturas.length > 0 ? Math.round(totalGeneral / facturas.length) : 0 },
    { Concepto: "", Valor: "" },
    { Concepto: "DISTRIBUCIÓN POR EPS", Valor: "" },
    ...Object.entries(porEPS).map(([eps, data]) => ({
      Concepto: `${eps} (${data.cantidad} fact.)`,
      Valor: data.valor,
    })),
  ];

  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  wsResumen["!cols"] = [{ wch: 35 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Descargar
  XLSX.writeFile(wb, `Medibill_Mensual_${anio}-${mes}.xlsx`);
}
