import { eq, like, or } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { post, tag } from "@/db/schema/content";

/** URL-safe slug from arbitrary text (fallback `"tag"` if empty). */
export function slugify(input: string): string {
  const s = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "tag";
}

/**
 * Reserves a unique `tag.slug`: tries `slugify(base)`, then `base-2`, `base-3`, …
 */
export async function allocateUniqueTagSlug(
  database: AppDatabase,
  base: string
): Promise<string> {
  const root = slugify(base);
  const prefix = root.length > 0 ? root : "tag";

  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? prefix : `${prefix}-${i + 1}`;
    const [existing] = await database
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.slug, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique tag slug");
}

/**
 * Reserves a unique `post.slug`: tries `slugify(base)`, then `base-2`, `base-3`, …
 */
export async function allocateUniquePostSlug(
  database: AppDatabase,
  base: string
): Promise<string> {
  const root = slugify(base);
  const prefix = root.length > 0 ? root : "post";

  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? prefix : `${prefix}-${i + 1}`;
    const [existing] = await database
      .select({ id: post.id })
      .from(post)
      .where(eq(post.slug, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique post slug");
}

const TAG_SEARCH_ESCAPE = /[%_\\]/g;

/** Build safe SQLite LIKE pattern; strips chars that break LIKE. */
export function tagSearchPattern(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const safe = trimmed.replace(TAG_SEARCH_ESCAPE, "");
  if (!safe) {
    return null;
  }
  return `%${safe}%`;
}

/** WHERE clause helper: match name OR slug (substring, case-sensitive LIKE on stored values). */
export function tagNameOrSlugLike(term: string) {
  const pattern = tagSearchPattern(term);
  if (!pattern) {
    return undefined;
  }
  return or(like(tag.name, pattern), like(tag.slug, pattern));
}
