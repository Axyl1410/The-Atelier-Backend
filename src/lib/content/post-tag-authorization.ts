import { ApiException, NotFoundException } from "chanfana";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { post } from "@/db/schema/content";

export interface PostTagAccessRow {
  authorId: string;
  id: string;
  isPublished: boolean;
}

export async function fetchPostForTagAccess(
  database: AppDatabase,
  postId: string
): Promise<PostTagAccessRow | null> {
  const [row] = await database
    .select({
      id: post.id,
      authorId: post.authorId,
      isPublished: post.isPublished,
    })
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);

  return row ?? null;
}

export function ensurePostExists(
  row: PostTagAccessRow | null
): asserts row is PostTagAccessRow {
  if (!row) {
    throw new NotFoundException("Post not found");
  }
}

/** Draft posts: only the author may read tags (others get 404). */
export function ensureCanViewPostTags(
  row: PostTagAccessRow,
  user: { id: string } | null
): void {
  if (row.isPublished) {
    return;
  }
  if (user?.id === row.authorId) {
    return;
  }
  throw new NotFoundException("Post not found");
}

export function ensureAuthenticated(
  user: { id: string } | null
): asserts user is {
  id: string;
} {
  if (!user) {
    const err = new ApiException("Unauthorized");
    err.status = 401;
    err.code = 7010;
    throw err;
  }
}

export function ensurePostAuthor(
  row: PostTagAccessRow,
  user: { id: string }
): void {
  if (row.authorId !== user.id) {
    const err = new ApiException("Forbidden");
    err.status = 403;
    err.code = 7011;
    throw err;
  }
}
