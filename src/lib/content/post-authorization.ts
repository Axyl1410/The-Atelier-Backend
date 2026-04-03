import { NotFoundException } from "chanfana";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { post } from "@/db/schema/content";

export async function fetchPostById(database: AppDatabase, postId: string) {
  const [row] = await database
    .select()
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  return row ?? null;
}

/** Published: anyone. Draft: author only (else 404). */
export function ensureCanViewPostDetail(
  row: Awaited<ReturnType<typeof fetchPostById>>,
  user: { id: string } | null
) {
  if (!row) {
    throw new NotFoundException("Post not found");
  }
  if (row.isPublished) {
    return row;
  }
  if (user?.id === row.authorId) {
    return row;
  }
  throw new NotFoundException("Post not found");
}
