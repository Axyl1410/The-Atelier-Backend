import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  getMyLikeStatusUseCase,
  likePostUseCase,
  unlikePostUseCase,
} from "@/application/content/likes";
import {
  deleteLike,
  findPostById,
  hasLike,
  insertLike,
} from "@/lib/content/likes-repository";
import { ensureAuthenticated } from "@/lib/content/post-tag-authorization";
import type { AppContext } from "@/types";

const successOnlyResponse = contentJson(
  z.object({
    success: z.literal(true),
  })
);

const likedStatusResponse = contentJson(
  z.object({
    success: z.literal(true),
    liked: z.boolean(),
  })
);

const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function isUniqueConstraintForPostLike(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes("post_like.userId") &&
    error.message.includes("post_like.postId")
  );
}

function getLikeDeps() {
  return {
    findPostById,
    hasLike,
    insertLike,
    deleteLike,
    isUniqueLikeError: isUniqueConstraintForPostLike,
  };
}

export class PostLikeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Likes"],
    summary: "Like a post (idempotent)",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Post already liked",
        ...successOnlyResponse,
      },
      "201": {
        description: "Post liked",
        ...successOnlyResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const result = await likePostUseCase(
      data.params.postId,
      user,
      getLikeDeps()
    );
    return Response.json(result.body, { status: result.status });
  }
}

export class DeletePostLikeEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Likes"],
    summary: "Unlike a post (idempotent)",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Post unliked",
        ...successOnlyResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await unlikePostUseCase(data.params.postId, user, getLikeDeps());
  }
}

export class GetMyPostLikeStatusEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Likes"],
    summary: "Get current user's like status for a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Like status",
        ...likedStatusResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await getMyLikeStatusUseCase(
      data.params.postId,
      user,
      getLikeDeps()
    );
  }
}
