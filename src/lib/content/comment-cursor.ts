import { and, eq, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { comment } from "@/db/schema/content";
import { decodeCursorPayload, encodeCursorPayload } from "./cursor-codec";

const cursorPayloadSchema = z.object({
  createdAt: z.number(),
  id: z.string().min(1),
});

export type CommentListCursor = z.infer<typeof cursorPayloadSchema>;

export function encodeCommentListCursor(c: CommentListCursor): string {
  return encodeCursorPayload(c);
}

export function decodeCommentListCursor(raw: string): CommentListCursor {
  return decodeCursorPayload(raw, cursorPayloadSchema);
}

/** Next page for order `createdAt DESC, id DESC` (strictly older than cursor). */
export function cursorOlderThanPredicate(c: CommentListCursor): SQL {
  const at = new Date(c.createdAt);
  return or(
    lt(comment.createdAt, at),
    and(eq(comment.createdAt, at), lt(comment.id, c.id))
  ) as SQL;
}
