import { ApiException, NotFoundException } from "chanfana";
import type { SQL } from "drizzle-orm";
import { ensureAdmin } from "@/lib/content/tag-authorization";

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
}

export interface AdminActor {
  id: string;
  role?: string | null;
}

export interface TagRepoDeps {
  allocateUniqueSlugFromName: WriteTagDeps["allocateUniqueSlugFromName"];
  createTag: WriteTagDeps["createTag"];
  deleteTag: DeleteTagDeps["deleteTag"];
  findTagById: TagByIdDeps["findTagById"];
  generateTagId: WriteTagDeps["generateTagId"];
  hasTagName: WriteTagDeps["hasTagName"];
  hasTagSlug: WriteTagDeps["hasTagSlug"];
  listTags: ListTagsDeps["listTags"];
  slugify: WriteTagDeps["slugify"];
  tagNameOrSlugLike: ListTagsDeps["tagNameOrSlugLike"];
  updateTag: WriteTagDeps["updateTag"];
}

interface ListTagsDeps {
  listTags: (filter?: SQL<unknown>) => Promise<TagRecord[]>;
  tagNameOrSlugLike: (q: string) => SQL<unknown> | undefined;
}

interface TagByIdDeps {
  findTagById: (tagId: string) => Promise<TagRecord | null>;
}

interface WriteTagDeps extends TagByIdDeps {
  allocateUniqueSlugFromName: (name: string) => Promise<string>;
  createTag: (row: TagRecord) => Promise<void>;
  generateTagId: () => string;
  hasTagName: (name: string, excludeId?: string) => Promise<boolean>;
  hasTagSlug: (slug: string, excludeId?: string) => Promise<boolean>;
  slugify: (input: string) => string;
  updateTag: (
    tagId: string,
    patch: { name?: string; slug?: string }
  ) => Promise<void>;
}

interface DeleteTagDeps {
  deleteTag: (tagId: string) => Promise<boolean>;
}

function throwConflict(message: string): never {
  const err = new ApiException(message);
  err.status = 409;
  err.code = 7013;
  throw err;
}

export async function listTagsUseCase(
  q: string | undefined,
  deps: ListTagsDeps
) {
  const filter = q === undefined ? undefined : deps.tagNameOrSlugLike(q);
  const tags = await deps.listTags(filter);
  return { success: true as const, tags };
}

export async function getTagUseCase(tagId: string, deps: TagByIdDeps) {
  const tag = await deps.findTagById(tagId);
  if (!tag) {
    throw new NotFoundException("Tag not found");
  }
  return { success: true as const, tag };
}

export async function createTagUseCase(
  input: { name: string; slug?: string },
  actor: AdminActor | null,
  deps: WriteTagDeps
) {
  ensureAdmin(actor);
  const name = input.name.trim();
  if (await deps.hasTagName(name)) {
    throwConflict("Tag name already taken");
  }
  const finalSlug =
    input.slug === undefined
      ? await deps.allocateUniqueSlugFromName(name)
      : deps.slugify(input.slug);
  if (input.slug !== undefined && (await deps.hasTagSlug(finalSlug))) {
    throwConflict("Tag slug already taken");
  }
  const tag: TagRecord = { id: deps.generateTagId(), name, slug: finalSlug };
  await deps.createTag(tag);
  return { status: 201 as const, body: { success: true as const, tag } };
}

export async function updateTagUseCase(
  tagId: string,
  input: { name?: string; slug?: string },
  actor: AdminActor | null,
  deps: WriteTagDeps
) {
  ensureAdmin(actor);
  const current = await deps.findTagById(tagId);
  if (!current) {
    throw new NotFoundException("Tag not found");
  }
  const newName = input.name === undefined ? undefined : input.name.trim();
  if (newName !== undefined && (await deps.hasTagName(newName, tagId))) {
    throwConflict("Tag name already taken");
  }
  const nextSlug =
    input.slug === undefined ? undefined : deps.slugify(input.slug);
  if (nextSlug !== undefined && (await deps.hasTagSlug(nextSlug, tagId))) {
    throwConflict("Tag slug already taken");
  }
  await deps.updateTag(tagId, { name: newName, slug: nextSlug });
  const updated = await deps.findTagById(tagId);
  if (!updated) {
    throw new NotFoundException("Tag not found");
  }
  return { success: true as const, tag: updated };
}

export async function deleteTagUseCase(
  tagId: string,
  actor: AdminActor | null,
  deps: DeleteTagDeps
) {
  ensureAdmin(actor);
  const removed = await deps.deleteTag(tagId);
  if (!removed) {
    throw new NotFoundException("Tag not found");
  }
  return { success: true as const };
}
