/**
 * Utilidad de encriptación AES-256-GCM para credenciales MUV.
 * Usa MUV_ENCRYPTION_KEY (64 hex chars = 32 bytes) del entorno.
 *
 * Formato almacenado: "iv_hex:authTag_hex:ciphertext_hex"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.MUV_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "MUV_ENCRYPTION_KEY no configurada o inválida. Debe ser 64 caracteres hex (32 bytes)."
    );
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Formato de payload encriptado inválido");
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex!, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
