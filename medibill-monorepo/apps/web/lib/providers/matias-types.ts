/**
 * Tipos para la integración con Matias API v3.0.0 (LOPEZSOFT SAS)
 * Proveedor de Facturación Electrónica DIAN Colombia
 *
 * Referencia: https://docs.matias-api.com/docs/billing-fields
 */

// =====================================================================
// AUTENTICACIÓN
// =====================================================================

export interface MatiasAuthRequest {
  email: string;
  password: string;
}

export interface MatiasAuthResponse {
  token: string;
  token_type: string;
  expires_in: number;
}

// =====================================================================
// FACTURA — REQUEST (POST /invoice)
// =====================================================================

export interface MatiasCustomer {
  /** País: 45 = Colombia */
  country_id: number;
  /** Ciudad DANE code */
  city_id: number;
  /** Tipo doc: 1=RC, 2=TI, 3=CC, 4=TE, 5=CE, 6=NIT, 7=PA, 10=extranjero */
  identity_document_id: number;
  /** 1=Persona Jurídica, 2=Persona Natural */
  type_organization_id: number;
  /** 1=Responsable IVA, 2=No responsable */
  tax_regime_id: number;
  /** Responsabilidad fiscal: 5=No aplica (R-99-PN), 7=Gran contribuyente, etc. */
  tax_level_id: number;
  company_name: string;
  dni: string;
  mobile?: string;
  email?: string;
  address?: string;
  postal_code?: string;
}

export interface MatiasPayment {
  /** 1=contado, 2=crédito */
  payment_method_id: number;
  /** Medio de pago (ej: 10=efectivo, 42=consignación, 49=tarjeta débito) */
  means_payment_id: number;
  value_paid: string;
  payment_due_date?: string;
}

export interface MatiasLineTaxTotal {
  /** ID del impuesto (1=IVA, 2=IC, 3=ICA, 4=Bolsas plásticas, etc.) */
  tax_id: number;
  tax_amount: string;
  taxable_amount: string;
  percent: string;
}

export interface MatiasInvoiceLine {
  invoiced_quantity: string;
  /** Unidad de medida (688=Unidad, etc.) */
  quantity_units_id: number;
  line_extension_amount: string;
  free_of_charge_indicator: boolean;
  description: string;
  code: string;
  /** Tipo de identificación del ítem (4=Estándar UNSPSC, 999=Propio) */
  type_item_identifications_id: number;
  /** Precio de referencia (1=Valor comercial, 2=Valor de transferencia) */
  reference_price_id: number;
  price_amount: string;
  base_quantity: string;
  tax_totals?: MatiasLineTaxTotal[];
}

export interface MatiasLegalMonetaryTotals {
  line_extension_amount: string;
  tax_exclusive_amount: string;
  tax_inclusive_amount: string;
  total_charges?: string;
  total_allowance?: string;
  payable_amount: string;
}

/** Campo de información en user_collections del sector salud */
export interface MatiasHealthInfo {
  name: string;
  value: string;
  schemeName?: string;
  schemeID?: string;
}

export interface MatiasHealthUserCollection {
  information: MatiasHealthInfo[];
}

export interface MatiasHealthSector {
  /** "SS-CUFE" para facturación electrónica del sector salud */
  operation_type: string;
  invoice_period?: {
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
  };
  user_collections: MatiasHealthUserCollection[];
}

export interface MatiasInvoiceRequest {
  resolution_number: string;
  prefix?: string;
  date?: string;
  expiration_date?: string;
  time?: string;
  notes?: string;
  document_number?: number;
  /** 1=Nacional, 2=Exportación, 3=Contingencia */
  operation_type_id: number;
  /**
   * Tipo de documento en IDs internos de Matias API (NO códigos DIAN):
   * 7=Factura de Venta (DIAN 01), 8=Exportación (02), 9=Contingencia (03),
   * 10=Contingencia (04), 11=Documento Soporte (05), 20=POS (20)
   */
  type_document_id: number;
  /** 1=Generar representación gráfica */
  graphic_representation?: number;
  /** 1=Enviar email al adquirente */
  send_email?: number;
  /** Moneda: "35" = COP (ID interno Matias), default COP */
  currency_id?: string;
  payments: MatiasPayment[];
  customer: MatiasCustomer;
  legal_monetary_totals: MatiasLegalMonetaryTotals;
  lines: MatiasInvoiceLine[];
  tax_totals: MatiasLineTaxTotal[];
  /** Extensión del sector salud */
  health?: MatiasHealthSector;
}

// =====================================================================
// FACTURA — RESPONSE
// =====================================================================

export interface MatiasInvoiceResponse {
  success: boolean;
  message: string;
  document?: {
    id: number;
    uuid: string;
    document_number: string;
    /** CUFE generado por la DIAN */
    document_key: string;
    is_valid: boolean;
    invoice_date: string;
    qr?: string;
    status: string;
    xml?: string;
  };
  errors?: Record<string, string[]>;
}

// =====================================================================
// ESTADO — RESPONSE
// =====================================================================

export interface MatiasStatusResponse {
  success: boolean;
  message: string;
  document?: {
    uuid: string;
    document_number: string;
    document_key: string;
    is_valid: boolean;
    status: string;
    qr?: string;
  };
}

// =====================================================================
// DOCUMENTOS — BÚSQUEDA
// =====================================================================

export interface MatiasDocumentSearchParams {
  order_number?: string;
  query?: string;
  limit?: number;
  resolution?: string;
  number?: string;
  prefix?: string;
  start_date?: string;
  end_date?: string;
  document_key?: string;
  document_type?: string;
  /** -1=cualquiera, 0=no validado, 1=validado */
  document_status?: number;
}

// =====================================================================
// MAPEO DE TIPOS DE DOCUMENTO DE IDENTIDAD
// =====================================================================

/**
 * Mapeo de códigos DIAN/colombianos a identity_document_id de Matias API.
 * Referencia tabla DIAN 6.2.1 → Matias API.
 */
export const IDENTITY_DOC_MAP: Record<string, number> = {
  "11": 1,  // Registro civil → RC
  "12": 2,  // Tarjeta identidad → TI
  "13": 3,  // Cédula ciudadanía → CC
  "22": 5,  // Cédula extranjería → CE
  "31": 6,  // NIT
  "41": 7,  // Pasaporte → PA
  "42": 10, // Documento extranjero
  "47": 10, // PPT → Documento extranjero
  // Alias comunes
  RC: 1,
  TI: 2,
  CC: 3,
  CE: 5,
  NI: 6,
  NIT: 6,
  PA: 7,
  PE: 10,
  PT: 10,
};

/**
 * Mapeo de tipo_documento a tipo_organization:
 * NIT (31, NI) = 1 (Persona Jurídica), resto = 2 (Persona Natural)
 */
export function getOrganizationType(tipoDoc: string): number {
  return tipoDoc === "31" || tipoDoc === "NI" || tipoDoc === "NIT" ? 1 : 2;
}
