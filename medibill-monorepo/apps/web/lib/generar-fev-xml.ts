/**
 * Generador de XML FEV (Factura Electrónica de Venta) — UBL 2.1 DIAN Colombia
 * Resolución Única 000227 de 2025, Anexo Técnico v1.9 (T5.1)
 *
 * Genera XML conforme al estándar UBL 2.1 con extensiones DIAN y sector salud.
 * Mapea datos desde FacturaCompleta + PerfilPrestador + ResolucionFacturacion.
 */

import { create } from "xmlbuilder2";
import { createHash } from "crypto";
import { calcularCufe } from "@/lib/cufe";
import type {
  AccountingParty,
  FevInvoice,
  FevXmlResult,
  ResolucionFevInput,
  PerfilFevInput,
  ClienteFevInput,
  PacienteFevInput,
  InvoiceLine,
  TaxTotal,
  HealthSectorExtension,
} from "@/lib/types/fev-xml";
import type { FacturaCompleta } from "@/lib/types/factura";

// =====================================================================
// CONSTANTES
// =====================================================================

function requireDianEnv(name: string): string {
  const value = process.env[name] || "";
  if (!value && process.env.DIAN_AMBIENTE === "1") {
    throw new Error(`Variable de entorno ${name} es obligatoria en producción (DIAN_AMBIENTE=1)`);
  }
  return value;
}

const DIAN_SOFTWARE_ID = requireDianEnv("DIAN_SOFTWARE_ID");
const DIAN_SOFTWARE_PIN = requireDianEnv("DIAN_SOFTWARE_PIN");

const UBL_NAMESPACES = {
  "xmlns": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  "xmlns:ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  "xmlns:sts": "dian:gov:co:facturaelectronica:Structures-2-1",
  "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
} as const;

/** Mapeo tipo_documento a código tabla 6.2.1 DIAN */
const TIPO_DOC_DIAN: Record<string, { code: string; name: string }> = {
  CC: { code: "13", name: "Cédula de ciudadanía" },
  CE: { code: "22", name: "Cédula de extranjería" },
  NI: { code: "31", name: "NIT" },
  TI: { code: "12", name: "Tarjeta de identidad" },
  PA: { code: "41", name: "Pasaporte" },
  RC: { code: "11", name: "Registro civil" },
  CD: { code: "13", name: "Cédula de ciudadanía" },
  PE: { code: "42", name: "PEP" },
  PT: { code: "47", name: "PPT" },
  "31": { code: "31", name: "NIT" },
  "13": { code: "13", name: "Cédula de ciudadanía" },
};

// =====================================================================
// FUNCIÓN PRINCIPAL
// =====================================================================

/**
 * Genera el XML UBL 2.1 de Factura Electrónica de Venta para la DIAN.
 *
 * @param factura   - Factura completa persistida en Supabase
 * @param perfil    - Datos del perfil del prestador (emisor)
 * @param resolucion - Datos de la resolución DIAN asignada
 * @param cliente   - Datos del adquirente (EPS/pagador)
 * @param ambiente  - "1" producción, "2" pruebas (default: "2")
 * @returns FevXmlResult con XML, CUFE y factura estructurada
 */
