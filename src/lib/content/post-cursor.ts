import { InputValidationException } from "chanfana";
import { and, eq, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { post } from "@/db/schema/content";

const TRAILING_EQUALS = /=+$/;

const cursorPayloadSchema = z.object({
  createdAt: z.number(),
  id: z.string().min(1),
});

export type PostListCursor = z.infer<typeof cursorPayloadSchema>;

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

export function encodePostListCursor(c: PostListCursor): string {
  return utf8ToBase64Url(JSON.stringify({ createdAt: c.createdAt, id: c.id }));
}

export function decodePostListCursor(raw: string): PostListCursor {
  try {
    const json = base64UrlToUtf8(raw);
    return cursorPayloadSchema.parse(JSON.parse(json));
  } catch {
    throw new InputValidationException("Invalid cursor", ["query", "cursor"]);
  }
}

/** Next page for order `createdAt DESC, id DESC` (strictly older than cursor). */
export function cursorOlderThanPredicate(c: PostListCursor): SQL {
  const at = new Date(c.createdAt);
  return or(
    lt(post.createdAt, at),
    and(eq(post.createdAt, at), lt(post.id, c.id))
  ) as SQL;
}
