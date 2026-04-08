import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  createPostCommentUseCase,
  deleteCommentUseCase,
  listPostCommentsUseCase,
  updateCommentUseCase,
} from "@/application/content/comments";
import {
  deleteCommentById,
  ensureParentCommentExists,
  ensurePublishedPostExists,
  findCommentAccessById,
  findCommentById,
  insertComment,
  listCommentsPage,
  updateCommentContent,
} from "@/lib/content/comment-repository";
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
const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function getCommentDeps() {
  return {
    ensurePublishedPostExists,
    ensureParentCommentExists,
    listCommentsPage,
    generateCommentId: () => crypto.randomUUID(),
    insertComment,
    findCommentById,
    findCommentAccessById,
    updateCommentContent,
    deleteCommentById,
  };
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
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or parent comment not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    // Touch context to avoid unused param lint and keep access to session variables consistent.
    c.get("user");
    const data = await this.getValidatedData<typeof this.schema>();
    return await listPostCommentsUseCase(
      {
        postId: data.params.postId,
        limit: data.query?.limit,
        cursor: data.query?.cursor,
        parentId: data.query?.parentId,
      },
      getCommentDeps()
    );
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
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or parent comment not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const created = await createPostCommentUseCase(
      {
        postId: data.params.postId,
        content: data.body.content,
        parentId: data.body.parentId,
      },
      user,
      getCommentDeps()
    );

    return Response.json(created, { status: 201 });
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
        ...apiErrorResponse,
      },
      "403": {
        description: "Not the author",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or comment not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await updateCommentUseCase(
      data.params.commentId,
      data.body.content,
      user,
      getCommentDeps()
    );
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
        ...apiErrorResponse,
      },
      "403": {
        description: "Not the author",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or comment not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await deleteCommentUseCase(
      data.params.commentId,
      user,
      getCommentDeps()
    );
  }
}