export function generarXmlFev(
  factura: FacturaCompleta,
  perfil: PerfilFevInput,
  resolucion: ResolucionFevInput,
  cliente: ClienteFevInput,
  ambiente: "1" | "2" = "2",
  paciente?: PacienteFevInput,
): FevXmlResult {
  const fechaEmision = factura.fecha_expedicion.substring(0, 10); // YYYY-MM-DD
  const horaEmision = obtenerHoraEmision(factura.fecha_expedicion);

  // ═══ LÍNEAS DE FACTURA ═══
  const lineas = construirLineas(factura);

  // ═══ IMPUESTOS ═══
  // En salud — la mayoría de servicios de salud están excluidos de IVA
  const taxTotals = construirImpuestos(factura, lineas);

  // ═══ TOTALES ═══
  const subtotalLineas = lineas.reduce((s, l) => s + l.LineExtensionAmount, 0);
  const totalImpuestos = taxTotals.reduce((s, t) => s + t.TaxAmount, 0);
  const totalConImpuestos = subtotalLineas + totalImpuestos;

  // ═══ CUFE ═══
  const valIva = taxTotals.find(t => t.TaxSubtotal[0]?.TaxCategory.TaxScheme.ID === "01")?.TaxAmount ?? 0;
  const valIca = taxTotals.find(t => t.TaxSubtotal[0]?.TaxCategory.TaxScheme.ID === "04")?.TaxAmount ?? 0;
  const valIc  = taxTotals.find(t => t.TaxSubtotal[0]?.TaxCategory.TaxScheme.ID === "03")?.TaxAmount ?? 0;

  const cufe = calcularCufe({
    numFac: factura.num_factura,
    fecFac: fechaEmision,
    horFac: horaEmision,
    valFac: subtotalLineas,
    valImp1: valIva,
    valImp2: valIca,
    valImp3: valIc,
    valTot: totalConImpuestos,
    nitOFE: perfil.numero_documento,
    numAdq: cliente.numero_documento,
    clTec: resolucion.clave_tecnica,
    tipoAmbiente: ambiente,
  });

  // ═══ EXTENSIÓN SALUD ═══
  const healthSector = construirExtensionSalud(factura, cliente, paciente);

  // ═══ FACTURA ESTRUCTURADA ═══
  const invoice: FevInvoice = {
    UBLVersionID: "UBL 2.1",
    CustomizationID: "10",
    ProfileID: "DIAN 2.1",
    ProfileExecutionID: ambiente,
    ID: factura.num_factura,
    UUID: cufe,
    IssueDate: fechaEmision,
    IssueTime: horaEmision,
    InvoiceTypeCode: "01",
    Note: `Factura de servicios de salud - ${perfil.razon_social}`,
    DocumentCurrencyCode: "COP",
    LineCountNumeric: lineas.length,
    InvoiceControl: {
      InvoiceAuthorization: resolucion.numero_resolucion,
      AuthorizationPeriod: {
        StartDate: resolucion.fecha_vigencia_desde,
        EndDate: resolucion.fecha_vigencia_hasta,
      },
      AuthorizedInvoices: {
        Prefix: resolucion.prefijo,
        From: resolucion.rango_desde,
        To: resolucion.rango_hasta,
      },
    },
    HealthSector: healthSector,
    SoftwareProvider: {
      ProviderID: perfil.numero_documento,
      SoftwareID: DIAN_SOFTWARE_ID,
      SoftwareSecurityCode: calcularSoftwareSecurityCode(DIAN_SOFTWARE_ID, DIAN_SOFTWARE_PIN, perfil.numero_documento),
    },
    AccountingSupplierParty: construirSupplier(perfil),
    AccountingCustomerParty: construirCustomer(cliente),
    PaymentMeans: {
      ID: "2",                // Crédito (salud siempre es a crédito con la EPS)
      PaymentMeansCode: "42", // Consignación bancaria
    },
    TaxTotal: taxTotals,
    LegalMonetaryTotal: {
      LineExtensionAmount: redondear(subtotalLineas),
      TaxExclusiveAmount: redondear(subtotalLineas),
      TaxInclusiveAmount: redondear(totalConImpuestos),
      AllowanceTotalAmount: redondear(factura.descuentos),
      PayableAmount: redondear(factura.valor_total),
    },
    InvoiceLine: lineas,
  };

  // ═══ GENERAR XML ═══
  const xml = construirXml(invoice);

  return {
    xml,
    cufe,
    invoice,
    numFactura: factura.num_factura,
  };
}

// =====================================================================
// CONSTRUCTORES DE NODOS
// =====================================================================

