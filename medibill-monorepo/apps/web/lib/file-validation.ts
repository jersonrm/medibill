/**
 * Validación de archivos por magic bytes (firma binaria).
 * Previene spoofeo de Content-Type del lado del cliente.
 */

const SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: [0x50, 0x4b, 0x03, 0x04] }, // XLSX (ZIP)
  { mime: "application/vnd.ms-excel", bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // XLS (OLE2)
];

/**
 * Detecta el MIME type real de un archivo leyendo sus primeros bytes.
 * Retorna el MIME type detectado o null si no coincide con ningún formato conocido.
 */
export function detectMimeFromBytes(buffer: ArrayBuffer): string | null {
  const header = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));

  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => header[i] === b)) {
      return sig.mime;
    }
  }

  return null;
}

/**
 * Valida que el contenido real del archivo corresponda a uno de los MIME types permitidos.
 * @param buffer - ArrayBuffer del contenido del archivo
 * @param allowedMimes - Lista de MIME types permitidos
 * @returns El MIME type detectado si es válido, o null si no lo es
 */
export function validateFileMagicBytes(
  buffer: ArrayBuffer,
  allowedMimes: string[],
): string | null {
  const detected = detectMimeFromBytes(buffer);
  if (!detected) return null;

  // XLSX y ZIP comparten la firma PK - aceptar ZIP como XLSX si XLSX está permitido
  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (detected === xlsxMime && allowedMimes.includes(xlsxMime)) {
    return detected;
  }

  return allowedMimes.includes(detected) ? detected : null;
}
