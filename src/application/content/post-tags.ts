import { InputValidationException, NotFoundException } from "chanfana";
import {
  ensureCanViewPostTags,
  ensurePostAuthor,
  ensurePostExists,
  type PostTagAccessRow,
} from "@/lib/content/post-tag-authorization";

export interface TagDto {
  id: string;
  name: string;
  slug: string;
}

export interface PostTagActor {
  id: string;
}

export interface PostTagsReadDeps {
  findPostForAccess: (postId: string) => Promise<PostTagAccessRow | null>;
  listTagsForPost: (postId: string) => Promise<TagDto[]>;
}

export interface AddPostTagDeps extends PostTagsReadDeps {
  findTagById: (tagId: string) => Promise<{ id: string } | null>;
  hasPostTagLink: (postId: string, tagId: string) => Promise<boolean>;
  insertPostTagLink: (postId: string, tagId: string) => Promise<void>;
}

export interface DeletePostTagDeps extends PostTagsReadDeps {
  deletePostTagLink: (postId: string, tagId: string) => Promise<boolean>;
}

export interface SyncPostTagsDeps extends PostTagsReadDeps {
  countExistingTags: (tagIds: string[]) => Promise<number>;
  syncPostTags: (postId: string, desiredTagIds: string[]) => Promise<void>;
}

export async function getPostTagsUseCase(
  postId: string,
  actor: PostTagActor | null,
  deps: PostTagsReadDeps
) {
  const row = await deps.findPostForAccess(postId);
  ensurePostExists(row);
  ensureCanViewPostTags(row, actor);
  const tags = await deps.listTagsForPost(postId);
  return { success: true as const, tags };
}

export async function addPostTagUseCase(
  postId: string,
  tagId: string,
  actor: PostTagActor,
  deps: AddPostTagDeps
) {
  const row = await deps.findPostForAccess(postId);
  ensurePostExists(row);
  ensurePostAuthor(row, actor);

  const tag = await deps.findTagById(tagId);
  if (!tag) {
    throw new NotFoundException("Tag not found");
  }

  const existing = await deps.hasPostTagLink(postId, tagId);
  if (existing) {
    return { status: 200 as const, body: { success: true as const } };
  }

  await deps.insertPostTagLink(postId, tagId);
  return { status: 201 as const, body: { success: true as const } };
}

export async function deletePostTagUseCase(
  postId: string,
  tagId: string,
  actor: PostTagActor,
  deps: DeletePostTagDeps
) {
  const row = await deps.findPostForAccess(postId);
  ensurePostExists(row);
  ensurePostAuthor(row, actor);

  const removed = await deps.deletePostTagLink(postId, tagId);
  if (!removed) {
    throw new NotFoundException("Post tag link not found");
  }
  return { success: true as const };
}

export async function syncPostTagsUseCase(
  postId: string,
  tagIds: string[],
  actor: PostTagActor,
  deps: SyncPostTagsDeps
) {
  const row = await deps.findPostForAccess(postId);
  ensurePostExists(row);
  ensurePostAuthor(row, actor);

  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length > 0) {
    const foundCount = await deps.countExistingTags(uniqueIds);
    if (foundCount !== uniqueIds.length) {
      throw new InputValidationException("One or more tags do not exist.", [
        "body",
        "tagIds",
      ]);
    }
  }

  await deps.syncPostTags(postId, uniqueIds);
  const tags = await deps.listTagsForPost(postId);
  return { success: true as const, tags };
}
