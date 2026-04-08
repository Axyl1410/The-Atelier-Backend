import { and, desc, eq } from "drizzle-orm";
import type { PostReadModel } from "@/application/content/read-posts";
import { db } from "@/db/client";
import { post } from "@/db/schema/content";
import { cursorOlderThanPredicate } from "@/lib/content/post-cursor";

export function listPostsPage(args: {
  limitPlusOne: number;
  cursor?: { createdAt: number; id: string };
  viewerId?: string;
}): Promise<PostReadModel[]> {
  const database = db.getDatabase();
  const baseWhere =
    args.viewerId === undefined
      ? eq(post.isPublished, true)
      : eq(post.authorId, args.viewerId);
  const whereClause =
    args.cursor === undefined
      ? baseWhere
      : and(baseWhere, cursorOlderThanPredicate(args.cursor));

  return database
    .select()
    .from(post)
    .where(whereClause)
    .orderBy(desc(post.createdAt), desc(post.id))
    .limit(args.limitPlusOne);
}

export async function findPostBySlug(
  slug: string
): Promise<PostReadModel | null> {
  const [row] = await db
    .getDatabase()
    .select()
    .from(post)
    .where(eq(post.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function findPostById(
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
