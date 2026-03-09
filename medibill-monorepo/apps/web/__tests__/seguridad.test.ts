import { describe, it, expect, vi } from "vitest";
import { escapeHtml } from "@/lib/formato";

// Mock módulos que requieren API keys al importarse
vi.mock("@/lib/embedding-service", () => ({ searchByText: vi.fn() }));
vi.mock("@/lib/cups-service", () => ({ buscarCupsPorCodigo: vi.fn(), buscarCupsPorTexto: vi.fn() }));
vi.mock("@/lib/cie10-service", () => ({ buscarCie10PorCodigo: vi.fn(), buscarCie10PorTexto: vi.fn() }));

import { anonimizarTextoMedico } from "@/lib/validacion-medica";

// =============================================
// PASO 1: Prevención de XSS en generación HTML
// =============================================
describe("escapeHtml", () => {
  it("escapa tags <script> (prevención XSS)", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapa atributos con comillas dobles", () => {
    expect(escapeHtml('" onmouseover="alert(1)"')).toBe(
      '&quot; onmouseover=&quot;alert(1)&quot;'
    );
  });

  it("escapa ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapa comillas simples", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("no modifica texto limpio", () => {
    expect(escapeHtml("Juan Pérez López")).toBe("Juan Pérez López");
  });

  it("maneja cadenas vacías", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("previene inyección de img/onerror", () => {
    const malicious = '<img src=x onerror="alert(document.cookie)">';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
  });

  it("XSS como nombre de paciente queda neutralizado en HTML", () => {
    const nombre = '<script>alert(1)</script>';
    const html = `<div class="field"><strong>${escapeHtml(nombre)}</strong></div>`;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// =============================================
// PASO 4: Anonimización ampliada (HABEAS DATA)
// =============================================
describe("anonimizarTextoMedico — datos ampliados", () => {
  const notaClinica = [
    "Paciente: Juan Pérez, CC 1023456789",
    "Teléfono: 3001234567",
    "Email: juan.perez@gmail.com",
    "Dirección: Calle 45 # 23-15",
    "Diagnóstico: K35.0 Apendicitis aguda",
    "Procedimiento CUPS: 470101 Apendicectomía",
  ].join("\n");

  it("anonimiza nombre del paciente", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).not.toContain("Juan Pérez");
    expect(result).toContain("[NOMBRE_PACIENTE]");
  });

  it("anonimiza documento explícito", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).not.toContain("1023456789");
    expect(result).toContain("[DOCUMENTO_PACIENTE]");
  });

  it("anonimiza teléfonos colombianos (celular)", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).not.toContain("3001234567");
    expect(result).toContain("[TELEFONO]");
  });

  it("anonimiza teléfonos con separadores", () => {
    const texto = "Contacto: 300-123-4567 o 310 456 7890";
    const result = anonimizarTextoMedico(texto);
    expect(result).not.toContain("300-123-4567");
    expect(result).not.toContain("310 456 7890");
  });

  it("anonimiza emails", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).not.toContain("juan.perez@gmail.com");
    expect(result).toContain("[EMAIL]");
  });

  it("anonimiza cédulas en contexto (CC, cédula, TI, etc.)", () => {
    const texto = "Paciente con cédula 987654321 presenta dolor abdominal";
    const result = anonimizarTextoMedico(texto);
    expect(result).not.toContain("987654321");
    expect(result).toContain("[DOCUMENTO]");
  });

  it("anonimiza cédulas con prefijo C.C.", () => {
    const texto = "C.C. No. 12345678 del paciente";
    const result = anonimizarTextoMedico(texto);
    expect(result).not.toContain("12345678");
    expect(result).toContain("[DOCUMENTO]");
  });

  it("anonimiza direcciones colombianas", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).not.toContain("Calle 45");
    expect(result).toContain("[DIRECCION]");
  });

  it("anonimiza carrera y transversal", () => {
    const texto = "Vive en Carrera 7 # 15-80, cerca de Transversal 5";
    const result = anonimizarTextoMedico(texto);
    expect(result).not.toContain("Carrera 7");
    expect(result).not.toContain("Transversal 5");
  });

  it("NO anonimiza códigos CUPS (6 dígitos médicos)", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).toContain("470101");
  });

  it("NO anonimiza códigos CIE-10", () => {
    const result = anonimizarTextoMedico(notaClinica, "Juan Pérez", "1023456789");
    expect(result).toContain("K35.0");
  });

  it("NO anonimiza códigos CUPS comunes de consulta", () => {
    const texto = "Se realizó 890201 Consulta medicina general y 890301 Consulta urgencias";
    const result = anonimizarTextoMedico(texto);
    expect(result).toContain("890201");
    expect(result).toContain("890301");
  });
});