function construirLineas(factura: FacturaCompleta): InvoiceLine[] {
  const lineas: InvoiceLine[] = [];
  let consecutivo = 1;

  // Consulta médica (si tiene valor_consulta > 0)
  const valorConsulta = factura.atencion?.valor_consulta || 0;
  if (valorConsulta > 0) {
    lineas.push({
      ID: consecutivo++,
      InvoicedQuantity: 1,
      UnitCode: "EA",
      LineExtensionAmount: redondear(valorConsulta),
      FreeOfChargeIndicator: false,
      Item: {
        Description: "Consulta médica",
        StandardItemIdentification: {
          ID: factura.atencion?.codConsultaCups || "890201",
          schemeID: "020",
          schemeName: "CUPS",
        },
      },
      Price: {
        PriceAmount: redondear(valorConsulta),
        BaseQuantity: 1,
      },
      TaxTotal: {
        TaxAmount: 0,
        TaxSubtotal: [{
          TaxableAmount: redondear(valorConsulta),
          TaxAmount: 0,
          TaxCategory: {
            Percent: 0,
            TaxScheme: { ID: "ZZ", Name: "No aplica" },
          },
        }],
      },
    });
  }

  // Procedimientos CUPS
  for (const proc of factura.procedimientos) {
    const valorUnit = proc.valor_unitario || proc.valor_procedimiento || 0;
    const total = redondear(valorUnit * (proc.cantidad || 1));
    lineas.push({
      ID: consecutivo++,
      InvoicedQuantity: proc.cantidad || 1,
      UnitCode: "EA",
      LineExtensionAmount: total,
      FreeOfChargeIndicator: false,
      Item: {
        Description: proc.descripcion || `Procedimiento ${proc.codigo_cups}`,
        StandardItemIdentification: {
          ID: proc.codigo_cups,
          schemeID: "020",
          schemeName: "CUPS",
        },
      },
      Price: {
        PriceAmount: redondear(valorUnit),
        BaseQuantity: 1,
      },
      TaxTotal: {
        TaxAmount: 0,
        TaxSubtotal: [{
          TaxableAmount: total,
          TaxAmount: 0,
          TaxCategory: {
            Percent: 0,
            TaxScheme: { ID: "ZZ", Name: "No aplica" },
          },
        }],
      },
    });
  }

  return lineas;
}

function construirImpuestos(_factura: FacturaCompleta, lineas: InvoiceLine[]): TaxTotal[] {
  // Servicios de salud están excluidos de IVA (Art. 476 ET, numeral 1)
  // Se reporta TaxTotal con valor 0 para IVA como exige la DIAN
  const baseTotal = lineas.reduce((s, l) => s + l.LineExtensionAmount, 0);

  return [{
    TaxAmount: 0,
    TaxSubtotal: [{
      TaxableAmount: redondear(baseTotal),
      TaxAmount: 0,
      TaxCategory: {
        Percent: 0,
        TaxScheme: { ID: "ZZ", Name: "No aplica" },
      },
    }],
  }];
}

function construirExtensionSalud(
  factura: FacturaCompleta,
  cliente: ClienteFevInput,
  paciente?: PacienteFevInput,
): HealthSectorExtension {
  return {
    AdministradoraCode: cliente.numero_documento,
    AdministradoraName: cliente.razon_social,
    TipoUsuario: paciente?.tipo_usuario || "01",
    ModalidadAtencion: factura.atencion?.modalidad || "01",
    CoberturaPlaBenef: "01",
    NumAutorizacion: factura.atencion?.numAutorizacion || null,
    NumMIPRES: null,
    NumPoliza: null,
    Copago: factura.copago,
    CuotaModeradora: factura.cuota_moderadora,
    CuotaRecuperacion: 0,
    PagosCompartidos: 0,
  };
}

function construirSupplier(perfil: PerfilFevInput) {
  const tipoDoc = TIPO_DOC_DIAN[perfil.tipo_documento] || TIPO_DOC_DIAN["CC"]!;
  const esPersonaJuridica = perfil.tipo_documento === "NI" || perfil.tipo_prestador === "clinica";

  // Responsabilidad fiscal según régimen
  let taxLevelCode = "R-99-PN"; // No responsable - persona natural (default para médicos)
  if (perfil.responsable_iva) {
    taxLevelCode = "O-48"; // Responsable de IVA
  } else if (perfil.regimen_fiscal === "comun") {
    taxLevelCode = "O-48";
  }

  return {
    AdditionalAccountID: esPersonaJuridica ? "1" : "2",
    Party: {
      PartyIdentification: {
        ID: perfil.numero_documento,
        schemeID: tipoDoc.code,
        schemeName: tipoDoc.name,
      },
      PartyName: perfil.nombre_comercial || perfil.razon_social,
      PhysicalLocation: {
        ID: perfil.municipio_codigo,
        CityName: perfil.municipio_nombre,
        CountrySubentity: perfil.departamento_nombre,
        CountrySubentityCode: perfil.departamento_codigo,
        AddressLine: perfil.direccion,
        Country: { IdentificationCode: "CO", Name: "Colombia" },
      },
      PartyTaxScheme: {
        RegistrationName: perfil.razon_social,
        CompanyID: perfil.numero_documento,
        TaxLevelCode: taxLevelCode,
        TaxScheme: {
          ID: perfil.responsable_iva ? "01" : "ZZ",
          Name: perfil.responsable_iva ? "IVA" : "No Aplica",
        },
      },
      Contact: {
        Telephone: perfil.telefono,
        ElectronicMail: perfil.email_facturacion,
      },
    },
  };
}

