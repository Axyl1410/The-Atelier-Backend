import { NotFoundException } from "chanfana";
import {
  ensurePostAuthor,
  type PostTagAccessRow,
} from "@/lib/content/post-tag-authorization";
import type { PostReadModel } from "./read-posts";

export interface PostWriter {
  id: string;
}

export interface CreatePostInput {
  content: string;
  coverImage?: string;
  isPublished?: boolean;
  slug?: string;
  summary?: string;
  title: string;
}

export interface UpdatePostInput {
  content?: string;
  coverImage?: string | null;
  isPublished?: boolean;
  postId: string;
  slug?: string;
  summary?: string | null;
  title?: string;
}

export interface CreatePostDeps {
  allocateUniqueSlugFromTitle: (title: string) => Promise<string>;
  findPostById: (postId: string) => Promise<PostReadModel | null>;
  generatePostId: () => string;
  hasPostBySlug: (slug: string) => Promise<boolean>;
  insertPost(args: {
    id: string;
    slug: string;
    title: string;
    content: string;
    summary: string | null;
    coverImage: string | null;
    isPublished: boolean;
    authorId: string;
  }): Promise<void>;
  isUniqueSlugError: (error: unknown) => boolean;
  throwConflict: (message: string) => never;
  toSlug: (input: string) => string;
}

export interface UpdatePostDeps {
  findPostAccessById: (postId: string) => Promise<PostTagAccessRow | null>;
  findPostById: (postId: string) => Promise<PostReadModel | null>;
  hasOtherPostBySlug: (slug: string, excludePostId: string) => Promise<boolean>;
  isUniqueSlugError: (error: unknown) => boolean;
  throwConflict: (message: string) => never;
  toSlug: (input: string) => string;
  updatePost: (postId: string, patch: UpdatePostPatch) => Promise<void>;
}

export interface DeletePostDeps {
  deletePostById: (postId: string) => Promise<boolean>;
  findPostAccessById: (postId: string) => Promise<PostTagAccessRow | null>;
}

interface UpdatePostPatch {
  content?: string;
  coverImage?: string | null;
  isPublished?: boolean;
  slug?: string;
  summary?: string | null;
  title?: string;
}

function mapListRow(row: PostReadModel) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverImage: row.coverImage,
    isPublished: row.isPublished,
    authorId: row.authorId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function mapDetailRow(row: PostReadModel) {
  return {
    ...mapListRow(row),
    content: row.content,
  };
}

export async function createPostUseCase(
  input: CreatePostInput,
  writer: PostWriter,
  deps: CreatePostDeps
) {
  const finalSlug =
    input.slug === undefined
      ? await deps.allocateUniqueSlugFromTitle(input.title)
      : deps.toSlug(input.slug);

  if (input.slug !== undefined) {
    const taken = await deps.hasPostBySlug(finalSlug);
    if (taken) {
      deps.throwConflict("Post slug already taken");
    }
  }

  const id = deps.generatePostId();
  try {
    await deps.insertPost({
      id,
      slug: finalSlug,
      title: input.title,
      content: input.content,
      summary: input.summary ?? null,
      coverImage: input.coverImage ?? null,
      isPublished: input.isPublished ?? false,
      authorId: writer.id,
    });
  } catch (error) {
    if (deps.isUniqueSlugError(error)) {
      deps.throwConflict("Post slug already taken");
    }
    throw error;
  }

  const created = await deps.findPostById(id);
  if (!created) {
    throw new NotFoundException("Post not found");
  }

  return {
    success: true as const,
    post: mapDetailRow(created),
  };
}

export async function updatePostUseCase(
  input: UpdatePostInput,
  writer: PostWriter,
  deps: UpdatePostDeps
) {
  const existing = await deps.findPostAccessById(input.postId);
  if (!existing) {
    throw new NotFoundException("Post not found");
  }
  ensurePostAuthor(existing, writer);

  const patch: UpdatePostPatch = {};
  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.content !== undefined) {
    patch.content = input.content;
  }
  if (input.summary !== undefined) {
    patch.summary = input.summary;
  }
  if (input.coverImage !== undefined) {
    patch.coverImage = input.coverImage;
  }
  if (input.isPublished !== undefined) {
    patch.isPublished = input.isPublished;
  }

  if (input.slug !== undefined) {
    const nextSlug = deps.toSlug(input.slug);
    const other = await deps.hasOtherPostBySlug(nextSlug, input.postId);
    if (other) {
      deps.throwConflict("Post slug already taken");
    }
    patch.slug = nextSlug;
  }

  if (Object.keys(patch).length > 0) {
    try {
      await deps.updatePost(input.postId, patch);
    } catch (error) {
      if (deps.isUniqueSlugError(error)) {
        deps.throwConflict("Post slug already taken");
      }
      throw error;
    }
  }

  const updated = await deps.findPostById(input.postId);
  if (!updated) {
    throw new NotFoundException("Post not found");
  }

  return {
    success: true as const,
    post: mapDetailRow(updated),
  };
}

export async function deletePostUseCase(
  postId: string,
  writer: PostWriter,
  deps: DeletePostDeps
) {
  const existing = await deps.findPostAccessById(postId);
  if (!existing) {
    throw new NotFoundException("Post not found");
  }
  ensurePostAuthor(existing, writer);

  const removed = await deps.deletePostById(postId);
  if (!removed) {
    throw new NotFoundException("Post not found");
  }

  return { success: true as const };
}
