import { NotFoundException } from "chanfana";
import { ensureCommentAuthor } from "@/lib/content/comment-authorization";
import {
  decodeCommentListCursor,
  encodeCommentListCursor,
} from "@/lib/content/comment-cursor";

export interface CommentReadModel {
  authorId: string;
  content: string;
  createdAt: Date;
  id: string;
  parentId: string | null;
  postId: string;
  updatedAt: Date;
}

export interface CommentActor {
  id: string;
}

export interface ListPostCommentsInput {
  cursor?: string;
  limit?: number;
  parentId?: string;
  postId: string;
}

export interface ListPostCommentsDeps {
  ensureParentCommentExists: (
    postId: string,
    parentId: string
  ) => Promise<void>;
  ensurePublishedPostExists: (postId: string) => Promise<void>;
  listCommentsPage: (args: {
    postId: string;
    parentId?: string;
    limitPlusOne: number;
    cursor?: { createdAt: number; id: string };
  }) => Promise<CommentReadModel[]>;
}

export interface CreatePostCommentInput {
  content: string;
  parentId?: string;
  postId: string;
}

export interface CreatePostCommentDeps {
  ensureParentCommentExists: (
    postId: string,
    parentId: string
  ) => Promise<void>;
  ensurePublishedPostExists: (postId: string) => Promise<void>;
  findCommentById: (commentId: string) => Promise<CommentReadModel | null>;
  generateCommentId: () => string;
  insertComment: (args: {
    id: string;
    content: string;
    postId: string;
    authorId: string;
    parentId: string | null;
  }) => Promise<void>;
}

export interface UpdateCommentDeps {
  ensurePublishedPostExists: (postId: string) => Promise<void>;
  findCommentAccessById: (
    commentId: string
  ) => Promise<{ id: string; authorId: string; postId: string } | null>;
  findCommentById: (commentId: string) => Promise<CommentReadModel | null>;
  updateCommentContent: (commentId: string, content: string) => Promise<void>;
}

export interface DeleteCommentDeps {
  deleteCommentById: (commentId: string) => Promise<boolean>;
  ensurePublishedPostExists: (postId: string) => Promise<void>;
  findCommentAccessById: (
    commentId: string
  ) => Promise<{ id: string; authorId: string; postId: string } | null>;
}

function mapComment(row: CommentReadModel) {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listPostCommentsUseCase(
  input: ListPostCommentsInput,
  deps: ListPostCommentsDeps
) {
  await deps.ensurePublishedPostExists(input.postId);
  if (input.parentId !== undefined) {
    await deps.ensureParentCommentExists(input.postId, input.parentId);
  }

  const limit = input.limit ?? 20;
  const cursor =
    input.cursor === undefined || input.cursor === ""
      ? undefined
      : decodeCommentListCursor(input.cursor);

  const rows = await deps.listCommentsPage({
    postId: input.postId,
    parentId: input.parentId,
    limitPlusOne: limit + 1,
    cursor,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCommentListCursor({
          createdAt: last.createdAt.getTime(),
          id: last.id,
        })
      : null;

  return {
    success: true as const,
    comments: page.map(mapComment),
    nextCursor,
    hasMore,
  };
}

export async function createPostCommentUseCase(
  input: CreatePostCommentInput,
  actor: CommentActor,
  deps: CreatePostCommentDeps
) {
  await deps.ensurePublishedPostExists(input.postId);
  if (input.parentId !== undefined) {
    await deps.ensureParentCommentExists(input.postId, input.parentId);
  }

  const id = deps.generateCommentId();
  await deps.insertComment({
    id,
    content: input.content,
    postId: input.postId,
    authorId: actor.id,
    parentId: input.parentId ?? null,
  });

  const created = await deps.findCommentById(id);
  if (!created) {
    throw new NotFoundException("Comment not found");
  }

  return { success: true as const, comment: mapComment(created) };
}

export async function updateCommentUseCase(
  commentId: string,
  content: string,
  actor: CommentActor,
  deps: UpdateCommentDeps
) {
  const row = await deps.findCommentAccessById(commentId);
  if (!row) {
    throw new NotFoundException("Comment not found");
  }
  await deps.ensurePublishedPostExists(row.postId);
  ensureCommentAuthor(row, actor);

  await deps.updateCommentContent(commentId, content);
  const updated = await deps.findCommentById(commentId);
  if (!updated) {
    throw new NotFoundException("Comment not found");
  }

  return { success: true as const, comment: mapComment(updated) };
}

export async function deleteCommentUseCase(
  commentId: string,
  actor: CommentActor,
  deps: DeleteCommentDeps
) {
  const row = await deps.findCommentAccessById(commentId);
  if (!row) {
    throw new NotFoundException("Comment not found");
  }
  await deps.ensurePublishedPostExists(row.postId);
  ensureCommentAuthor(row, actor);

  const removed = await deps.deleteCommentById(commentId);
  if (!removed) {
    throw new NotFoundException("Comment not found");
  }

  return { success: true as const };
}