function construirCustomer(cliente: ClienteFevInput) {
  const tipoDoc = TIPO_DOC_DIAN[cliente.tipo_documento] || TIPO_DOC_DIAN["31"]!;

  return {
    AdditionalAccountID: "1", // EPS siempre es persona jurídica
    Party: {
      PartyIdentification: {
        ID: cliente.numero_documento,
        schemeID: tipoDoc.code,
        schemeName: tipoDoc.name,
      },
      PartyName: cliente.nombre_comercial || cliente.razon_social,
      PhysicalLocation: {
        ID: cliente.municipio_codigo || "11001",
        CityName: cliente.municipio_nombre || "Bogotá",
        CountrySubentity: cliente.departamento_nombre || "Bogotá, D.C.",
        CountrySubentityCode: cliente.departamento_codigo || "11",
        AddressLine: cliente.direccion || "",
        Country: { IdentificationCode: "CO", Name: "Colombia" },
      },
      PartyTaxScheme: {
        RegistrationName: cliente.razon_social,
        CompanyID: cliente.numero_documento,
        TaxLevelCode: "O-48",
        TaxScheme: {
          ID: cliente.responsable_iva ? "01" : "ZZ",
          Name: cliente.responsable_iva ? "IVA" : "No Aplica",
        },
      },
      Contact: {
        Telephone: cliente.telefono,
        ElectronicMail: cliente.email,
      },
    },
  };
}

// =====================================================================
// SERIALIZACIÓN XML UBL 2.1
// =====================================================================

