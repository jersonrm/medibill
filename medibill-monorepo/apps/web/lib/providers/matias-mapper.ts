/**
 * Mapper: FacturaCompleta → Matias API Invoice JSON
 *
 * Transforma los datos internos de Medibill al formato JSON que espera
 * Matias API (POST /invoice). Matias se encarga de generar el XML UBL 2.1,
 * firmarlo digitalmente, calcular el CUFE y enviarlo a la DIAN.
 *
 * Referencia: https://docs.matias-api.com/docs/billing-fields
 */

import type { FacturaCompleta } from "@/lib/types/factura";
import type { PerfilFevInput, ResolucionFevInput, ClienteFevInput, PacienteFevInput } from "@/lib/types/fev-xml";
import type {
  MatiasInvoiceRequest,
  MatiasCustomer,
  MatiasPayment,
  MatiasInvoiceLine,
  MatiasLineTaxTotal,
  MatiasLegalMonetaryTotals,
  MatiasHealthSector,
  MatiasHealthInfo,
} from "./matias-types";
import { IDENTITY_DOC_MAP, getOrganizationType } from "./matias-types";

// =====================================================================
// FUNCIÓN PRINCIPAL
// =====================================================================

/**
 * Convierte una FacturaCompleta con datos de perfil/resolución/cliente/paciente
 * al formato JSON que espera Matias API para envío a la DIAN.
 */
export function mapFacturaToMatiasJson(
  factura: FacturaCompleta,
  perfil: PerfilFevInput,
  resolucion: ResolucionFevInput,
  cliente: ClienteFevInput,
  paciente?: PacienteFevInput,
): MatiasInvoiceRequest {
  const fechaEmision = factura.fecha_expedicion.substring(0, 10);
  const horaEmision = extraerHora(factura.fecha_expedicion);

  const lines = construirLineas(factura);
  const taxTotals = construirImpuestosTotales(factura, lines);
  const legalMonetaryTotals = construirTotales(factura, lines);
  const customer = construirCustomer(cliente);
  const payments = construirPagos(factura);
  const health = construirExtensionSalud(factura, perfil, cliente, paciente, fechaEmision, horaEmision);

  const request: MatiasInvoiceRequest = {
    resolution_number: resolucion.numero_resolucion,
    prefix: resolucion.prefijo || undefined,
    date: fechaEmision,
    time: horaEmision,
    notes: `Factura de servicios de salud - ${perfil.razon_social}`,
    operation_type_id: 1, // Nacional
    type_document_id: 7,  // Factura de Venta (ID interno Matias, DIAN código 01)
    graphic_representation: 1,
    send_email: cliente.email ? 1 : 0,
    payments,
    customer,
    legal_monetary_totals: legalMonetaryTotals,
    lines,
    tax_totals: taxTotals,
    health,
  };

  // Incluir número de documento de factura si está asignado (num_fev será el número FEV)
  if (factura.num_fev) {
    const numMatch = factura.num_fev.match(/\d+$/);
    if (numMatch) {
      request.document_number = parseInt(numMatch[0], 10);
    }
  }

  return request;
}

// =====================================================================
// CONSTRUCTORES INTERNOS
// =====================================================================

function construirCustomer(cliente: ClienteFevInput): MatiasCustomer {
  const identityDocId = IDENTITY_DOC_MAP[cliente.tipo_documento] ?? 6; // Default NIT
  const orgType = getOrganizationType(cliente.tipo_documento);

  return {
    country_id: 45, // Colombia
    city_id: parseInt(cliente.municipio_codigo || "11001", 10) || 11001,
    identity_document_id: identityDocId,
    type_organization_id: orgType,
    tax_regime_id: cliente.responsable_iva ? 1 : 2,
    tax_level_id: orgType === 1 ? 7 : 5, // 7=Gran contribuyente para PJ, 5=No aplica (R-99-PN) para PN
    company_name: cliente.razon_social,
    dni: cliente.numero_documento,
    mobile: cliente.telefono || undefined,
    email: cliente.email || undefined,
    address: cliente.direccion || undefined,
    postal_code: "000000",
  };
}

function construirPagos(factura: FacturaCompleta): MatiasPayment[] {
  return [{
    payment_method_id: 2,    // Crédito (salud siempre es a crédito con la EPS)
    means_payment_id: 42,    // Consignación bancaria
    value_paid: dec(factura.valor_total),
  }];
}

