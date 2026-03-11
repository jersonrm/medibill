import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createRateLimiter } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/formato";
import { registrarAuditLog } from "@/lib/audit-log";

const limiter = createRateLimiter({ max: 20, windowMs: 60_000 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  if (await limiter.isLimited(user.id, supabase)) {
    registrarAuditLog({ accion: "rate_limit_exceeded", tabla: "rate_limits", metadata: { route: "factura-pdf" } });
    return new NextResponse("Demasiadas solicitudes. Intenta en un momento.", { status: 429 });
  }

  const { data: factura } = await supabase
    .from("facturas")
    .select("*, pacientes(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!factura) {
    return new NextResponse("Factura no encontrada", { status: 404 });
  }

  const paciente = factura.pacientes as Record<string, string> | null;
  const perfil = factura.perfil_prestador_snapshot as Record<string, string> | null;
  const diagnosticos = (factura.diagnosticos || []) as { codigo_cie10: string; descripcion: string; rol: string }[];
  const procedimientos = (factura.procedimientos || []) as { codigo_cups: string; descripcion: string; cantidad: number; valor_unitario?: number }[];

  const nombrePaciente = paciente
    ? [paciente.primer_nombre, paciente.segundo_nombre, paciente.primer_apellido, paciente.segundo_apellido].filter(Boolean).join(" ")
    : "—";

  const formatCOP = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);
  const e = escapeHtml;

  const atencionData = (factura.metadata as Record<string, unknown>)?.atencion as Record<string, unknown> || {};
  const valorConsultaPdf = (atencionData.valor_consulta as number) || 0;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura ${e(String(factura.num_factura))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #061a40; padding: 40px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0353a4; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #0353a4; }
    .header .meta { text-align: right; font-size: 11px; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #003559; border-bottom: 1px solid #b9d6f2; padding-bottom: 4px; margin-bottom: 8px; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
    .field { font-size: 11px; margin-bottom: 4px; }
    .field strong { color: #003559; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #0353a4; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f8fafc; }
    .totals { margin-top: 16px; text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; margin-bottom: 4px; font-size: 12px; }
    .totals .total { font-size: 16px; font-weight: 900; color: #0353a4; border-top: 2px solid #0353a4; padding-top: 8px; margin-top: 8px; }
    .footer { margin-top: 40px; border-top: 1px solid #b9d6f2; padding-top: 12px; font-size: 9px; color: #666; text-align: center; }
    @media print {
      body { padding: 20px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <button onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:10px 20px;background:#0353a4;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;z-index:100;">
    🖨️ Imprimir / Guardar PDF
  </button>

  <div class="header">
    <div>
      <h1>FACTURA DE VENTA</h1>
      <p style="font-size:18px;font-weight:900;color:#003559;margin-top:4px;">${e(String(factura.num_factura))}</p>
    </div>
    <div class="meta">
      <p><strong>Fecha:</strong> ${new Date(factura.fecha_expedicion + "T00:00:00").toLocaleDateString("es-CO")}</p>
      <p><strong>Estado:</strong> ${e((factura.estado as string).toUpperCase())}</p>
    </div>
  </div>

  <div class="grid">
    <div class="section">
      <div class="section-title">Prestador</div>
      <div class="field"><strong>${e(String(perfil?.razon_social || perfil?.nombre_completo || "—"))}</strong></div>
      <div class="field">NIT: ${e(String(factura.nit_prestador || "—"))}</div>
      <div class="field">${e(perfil?.direccion || "")}</div>
      <div class="field">${e(perfil?.telefono || "")}</div>
      <div class="field">Cód. Habilitación: ${e(perfil?.codigo_habilitacion || "—")}</div>
    </div>
    <div class="section">
      <div class="section-title">Paciente</div>
      <div class="field"><strong>${e(nombrePaciente)}</strong></div>
      <div class="field">${e(paciente?.tipo_documento || "CC")}: ${e(paciente?.numero_documento || "—")}</div>
      <div class="field">Sexo: ${e(paciente?.sexo || "—")} | F. Nac: ${e(paciente?.fecha_nacimiento || "—")}</div>
      <div class="field">EPS: ${e(paciente?.eps_nombre || (factura.metadata as Record<string, string>)?.eps_nombre || "—")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Diagnósticos (CIE-10)</div>
    <table>
      <thead><tr><th>Código</th><th>Descripción</th><th>Rol</th></tr></thead>
      <tbody>
        ${diagnosticos.map((d) => `<tr><td style="font-weight:700;">${e(d.codigo_cie10)}</td><td>${e(d.descripcion)}</td><td>${e(d.rol)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Servicios / Procedimientos (CUPS)</div>
    <table>
      <thead><tr><th>Código</th><th>Descripción</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Valor Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>
        ${procedimientos.map((p) => {
          const vu = p.valor_unitario || 0;
          const st = vu * (p.cantidad || 1);
          return `<tr><td style="font-weight:700;">${e(p.codigo_cups)}</td><td>${e(p.descripcion)}</td><td style="text-align:center;">${p.cantidad}</td><td style="text-align:right;">${formatCOP(vu)}</td><td style="text-align:right;">${formatCOP(st)}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>

  <div class="totals">
    ${valorConsultaPdf > 0 ? `<div class="row"><span>Consulta médica:</span><span>${formatCOP(valorConsultaPdf)}</span></div>` : ""}
    <div class="row"><span>Subtotal:</span><span>${formatCOP(factura.subtotal || 0)}</span></div>
    ${factura.copago > 0 ? `<div class="row"><span>Copago:</span><span>-${formatCOP(factura.copago)}</span></div>` : ""}
    ${factura.cuota_moderadora > 0 ? `<div class="row"><span>Cuota Moderadora:</span><span>-${formatCOP(factura.cuota_moderadora)}</span></div>` : ""}
    <div class="row total"><span>TOTAL:</span><span>${formatCOP(factura.valor_total || 0)}</span></div>
  </div>

  <div class="footer">
    <p>Generado por <strong>Medibill</strong> — Sistema de facturación médica</p>
    <p><strong>REPRESENTACIÓN GRÁFICA — NO ES FACTURA ELECTRÓNICA DE VENTA</strong></p>
    <p style="margin-top:4px;">Este documento es una vista previa. La factura electrónica legal será emitida<br/>a través del proveedor de facturación electrónica autorizado por la DIAN.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
