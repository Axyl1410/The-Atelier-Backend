import { and, eq, ne } from "drizzle-orm";
import type { PostReadModel } from "@/application/content/read-posts";
import { db } from "@/db/client";
import { post } from "@/db/schema/content";
import type { PostTagAccessRow } from "@/lib/content/post-tag-authorization";

export async function hasPostBySlug(slug: string): Promise<boolean> {
  const [taken] = await db
    .getDatabase()
    .select({ id: post.id })
    .from(post)
    .where(eq(post.slug, slug))
    .limit(1);
  return Boolean(taken);
}

export async function insertPost(args: {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  coverImage: string | null;
  isPublished: boolean;
  authorId: string;
}): Promise<void> {
  await db.getDatabase().insert(post).values(args);
}

export async function findPostAccessById(
  postId: string
): Promise<PostTagAccessRow | null> {
  const [row] = await db
    .getDatabase()
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

export async function hasOtherPostBySlug(
  slug: string,
  excludePostId: string
): Promise<boolean> {
  const [other] = await db
    .getDatabase()
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.slug, slug), ne(post.id, excludePostId)))
    .limit(1);
  return Boolean(other);
}

export async function updatePost(
  postId: string,
  patch: {
    title?: string;
    content?: string;
    slug?: string;
    summary?: string | null;
    coverImage?: string | null;
    isPublished?: boolean;
  }
): Promise<void> {
  await db.getDatabase().update(post).set(patch).where(eq(post.id, postId));
}

export async function deletePostById(postId: string): Promise<boolean> {
  const removed = await db
    .getDatabase()
    .delete(post)
    .where(eq(post.id, postId))
    .returning({ id: post.id });
  return removed.length > 0;
}

export async function findPostDetailById(
  postId: string
): Promise<PostReadModel | null> {
  const [row] = await db
    .getDatabase()
    .select()
    .from(post)
    .where(eq(post.id, postId))
    .limit(1);
  return row ?? null;
}
