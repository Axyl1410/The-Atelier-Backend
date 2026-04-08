import { ApiException, NotFoundException } from "chanfana";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { post } from "@/db/schema/content";

export async function fetchPublishedPostById(
  database: AppDatabase,
  postId: string
) {
  const [row] = await database
    .select({ id: post.id, isPublished: post.isPublished })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  return row ?? null;
}

/** Comments are only available for published posts; otherwise behave like 404. */
export function ensurePostIsPublished(
  row: Awaited<ReturnType<typeof fetchPublishedPostById>>
) {
  if (!row?.isPublished) {
    throw new NotFoundException("Post not found");
  }
}

export function ensureCommentAuthor(
  row: { authorId: string },
  user: { id: string }
): void {
  if (row.authorId !== user.id) {
    const err = new ApiException("Forbidden");
    err.status = 403;
    err.code = 7011;
    throw err;
  }
}
