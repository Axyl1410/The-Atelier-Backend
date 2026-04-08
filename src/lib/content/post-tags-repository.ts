import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { postTag, tag } from "@/db/schema/content";
import {
  fetchPostForTagAccess,
  type PostTagAccessRow,
} from "@/lib/content/post-tag-authorization";

export function findPostForAccess(
  postId: string
): Promise<PostTagAccessRow | null> {
  return fetchPostForTagAccess(db.getDatabase(), postId);
}

export function listTagsForPost(postId: string) {
  return db
    .getDatabase()
    .select({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })
    .from(postTag)
    .innerJoin(tag, eq(postTag.tagId, tag.id))
    .where(eq(postTag.postId, postId));
}

export async function findTagById(
  tagId: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .getDatabase()
    .select({ id: tag.id })
    .from(tag)
    .where(eq(tag.id, tagId))
    .limit(1);
  return row ?? null;
}

export async function hasPostTagLink(
  postId: string,
  tagId: string
): Promise<boolean> {
  const [row] = await db
    .getDatabase()
    .select({ postId: postTag.postId })
    .from(postTag)
    .where(and(eq(postTag.postId, postId), eq(postTag.tagId, tagId)))
    .limit(1);
  return Boolean(row);
}

export async function insertPostTagLink(
  postId: string,
  tagId: string
): Promise<void> {
  await db.getDatabase().insert(postTag).values({ postId, tagId });
}

export async function deletePostTagLink(
  postId: string,
  tagId: string
): Promise<boolean> {
  const removed = await db
    .getDatabase()
    .delete(postTag)
    .where(and(eq(postTag.postId, postId), eq(postTag.tagId, tagId)))
    .returning({ postId: postTag.postId });
  return removed.length > 0;
}

export async function countExistingTags(tagIds: string[]): Promise<number> {
  const rows = await db
    .getDatabase()
    .select({ id: tag.id })
    .from(tag)
    .where(inArray(tag.id, tagIds));
  return rows.length;
}

export async function syncPostTags(
  postId: string,
  desiredTagIds: string[]
): Promise<void> {
  await db.getDatabase().transaction(async (tx) => {
    const current = await tx
      .select({ tagId: postTag.tagId })
      .from(postTag)
      .where(eq(postTag.postId, postId));

    const currentSet = new Set(current.map((r) => r.tagId));
    const desiredSet = new Set(desiredTagIds);
    const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));
    const toAdd = [...desiredSet].filter((id) => !currentSet.has(id));

    if (toRemove.length > 0) {
      await tx
        .delete(postTag)
        .where(
          and(eq(postTag.postId, postId), inArray(postTag.tagId, toRemove))
        );
    }

    if (toAdd.length > 0) {
      await tx.insert(postTag).values(
        toAdd.map((tagId) => ({
          postId,
          tagId,
        }))
      );
    }
  });
}
