/**
 * Tipos UBL 2.1 para Factura Electrónica de Venta (FEV) — DIAN Colombia
 * Basado en Anexo Técnico Resolución Única 000227 de 2025, v1.9 (T5.1)
 *
 * Namespaces UBL:
 *   - cbc: urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2
 *   - cac: urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2
 *   - sts: dian:gov:co:facturaelectronica:Structures-2-1
 *   - ext: urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2
 */

// =====================================================================
// EXTENSIÓN DIAN — sts:InvoiceControl (resolución de facturación)
// =====================================================================

export interface InvoiceControl {
  InvoiceAuthorization: string;        // Número de resolución DIAN
  AuthorizationPeriod: {
    StartDate: string;                 // Fecha inicio vigencia (YYYY-MM-DD)
    EndDate: string;                   // Fecha fin vigencia (YYYY-MM-DD)
  };
  AuthorizedInvoices: {
    Prefix: string;                    // Prefijo autorizado
    From: number;                      // Rango desde
    To: number;                        // Rango hasta
  };
}

// =====================================================================
// EXTENSIÓN SECTOR SALUD
// =====================================================================

export interface HealthSectorExtension {
  /** NIT de la EPS / entidad administradora */
  AdministradoraCode: string;
  /** Nombre de la EPS */
  AdministradoraName: string;
  /** Tipo de usuario (01-08 conforme Res. 2275) */
  TipoUsuario: string;
  /** Modalidad de atención (01-07) */
  ModalidadAtencion: string;
  /** Cobertura del plan de beneficios */
  CoberturaPlaBenef: string;
  /** Número de autorización EPS */
  NumAutorizacion: string | null;
  /** Número MIPRES */
  NumMIPRES: string | null;
  /** Número de póliza/contrato */
  NumPoliza: string | null;
  /** Copago */
  Copago: number;
  /** Cuota moderadora */
  CuotaModeradora: number;
  /** Pagos compartidos (cuota de recuperación) */
  CuotaRecuperacion: number;
  /** Pagos no cubiertos (diferencia no POS) */
  PagosCompartidos: number;
}

// =====================================================================
// PARTES (Supplier / Customer)
// =====================================================================

export interface PartyTaxScheme {
  RegistrationName: string;            // Razón social
  CompanyID: string;                   // NIT sin DV
  TaxLevelCode: string;               // Responsabilidades fiscales (O-48, R-99-PN, etc.)
  TaxScheme: {
    ID: string;                        // "01" = IVA, "ZZ" = No aplica
    Name: string;                      // "IVA" | "No Aplica"
  };
}

export interface PartyAddress {
  ID: string;                          // Código DIVIPOLA municipio
  CityName: string;                    // Nombre del municipio
  CountrySubentity: string;            // Nombre del departamento
  CountrySubentityCode: string;        // Código departamento
  AddressLine: string;                 // Dirección textual
  Country: {
    IdentificationCode: string;        // "CO"
    Name: string;                      // "Colombia"
  };
}

export interface PartyContact {
  Telephone?: string;
  ElectronicMail?: string;
}

export interface AccountingParty {
  AdditionalAccountID: string;         // "1" = persona jurídica, "2" = persona natural
  Party: {
    PartyIdentification: {
      ID: string;                      // NIT / CC del partido
      schemeID: string;                // "31" = NIT, "13" = CC, etc.
      schemeName: string;             // Código tipo doc (tabla 6.2.1)
    };
    PartyName: string;                 // Nombre comercial
    PhysicalLocation: PartyAddress;
    PartyTaxScheme: PartyTaxScheme;
    Contact?: PartyContact;
  };
}

// =====================================================================
// IMPUESTOS
// =====================================================================

export interface TaxSubtotal {
  TaxableAmount: number;               // Base gravable
  TaxAmount: number;                   // Valor del impuesto
  TaxCategory: {
    Percent: number;                   // Porcentaje (19, 5, 0)
    TaxScheme: {
      ID: string;                      // "01" = IVA, "04" = ICA, "ZZ" = No aplica
      Name: string;
    };
  };
}

export interface TaxTotal {
  TaxAmount: number;                   // Suma total de impuestos
  TaxSubtotal: TaxSubtotal[];
}

// =====================================================================
// MONTOS
// =====================================================================

export interface LegalMonetaryTotal {
  LineExtensionAmount: number;         // Suma de líneas (subtotal bruto)
  TaxExclusiveAmount: number;          // Base gravable total
  TaxInclusiveAmount: number;          // Total con impuestos
  AllowanceTotalAmount: number;        // Total descuentos/cargos
  PayableAmount: number;               // Total a pagar
}

// =====================================================================
// LÍNEAS DE FACTURA
// =====================================================================

