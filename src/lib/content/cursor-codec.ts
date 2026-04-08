import { InputValidationException } from "chanfana";
import type { z } from "zod";

const TRAILING_EQUALS = /=+$/;

function utf8ToBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(TRAILING_EQUALS, "");
}

function base64UrlToUtf8(encoded: string): string {
  let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) {
    b64 += "=";
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeCursorPayload<T extends { createdAt: number; id: string }>(
  payload: T
): string {
  return utf8ToBase64Url(
    JSON.stringify({ createdAt: payload.createdAt, id: payload.id })
  );
}

export function decodeCursorPayload<T>(
  raw: string,
  schema: z.ZodType<T>
): T {
  try {
    const json = base64UrlToUtf8(raw);
    return schema.parse(JSON.parse(json));
  } catch {
    throw new InputValidationException("Invalid cursor", ["query", "cursor"]);
  }
}

