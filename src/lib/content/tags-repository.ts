import { and, asc, eq, ne, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { tag } from "@/db/schema/content";

export function listTags(filter?: SQL<unknown>) {
  const q = db
    .getDatabase()
    .select({ id: tag.id, name: tag.name, slug: tag.slug })
    .from(tag);
  return (filter ? q.where(filter) : q).orderBy(asc(tag.name));
}

export async function findTagById(tagId: string) {
  const [row] = await db
    .getDatabase()
    .select({ id: tag.id, name: tag.name, slug: tag.slug })
    .from(tag)
    .where(eq(tag.id, tagId))
    .limit(1);
  return row ?? null;
}

export async function hasTagName(name: string, excludeId?: string) {
  const where =
    excludeId === undefined
      ? eq(tag.name, name)
      : and(eq(tag.name, name), ne(tag.id, excludeId));
  const [row] = await db
    .getDatabase()
    .select({ id: tag.id })
    .from(tag)
    .where(where)
    .limit(1);
  return Boolean(row);
}

export async function hasTagSlug(slug: string, excludeId?: string) {
  const where =
    excludeId === undefined
      ? eq(tag.slug, slug)
      : and(eq(tag.slug, slug), ne(tag.id, excludeId));
  const [row] = await db
    .getDatabase()
    .select({ id: tag.id })
    .from(tag)
    .where(where)
    .limit(1);
  return Boolean(row);
}

export async function createTag(row: {
  id: string;
  name: string;
  slug: string;
}) {
  await db.getDatabase().insert(tag).values(row);
}

export async function updateTag(
  tagId: string,
  patch: { name?: string; slug?: string }
) {
  await db.getDatabase().update(tag).set(patch).where(eq(tag.id, tagId));
}

export async function deleteTag(tagId: string) {
  const removed = await db
    .getDatabase()
    .delete(tag)
    .where(eq(tag.id, tagId))
    .returning({ id: tag.id });
  return removed.length > 0;
}