function construirLineas(factura: FacturaCompleta): MatiasInvoiceLine[] {
  const lines: MatiasInvoiceLine[] = [];

  // Consulta médica (si tiene valor_consulta > 0)
  const valorConsulta = factura.atencion?.valor_consulta || 0;
  if (valorConsulta > 0) {
    lines.push({
      invoiced_quantity: "1",
      quantity_units_id: 688, // Unidad
      line_extension_amount: dec(valorConsulta),
      free_of_charge_indicator: false,
      description: "Consulta médica",
      code: factura.atencion?.codConsultaCups || "890201",
      type_item_identifications_id: 999, // Código propio / CUPS
      reference_price_id: 1,
      price_amount: dec(valorConsulta),
      base_quantity: "1",
      tax_totals: [{
        tax_id: 1,  // IVA
        tax_amount: "0.00",
        taxable_amount: dec(valorConsulta),
        percent: "0",
      }],
    });
  }

  // Procedimientos CUPS
  for (const proc of factura.procedimientos) {
    const valorUnit = proc.valor_unitario || 0;
    const cantidad = proc.cantidad || 1;
    const total = redondear(valorUnit * cantidad);

    lines.push({
      invoiced_quantity: String(cantidad),
      quantity_units_id: 688,
      line_extension_amount: dec(total),
      free_of_charge_indicator: false,
      description: proc.descripcion || `Procedimiento ${proc.codigo_cups}`,
      code: proc.codigo_cups,
      type_item_identifications_id: 999,
      reference_price_id: 1,
      price_amount: dec(valorUnit),
      base_quantity: "1",
      tax_totals: [{
        tax_id: 1,
        tax_amount: "0.00",
        taxable_amount: dec(total),
        percent: "0",
      }],
    });
  }

  return lines;
}

function construirImpuestosTotales(
  _factura: FacturaCompleta,
  lines: MatiasInvoiceLine[],
): MatiasLineTaxTotal[] {
  // Servicios de salud excluidos de IVA (Art. 476 ET, numeral 1)
  const baseTotal = lines.reduce(
    (sum, l) => sum + parseFloat(l.line_extension_amount),
    0,
  );

  return [{
    tax_id: 1,      // IVA
    tax_amount: "0.00",
    taxable_amount: dec(baseTotal),
    percent: "0",
  }];
}

function construirTotales(
  factura: FacturaCompleta,
  lines: MatiasInvoiceLine[],
): MatiasLegalMonetaryTotals {
  const subtotalLineas = lines.reduce(
    (sum, l) => sum + parseFloat(l.line_extension_amount),
    0,
  );

  return {
    line_extension_amount: dec(subtotalLineas),
    tax_exclusive_amount: dec(subtotalLineas),
    tax_inclusive_amount: dec(subtotalLineas), // Sin IVA → mismo valor
    total_allowance: dec(factura.descuentos),
    payable_amount: dec(factura.valor_total),
  };
}

function construirExtensionSalud(
  factura: FacturaCompleta,
  perfil: PerfilFevInput,
  cliente: ClienteFevInput,
  paciente: PacienteFevInput | undefined,
  fecha: string,
  hora: string,
): MatiasHealthSector {
  const info: MatiasHealthInfo[] = [
    { name: "CODIGO_PRESTADOR", value: perfil.codigo_habilitacion },
    { name: "TIPO_DOCUMENTO_IDENTIFICACION", value: paciente?.tipo_documento || "CC", schemeID: "13" },
    { name: "NUMERO_DOCUMENTO_IDENTIFICACION", value: paciente?.numero_documento || "" },
    { name: "PRIMER_APELLIDO", value: paciente?.primer_apellido || "" },
    { name: "SEGUNDO_APELLIDO", value: paciente?.segundo_apellido || "" },
    { name: "PRIMER_NOMBRE", value: paciente?.primer_nombre || "" },
    { name: "SEGUNDO_NOMBRE", value: paciente?.segundo_nombre || "" },
    { name: "TIPO_USUARIO", value: paciente?.tipo_usuario || "01", schemeID: "01" },
    { name: "MODALIDAD_CONTRATACION", value: factura.atencion?.modalidad || "01" },
    { name: "OBERTURA_PLAN_BENEFICIOS", value: "01" },
    { name: "NUMERO_AUTORIZACION", value: factura.atencion?.numAutorizacion || "" },
    { name: "NUMERO_MIPRES", value: "" },
    { name: "NUMERO_ENTREGA_MIPRES", value: "" },
    { name: "NUMERO_CONTRATO", value: "" },
    { name: "NUMERO_POLIZA", value: "" },
    { name: "COPAGO", value: dec(factura.copago) },
    { name: "CUOTA_MODERADORA", value: dec(factura.cuota_moderadora) },
    { name: "CUOTA_RECUPERACION", value: "0.00" },
    { name: "PAGOS_COMPARTIDOS", value: "0.00" },
  ];

  return {
    operation_type: "SS-CUFE",
    invoice_period: {
      start_date: fecha,
      start_time: hora,
      end_date: fecha,
      end_time: hora,
    },
    user_collections: [{ information: info }],
  };
}

// =====================================================================
// UTILIDADES
// =====================================================================

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function dec(n: number): string {
  return redondear(n).toFixed(2);
}

function extraerHora(fechaExpedicion: string): string {
  if (fechaExpedicion.length > 10) {
    const timePart = fechaExpedicion.substring(11);
    const match = timePart.match(/^(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}:${match[3]}`;
    }
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}