function construirXml(invoice: FevInvoice): string {
  const doc = create({ version: "1.0", encoding: "UTF-8", standalone: false })
    .ele("Invoice", UBL_NAMESPACES);

  // ═══ UBL Extensions (DIAN InvoiceControl + Health) ═══
  const extensions = doc.ele("ext:UBLExtensions");

  // Extension 1: InvoiceControl (datos resolución DIAN)
  const ext1 = extensions.ele("ext:UBLExtension").ele("ext:ExtensionContent")
    .ele("sts:DianExtensions");

  const ic = ext1.ele("sts:InvoiceControl");
  ic.ele("sts:InvoiceAuthorization").txt(invoice.InvoiceControl.InvoiceAuthorization);
  const period = ic.ele("sts:AuthorizationPeriod");
  period.ele("cbc:StartDate").txt(invoice.InvoiceControl.AuthorizationPeriod.StartDate);
  period.ele("cbc:EndDate").txt(invoice.InvoiceControl.AuthorizationPeriod.EndDate);
  const authInv = ic.ele("sts:AuthorizedInvoices");
  authInv.ele("sts:Prefix").txt(invoice.InvoiceControl.AuthorizedInvoices.Prefix);
  authInv.ele("sts:From").txt(String(invoice.InvoiceControl.AuthorizedInvoices.From));
  authInv.ele("sts:To").txt(String(invoice.InvoiceControl.AuthorizedInvoices.To));

  ext1.ele("sts:InvoiceSource")
    .ele("cbc:IdentificationCode", { listAgencyID: "6", listAgencyName: "United Nations Economic Commission for Europe", listSchemeURI: "urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1" })
    .txt("CO");

  // Software provider (Software propio — datos registrados en DIAN)
  const swp = invoice.SoftwareProvider;
  const sp = ext1.ele("sts:SoftwareProvider");
  sp.ele("sts:ProviderID", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)", schemeID: "31", schemeName: "31" })
    .txt(swp.ProviderID);
  sp.ele("sts:SoftwareID", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" })
    .txt(swp.SoftwareID);

  ext1.ele("sts:SoftwareSecurityCode", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" })
    .txt(swp.SoftwareSecurityCode);

  ext1.ele("sts:AuthorizationProvider")
    .ele("sts:AuthorizationProviderID", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)", schemeID: "31", schemeName: "31" })
    .txt("800197268");

  // Extension 2: Sector Salud
  if (invoice.HealthSector) {
    const ext2 = extensions.ele("ext:UBLExtension").ele("ext:ExtensionContent")
      .ele("sts:HealthSector");
    const hs = invoice.HealthSector;
    ext2.ele("sts:AdministradoraCode").txt(hs.AdministradoraCode);
    ext2.ele("sts:AdministradoraName").txt(hs.AdministradoraName);
    ext2.ele("sts:TipoUsuario").txt(hs.TipoUsuario);
    ext2.ele("sts:ModalidadAtencion").txt(hs.ModalidadAtencion);
    ext2.ele("sts:CoberturaPlaBenef").txt(hs.CoberturaPlaBenef);
    if (hs.NumAutorizacion) ext2.ele("sts:NumAutorizacion").txt(hs.NumAutorizacion);
    if (hs.NumMIPRES) ext2.ele("sts:NumMIPRES").txt(hs.NumMIPRES);
    if (hs.NumPoliza) ext2.ele("sts:NumPoliza").txt(hs.NumPoliza);
    ext2.ele("sts:Copago").txt(String(hs.Copago));
    ext2.ele("sts:CuotaModeradora").txt(String(hs.CuotaModeradora));
    ext2.ele("sts:CuotaRecuperacion").txt(String(hs.CuotaRecuperacion));
    ext2.ele("sts:PagosCompartidos").txt(String(hs.PagosCompartidos));
  }

  // Extension 3: Placeholder para firma digital XAdES-EPES (requerido por XSD DIAN)
  extensions.ele("ext:UBLExtension").ele("ext:ExtensionContent");

  // ═══ Metadatos UBL ═══
  doc.ele("cbc:UBLVersionID").txt(invoice.UBLVersionID);
  doc.ele("cbc:CustomizationID").txt(invoice.CustomizationID);
  doc.ele("cbc:ProfileID").txt(invoice.ProfileID);
  doc.ele("cbc:ProfileExecutionID").txt(invoice.ProfileExecutionID);
  doc.ele("cbc:ID").txt(invoice.ID);
  doc.ele("cbc:UUID", { schemeID: invoice.ProfileExecutionID, schemeName: "CUFE-SHA384" }).txt(invoice.UUID);
  doc.ele("cbc:IssueDate").txt(invoice.IssueDate);
  doc.ele("cbc:IssueTime").txt(invoice.IssueTime);
  doc.ele("cbc:InvoiceTypeCode").txt(invoice.InvoiceTypeCode);
  if (invoice.Note) doc.ele("cbc:Note").txt(invoice.Note);
  doc.ele("cbc:DocumentCurrencyCode", { listID: "ISO 4217", listAgencyID: "6", listAgencyName: "United Nations Economic Commission for Europe" }).txt(invoice.DocumentCurrencyCode);
  doc.ele("cbc:LineCountNumeric").txt(String(invoice.LineCountNumeric));

  // ═══ Supplier (Prestador) ═══
  construirPartyXml(doc, "cac:AccountingSupplierParty", invoice.AccountingSupplierParty);

  // ═══ Customer (EPS) ═══
  construirPartyXml(doc, "cac:AccountingCustomerParty", invoice.AccountingCustomerParty);

  // ═══ Payment Means ═══
  const pm = doc.ele("cac:PaymentMeans");
  pm.ele("cbc:ID").txt(invoice.PaymentMeans.ID);
  pm.ele("cbc:PaymentMeansCode").txt(invoice.PaymentMeans.PaymentMeansCode);
  if (invoice.PaymentMeans.PaymentDueDate) {
    pm.ele("cbc:PaymentDueDate").txt(invoice.PaymentMeans.PaymentDueDate);
  }

  // ═══ Tax Totals ═══
  for (const tax of invoice.TaxTotal) {
    const tt = doc.ele("cac:TaxTotal");
    tt.ele("cbc:TaxAmount", { currencyID: "COP" }).txt(formatearDecimal(tax.TaxAmount));
    for (const sub of tax.TaxSubtotal) {
      const ts = tt.ele("cac:TaxSubtotal");
      ts.ele("cbc:TaxableAmount", { currencyID: "COP" }).txt(formatearDecimal(sub.TaxableAmount));
      ts.ele("cbc:TaxAmount", { currencyID: "COP" }).txt(formatearDecimal(sub.TaxAmount));
      const tc = ts.ele("cac:TaxCategory");
      tc.ele("cbc:Percent").txt(formatearDecimal(sub.TaxCategory.Percent));
      const tsch = tc.ele("cac:TaxScheme");
      tsch.ele("cbc:ID").txt(sub.TaxCategory.TaxScheme.ID);
      tsch.ele("cbc:Name").txt(sub.TaxCategory.TaxScheme.Name);
    }
  }

  // ═══ Legal Monetary Total ═══
  const lmt = doc.ele("cac:LegalMonetaryTotal");
  lmt.ele("cbc:LineExtensionAmount", { currencyID: "COP" }).txt(formatearDecimal(invoice.LegalMonetaryTotal.LineExtensionAmount));
  lmt.ele("cbc:TaxExclusiveAmount", { currencyID: "COP" }).txt(formatearDecimal(invoice.LegalMonetaryTotal.TaxExclusiveAmount));
  lmt.ele("cbc:TaxInclusiveAmount", { currencyID: "COP" }).txt(formatearDecimal(invoice.LegalMonetaryTotal.TaxInclusiveAmount));
  lmt.ele("cbc:AllowanceTotalAmount", { currencyID: "COP" }).txt(formatearDecimal(invoice.LegalMonetaryTotal.AllowanceTotalAmount));
  lmt.ele("cbc:PayableAmount", { currencyID: "COP" }).txt(formatearDecimal(invoice.LegalMonetaryTotal.PayableAmount));

  // ═══ Invoice Lines ═══
  for (const line of invoice.InvoiceLine) {
    const il = doc.ele("cac:InvoiceLine");
    il.ele("cbc:ID").txt(String(line.ID));
    il.ele("cbc:InvoicedQuantity", { unitCode: line.UnitCode }).txt(String(line.InvoicedQuantity));
    il.ele("cbc:LineExtensionAmount", { currencyID: "COP" }).txt(formatearDecimal(line.LineExtensionAmount));
    il.ele("cbc:FreeOfChargeIndicator").txt(String(line.FreeOfChargeIndicator));

    // Tax de la línea
    if (line.TaxTotal) {
      const ltax = il.ele("cac:TaxTotal");
      ltax.ele("cbc:TaxAmount", { currencyID: "COP" }).txt(formatearDecimal(line.TaxTotal.TaxAmount));
      for (const sub of line.TaxTotal.TaxSubtotal) {
        const lts = ltax.ele("cac:TaxSubtotal");
        lts.ele("cbc:TaxableAmount", { currencyID: "COP" }).txt(formatearDecimal(sub.TaxableAmount));
        lts.ele("cbc:TaxAmount", { currencyID: "COP" }).txt(formatearDecimal(sub.TaxAmount));
        const ltc = lts.ele("cac:TaxCategory");
        ltc.ele("cbc:Percent").txt(formatearDecimal(sub.TaxCategory.Percent));
        const ltsch = ltc.ele("cac:TaxScheme");
        ltsch.ele("cbc:ID").txt(sub.TaxCategory.TaxScheme.ID);
        ltsch.ele("cbc:Name").txt(sub.TaxCategory.TaxScheme.Name);
      }
    }

    // Item
    const item = il.ele("cac:Item");
    item.ele("cbc:Description").txt(line.Item.Description);
    const sid = item.ele("cac:StandardItemIdentification");
    sid.ele("cbc:ID", {
      schemeID: line.Item.StandardItemIdentification.schemeID,
      schemeName: line.Item.StandardItemIdentification.schemeName,
    }).txt(line.Item.StandardItemIdentification.ID);

    // Price
    const price = il.ele("cac:Price");
    price.ele("cbc:PriceAmount", { currencyID: "COP" }).txt(formatearDecimal(line.Price.PriceAmount));
    price.ele("cbc:BaseQuantity", { unitCode: line.UnitCode }).txt(String(line.Price.BaseQuantity));
  }

  return doc.end({ prettyPrint: true, indent: "  " });
}

function construirPartyXml(
  parent: ReturnType<typeof create>,
  tagName: string,
  party: AccountingParty,
) {
  const node = parent.ele(tagName);
  node.ele("cbc:AdditionalAccountID").txt(party.AdditionalAccountID);
  const p = node.ele("cac:Party");

  // PartyIdentification
  const pid = p.ele("cac:PartyIdentification");
  pid.ele("cbc:ID", {
    schemeAgencyID: "195",
    schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)",
    schemeID: party.Party.PartyIdentification.schemeID,
    schemeName: party.Party.PartyIdentification.schemeName,
  }).txt(party.Party.PartyIdentification.ID);

  // PartyName
  p.ele("cac:PartyName").ele("cbc:Name").txt(party.Party.PartyName);

  // PhysicalLocation
  const pl = p.ele("cac:PhysicalLocation").ele("cac:Address");
  pl.ele("cbc:ID").txt(party.Party.PhysicalLocation.ID);
  pl.ele("cbc:CityName").txt(party.Party.PhysicalLocation.CityName);
  pl.ele("cbc:CountrySubentity").txt(party.Party.PhysicalLocation.CountrySubentity);
  pl.ele("cbc:CountrySubentityCode").txt(party.Party.PhysicalLocation.CountrySubentityCode);
  pl.ele("cac:AddressLine").ele("cbc:Line").txt(party.Party.PhysicalLocation.AddressLine);
  const country = pl.ele("cac:Country");
  country.ele("cbc:IdentificationCode").txt(party.Party.PhysicalLocation.Country.IdentificationCode);
  country.ele("cbc:Name", { languageID: "es" }).txt(party.Party.PhysicalLocation.Country.Name);

  // PartyTaxScheme
  const pts = p.ele("cac:PartyTaxScheme");
  pts.ele("cbc:RegistrationName").txt(party.Party.PartyTaxScheme.RegistrationName);
  pts.ele("cbc:CompanyID", {
    schemeAgencyID: "195",
    schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)",
    schemeID: "31",
    schemeName: "31",
  }).txt(party.Party.PartyTaxScheme.CompanyID);
  pts.ele("cbc:TaxLevelCode", { listName: "48" }).txt(party.Party.PartyTaxScheme.TaxLevelCode);
  const taxScheme = pts.ele("cac:TaxScheme");
  taxScheme.ele("cbc:ID").txt(party.Party.PartyTaxScheme.TaxScheme.ID);
  taxScheme.ele("cbc:Name").txt(party.Party.PartyTaxScheme.TaxScheme.Name);

  // Contact — solo si hay al menos un dato
  if (party.Party.Contact?.Telephone || party.Party.Contact?.ElectronicMail) {
    const contact = p.ele("cac:Contact");
    if (party.Party.Contact.Telephone) contact.ele("cbc:Telephone").txt(party.Party.Contact.Telephone);
    if (party.Party.Contact.ElectronicMail) contact.ele("cbc:ElectronicMail").txt(party.Party.Contact.ElectronicMail);
  }
}

