import { NotFoundException } from "chanfana";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { CommentReadModel } from "@/application/content/comments";
import { db } from "@/db/client";
import { comment } from "@/db/schema/content";
import {
  ensurePostIsPublished,
  fetchPublishedPostById,
} from "@/lib/content/comment-authorization";
import { cursorOlderThanPredicate } from "@/lib/content/comment-cursor";

export async function ensurePublishedPostExists(postId: string): Promise<void> {
  const row = await fetchPublishedPostById(db.getDatabase(), postId);
  ensurePostIsPublished(row);
}

export async function ensureParentCommentExists(
  postId: string,
  parentId: string
): Promise<void> {
  const [parent] = await db
    .getDatabase()
    .select({ id: comment.id })
    .from(comment)
    .where(and(eq(comment.id, parentId), eq(comment.postId, postId)))
    .limit(1);
  if (!parent) {
    throw new NotFoundException("Comment not found");
  }
}

export function listCommentsPage(args: {
  postId: string;
  parentId?: string;
  limitPlusOne: number;
  cursor?: { createdAt: number; id: string };
}): Promise<CommentReadModel[]> {
  const baseWhere =
    args.parentId === undefined
      ? and(eq(comment.postId, args.postId), isNull(comment.parentId))
      : and(
          eq(comment.postId, args.postId),
          eq(comment.parentId, args.parentId)
        );
  const whereClause =
    args.cursor === undefined
      ? baseWhere
      : and(baseWhere, cursorOlderThanPredicate(args.cursor));

  return db
    .getDatabase()
    .select()
    .from(comment)
    .where(whereClause)
    .orderBy(desc(comment.createdAt), desc(comment.id))
    .limit(args.limitPlusOne);
}

export async function insertComment(args: {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  parentId: string | null;
}): Promise<void> {
  await db.getDatabase().insert(comment).values(args);
}

export async function findCommentById(
  commentId: string
): Promise<CommentReadModel | null> {
  const [row] = await db
    .getDatabase()
    .select()
    .from(comment)
    .where(eq(comment.id, commentId))
    .limit(1);
  return row ?? null;
}

export async function findCommentAccessById(commentId: string): Promise<{
  id: string;
  authorId: string;
  postId: string;
} | null> {
  const [row] = await db
    .getDatabase()
    .select({
      id: comment.id,
      authorId: comment.authorId,
      postId: comment.postId,
    })
    .from(comment)
    .where(eq(comment.id, commentId))
    .limit(1);
  return row ?? null;
}

export async function updateCommentContent(
  commentId: string,
  content: string
): Promise<void> {
  await db
    .getDatabase()
    .update(comment)
    .set({ content })
    .where(eq(comment.id, commentId));
}

export async function deleteCommentById(commentId: string): Promise<boolean> {
  const removed = await db
    .getDatabase()
    .delete(comment)
    .where(eq(comment.id, commentId))
    .returning({ id: comment.id });
  return removed.length > 0;
}
