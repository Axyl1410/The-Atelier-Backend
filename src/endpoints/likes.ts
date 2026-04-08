import { contentJson, OpenAPIRoute } from "chanfana";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { postLike } from "@/db/schema/social";
import {
  ensureCanViewPostDetail,
  fetchPostById,
} from "@/lib/content/post-authorization";
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const postRow = await fetchPostById(database, postId);
    ensureCanViewPostDetail(postRow, user);

    const [existing] = await database
      .select({ postId: postLike.postId })
      .from(postLike)
      .where(and(eq(postLike.userId, user.id), eq(postLike.postId, postId)))
      .limit(1);

    if (existing) {
      return Response.json({ success: true as const }, { status: 200 });
    }

    try {
      await database.insert(postLike).values({ userId: user.id, postId });
    } catch (error) {
      // Preserve idempotent behavior under concurrent like requests.
      if (isUniqueConstraintForPostLike(error)) {
        return Response.json({ success: true as const }, { status: 200 });
      }
      throw error;
    }
    return Response.json({ success: true as const }, { status: 201 });
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const postRow = await fetchPostById(database, postId);
    ensureCanViewPostDetail(postRow, user);

    await database
      .delete(postLike)
      .where(and(eq(postLike.userId, user.id), eq(postLike.postId, postId)));

    return { success: true as const };
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const postRow = await fetchPostById(database, postId);
    ensureCanViewPostDetail(postRow, user);

    const [existing] = await database
      .select({ postId: postLike.postId })
      .from(postLike)
      .where(and(eq(postLike.userId, user.id), eq(postLike.postId, postId)))
      .limit(1);

    return { success: true as const, liked: Boolean(existing) };
  }
}