// =====================================================================
// UTILIDADES
// =====================================================================

/** SoftwareSecurityCode = SHA-384(SoftwareID + Pin + NIT_facturador) */
function calcularSoftwareSecurityCode(softwareId: string, pin: string, nit: string): string {
  return createHash("sha384").update(`${softwareId}${pin}${nit}`, "utf8").digest("hex");
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatearDecimal(n: number): string {
  return n.toFixed(2);
}

function obtenerHoraEmision(fechaExpedicion: string): string {
  // Si la fecha ya tiene hora completa, extraerla
  if (fechaExpedicion.length > 10) {
    const timePart = fechaExpedicion.substring(11);

    // Parsear hora y offset del string ISO
    const timeMatch = timePart.match(/^(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2}|Z)?/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1]!, 10);
      const m = timeMatch[2]!;
      const s = timeMatch[3]!;
      const offset = timeMatch[4];

      // Si está en UTC (+00:00 o Z), convertir a Colombia (UTC-5)
      if (offset === "Z" || offset === "+00:00") {
        h = h - 5;
        if (h < 0) h += 24;
      }
      // Si ya tiene offset Colombia, devolverlo tal cual
      if (offset === "-05:00") {
        return `${timeMatch[1]}:${m}:${s}-05:00`;
      }
      return `${String(h).padStart(2, "0")}:${m}:${s}-05:00`;
    }

    // Fallback: agregar offset Colombia
    const hh = timePart.substring(0, 2);
    const mm = timePart.substring(3, 5);
    const ss = timePart.substring(6, 8) || "00";
    return `${hh}:${mm}:${ss}-05:00`;
  }
  // Si solo es fecha, usar hora actual con offset Colombia
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}-05:00`;
}
