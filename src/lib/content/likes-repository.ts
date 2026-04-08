import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { postLike } from "@/db/schema/social";
import { fetchPostById } from "@/lib/content/post-authorization";

export function findPostById(postId: string) {
  return fetchPostById(db.getDatabase(), postId);
}

export async function hasLike(
  userId: string,
  postId: string
): Promise<boolean> {
  const [row] = await db
    .getDatabase()
    .select({ postId: postLike.postId })
    .from(postLike)
    .where(and(eq(postLike.userId, userId), eq(postLike.postId, postId)))
    .limit(1);
  return Boolean(row);
}

export async function insertLike(
  userId: string,
  postId: string
): Promise<void> {
  await db.getDatabase().insert(postLike).values({ userId, postId });
}

export async function deleteLike(
  userId: string,
  postId: string
): Promise<void> {
  await db
    .getDatabase()
    .delete(postLike)
    .where(and(eq(postLike.userId, userId), eq(postLike.postId, postId)));
}
