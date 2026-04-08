import {
  contentJson,
  NotFoundException,
  OpenAPIRoute,
} from "chanfana";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { comment } from "@/db/schema/content";
import {
  ensureCommentAuthor,
  ensurePostIsPublished,
  fetchPublishedPostById,
} from "@/lib/content/comment-authorization";
import {
  cursorOlderThanPredicate,
  decodeCommentListCursor,
  encodeCommentListCursor,
} from "@/lib/content/comment-cursor";
import { ensureAuthenticated } from "@/lib/content/post-tag-authorization";
import type { AppContext } from "@/types";

const commentDto = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const commentListResponse = contentJson(
  z.object({
    success: z.literal(true),
    comments: z.array(commentDto),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
);

const commentOneResponse = contentJson(
  z.object({
    success: z.literal(true),
    comment: commentDto,
  })
);
const messageErrorResponse = contentJson(z.object({ message: z.string() }));

function mapRow(row: typeof comment.$inferSelect) {
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

async function ensureParentCommentExists(
  database: ReturnType<typeof db.getDatabase>,
  postId: string,
  parentId: string
) {
  const [parent] = await database
    .select({ id: comment.id })
    .from(comment)
    .where(and(eq(comment.id, parentId), eq(comment.postId, postId)))
    .limit(1);
  if (!parent) {
    throw new NotFoundException("Comment not found");
  }
}

export class ListPostCommentsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Comments"],
    summary: "List comments for a post (flat list)",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(50).optional(),
        cursor: z.string().optional(),
        parentId: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "Page of comments",
        ...commentListResponse,
      },
      "400": {
        description: "Invalid query parameters",
        ...messageErrorResponse,
      },
      "404": {
        description: "Post or parent comment not found",
        ...messageErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    // Touch context to avoid unused param lint and keep access to session variables consistent.
    c.get("user");
    const data = await this.getValidatedData<typeof this.schema>();
    const { postId } = data.params;
    const limit = data.query?.limit ?? 20;
    const parentId = data.query?.parentId;
    const database = db.getDatabase();

    const postRow = await fetchPublishedPostById(database, postId);
    ensurePostIsPublished(postRow);

    if (parentId !== undefined) {
      await ensureParentCommentExists(database, postId, parentId);
    }

    const baseWhere =
      parentId === undefined
        ? and(eq(comment.postId, postId), isNull(comment.parentId))
        : and(eq(comment.postId, postId), eq(comment.parentId, parentId));

    const cursorRaw = data.query?.cursor;
    const cursorPred =
      cursorRaw === undefined || cursorRaw === ""
        ? undefined
        : cursorOlderThanPredicate(decodeCommentListCursor(cursorRaw));

    const whereClause =
      cursorPred === undefined ? baseWhere : and(baseWhere, cursorPred);

    const rows = await database
      .select()
      .from(comment)
      .where(whereClause)
      .orderBy(desc(comment.createdAt), desc(comment.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page.at(-1);
      if (!last) {
        throw new Error("Unexpected empty page while hasMore=true");
      }
      nextCursor = encodeCommentListCursor({
        createdAt: last.createdAt.getTime(),
        id: last.id,
      });
    }

    return {
      success: true as const,
      comments: page.map(mapRow),
      nextCursor,
      hasMore,
    };
  }
}

export class CreatePostCommentEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Comments"],
    summary: "Create a comment on a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
      body: contentJson(
        z.object({
          content: z.string().min(1),
          parentId: z.string().min(1).optional(),
        })
      ),
    },
    responses: {
      "201": {
        description: "Comment created",
        ...commentOneResponse,
      },
      "401": {
        description: "Not authenticated",
        ...messageErrorResponse,
      },
      "404": {
        description: "Post or parent comment not found",
        ...messageErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const { postId } = data.params;
    const database = db.getDatabase();

    const postRow = await fetchPublishedPostById(database, postId);
    ensurePostIsPublished(postRow);

    const parentId = data.body.parentId;
    if (parentId !== undefined) {
      await ensureParentCommentExists(database, postId, parentId);
    }

    const id = crypto.randomUUID();
    await database.insert(comment).values({
      id,
      content: data.body.content,
      postId,
      authorId: user.id,
      parentId: parentId ?? null,
    });

    const [created] = await database
      .select()
      .from(comment)
      .where(eq(comment.id, id))
      .limit(1);

    if (!created) {
      throw new NotFoundException("Comment not found");
    }

    return Response.json(
      { success: true as const, comment: mapRow(created) },
      { status: 201 }
    );
  }
}

export class UpdateCommentEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Comments"],
    summary: "Update a comment (author only)",
    request: {
      params: z.object({
        commentId: z.string().min(1),
      }),
      body: contentJson(
        z.object({
          content: z.string().min(1),
        })
      ),
    },
    responses: {
      "200": {
        description: "Comment updated",
        ...commentOneResponse,
      },
      "401": {
        description: "Not authenticated",
        ...messageErrorResponse,
      },
      "403": {
        description: "Not the author",
        ...messageErrorResponse,
      },
      "404": {
        description: "Post or comment not found",
        ...messageErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const { commentId } = data.params;
    const database = db.getDatabase();

    const [row] = await database
      .select({
        id: comment.id,
        authorId: comment.authorId,
        postId: comment.postId,
      })
      .from(comment)
      .where(eq(comment.id, commentId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Comment not found");
    }

    const postRow = await fetchPublishedPostById(database, row.postId);
    ensurePostIsPublished(postRow);
    ensureCommentAuthor(row, user);

    await database
      .update(comment)
      .set({ content: data.body.content })
      .where(eq(comment.id, commentId));

    const [updated] = await database
      .select()
      .from(comment)
      .where(eq(comment.id, commentId))
      .limit(1);

    if (!updated) {
      throw new NotFoundException("Comment not found");
    }

    return { success: true as const, comment: mapRow(updated) };
  }
}

export class DeleteCommentEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Comments"],
    summary: "Delete a comment (author only)",
    request: {
      params: z.object({
        commentId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Comment deleted",
        ...contentJson(z.object({ success: z.literal(true) })),
      },
      "401": {
        description: "Not authenticated",
        ...messageErrorResponse,
      },
      "403": {
        description: "Not the author",
        ...messageErrorResponse,
      },
      "404": {
        description: "Post or comment not found",
        ...messageErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const { commentId } = data.params;
    const database = db.getDatabase();

    const [row] = await database
      .select({
        id: comment.id,
        authorId: comment.authorId,
        postId: comment.postId,
      })
      .from(comment)
      .where(eq(comment.id, commentId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Comment not found");
    }

    const postRow = await fetchPublishedPostById(database, row.postId);
    ensurePostIsPublished(postRow);
    ensureCommentAuthor(row, user);

    const removed = await database
      .delete(comment)
      .where(eq(comment.id, commentId))
      .returning({ id: comment.id });

    if (removed.length === 0) {
      throw new NotFoundException("Comment not found");
    }

    return { success: true as const };
  }
}