export interface InvoiceLine {
  ID: number;                          // Consecutivo de línea (1, 2, 3...)
  InvoicedQuantity: number;            // Cantidad
  UnitCode: string;                    // Unidad de medida ("EA" = unidad, "MO" = sesión)
  LineExtensionAmount: number;         // Valor total línea (Qty * PriceAmount)
  FreeOfChargeIndicator: boolean;      // true = sin cargo
  Item: {
    Description: string;               // Descripción del servicio/procedimiento
    StandardItemIdentification: {
      ID: string;                      // Código CUPS del procedimiento
      schemeID: string;                // "999" = estándar propio, "020" = CUPS
      schemeName: string;             // "CUPS"
    };
  };
  Price: {
    PriceAmount: number;               // Valor unitario
    BaseQuantity: number;              // Base de cantidad (usualmente 1)
  };
  TaxTotal?: TaxTotal;                 // Impuestos de la línea
}

// =====================================================================
// MEDIO DE PAGO
// =====================================================================

export interface PaymentMeans {
  ID: string;                          // "1" = contado, "2" = crédito
  PaymentMeansCode: string;            // "10" = efectivo, "42" = consignación, etc.
  PaymentDueDate?: string;             // Fecha vencimiento (solo crédito)
}

// =====================================================================
// DOCUMENTO RAÍZ — Invoice UBL 2.1
// =====================================================================

export interface FevInvoice {
  // Metadatos UBL
  UBLVersionID: "UBL 2.1";
  CustomizationID: string;             // Versión DIAN (ej: "10")
  ProfileID: string;                   // "DIAN 2.1" o "DIAN 2.1 health"
  ProfileExecutionID: string;          // "1" = producción, "2" = pruebas

  // Identificación del documento
  ID: string;                          // Número de factura (prefijo + consecutivo)
  UUID: string;                        // CUFE (Código Único de Factura Electrónica)
  IssueDate: string;                   // Fecha emisión (YYYY-MM-DD)
  IssueTime: string;                   // Hora emisión (HH:MM:SS-05:00)
  DueDate?: string;                    // Fecha vencimiento
  InvoiceTypeCode: string;             // "01" = Factura de venta
  Note?: string;                       // Nota general de la factura

  // Moneda
  DocumentCurrencyCode: string;        // "COP"

  // Cantidad de líneas
  LineCountNumeric: number;            // Total de InvoiceLine

  // Extensiones DIAN
  InvoiceControl: InvoiceControl;
  HealthSector?: HealthSectorExtension;
  SoftwareProvider: {
    ProviderID: string;              // NIT del facturador (software propio)
    SoftwareID: string;              // ID asignado por DIAN al software
    SoftwareSecurityCode: string;    // SHA-384(SoftwareID + Pin + NIT)
  };

  // Partes
  AccountingSupplierParty: AccountingParty;  // Prestador (emisor)
  AccountingCustomerParty: AccountingParty;  // EPS / pagador (receptor)

  // Pago
  PaymentMeans: PaymentMeans;

  // Impuestos
  TaxTotal: TaxTotal[];

  // Totales
  LegalMonetaryTotal: LegalMonetaryTotal;

  // Líneas
  InvoiceLine: InvoiceLine[];
}

// =====================================================================
// PARÁMETROS DE ENTRADA PARA GENERACIÓN
// =====================================================================

/** Datos de resolución DIAN necesarios para generar la FEV */
export interface ResolucionFevInput {
  numero_resolucion: string;
  fecha_resolucion: string;
  prefijo: string;
  rango_desde: number;
  rango_hasta: number;
  fecha_vigencia_desde: string;
  fecha_vigencia_hasta: string;
  /** Clave técnica asignada por la DIAN al rango de numeración */
  clave_tecnica: string;
}

/** Datos del perfil del prestador necesarios para generar la FEV */
export interface PerfilFevInput {
  tipo_documento: string;
  numero_documento: string;
  digito_verificacion: string;
  razon_social: string;
  nombre_comercial: string;
  codigo_habilitacion: string;
  tipo_prestador: string;
  direccion: string;
  municipio_codigo: string;
  municipio_nombre: string;
  departamento_codigo: string;
  departamento_nombre: string;
  telefono: string;
  email_facturacion: string;
  responsable_iva: boolean;
  regimen_fiscal: string;
}

/** Datos del cliente/EPS necesarios para la FEV */
export interface ClienteFevInput {
  tipo_documento: string;             // "31" = NIT
  numero_documento: string;           // NIT de la EPS
  digito_verificacion?: string;
  razon_social: string;               // Razón social de la EPS
  nombre_comercial?: string;
  direccion?: string;
  municipio_codigo?: string;
  municipio_nombre?: string;
  departamento_codigo?: string;
  departamento_nombre?: string;
  telefono?: string;
  email?: string;
  responsable_iva?: boolean;
  regimen_fiscal?: string;
}

/** Datos del paciente necesarios para la FEV (extensión sector salud) */
export interface PacienteFevInput {
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  /** Tipo de usuario SGSSS (01-08 conforme Res. 2275) */
  tipo_usuario: string;
  sexo?: string;
  fecha_nacimiento?: string;
  municipio_residencia_codigo?: string;
  zona_territorial?: string;
  eps_codigo?: string;
  eps_nombre?: string;
}

/** Resultado de la generación de FEV XML */
export interface FevXmlResult {
  xml: string;                         // XML completo como string
  cufe: string;                        // CUFE calculado
  invoice: FevInvoice;                 // Objeto estructurado
  numFactura: string;                  // Número de factura generado
}
