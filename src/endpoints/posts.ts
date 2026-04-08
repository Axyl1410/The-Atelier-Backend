import { ApiException, contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  getPostByIdUseCase,
  getPostBySlugUseCase,
  listPostsUseCase,
} from "@/application/content/read-posts";
import {
  createPostUseCase,
  deletePostUseCase,
  updatePostUseCase,
} from "@/application/content/write-posts";
import { db } from "@/db/client";
import {
  findPostById,
  findPostBySlug,
  listPostsPage,
} from "@/lib/content/post-read-repository";
import { ensureAuthenticated } from "@/lib/content/post-tag-authorization";
import {
  deletePostById,
  findPostAccessById,
  findPostDetailById,
  hasOtherPostBySlug,
  hasPostBySlug,
  insertPost,
  updatePost,
} from "@/lib/content/post-write-repository";
import type { AppContext } from "@/types";
import { allocateUniquePostSlug, slugify } from "@/utils/slugify";

const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function throwConflict(message: string): never {
  const err = new ApiException(message);
  err.status = 409;
  err.code = 7013;
  throw err;
}

function isUniqueConstraintForSlug(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes("post.slug")
  );
}

const postListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  coverImage: z.string().nullable(),
  isPublished: z.boolean(),
  authorId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const postListResponse = contentJson(
  z.object({
    success: z.literal(true),
    posts: z.array(postListItemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })
);

const postDetailSchema = postListItemSchema.extend({
  content: z.string(),
});

const postDetailResponse = contentJson(
  z.object({
    success: z.literal(true),
    post: postDetailSchema,
  })
);

function getPostReadDeps() {
  return {
    listPostsPage,
    findPostBySlug,
    findPostById,
  };
}

function getPostWriteDeps() {
  const database = db.getDatabase();
  return {
    generatePostId: () => crypto.randomUUID(),
    toSlug: slugify,
    allocateUniqueSlugFromTitle: (title: string) =>
      allocateUniquePostSlug(database, title),
    hasPostBySlug,
    insertPost,
    findPostById: findPostDetailById,
    isUniqueSlugError: isUniqueConstraintForSlug,
    throwConflict,
    findPostAccessById,
    hasOtherPostBySlug,
    updatePost,
    deletePostById,
  };
}

export class ListPostsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "List posts (cursor pagination for infinite scroll)",
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(50).optional(),
        cursor: z.string().optional(),
        scope: z.enum(["mine"]).optional(),
      }),
    },
    responses: {
      "200": {
        description: "Page of posts",
        ...postListResponse,
      },
      "400": {
        description: "Invalid query parameters",
        ...apiErrorResponse,
      },
      "401": {
        description: "Required for scope=mine",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await listPostsUseCase(
      data.query ?? {},
      c.get("user"),
      getPostReadDeps()
    );
  }
}

export class GetPostBySlugEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "Get a post by slug",
    request: {
      params: z.object({
        slug: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Post",
        ...postDetailResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await getPostBySlugUseCase(
      data.params.slug,
      c.get("user"),
      getPostReadDeps()
    );
  }
}

export class GetPostEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "Get a post by id",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Post",
        ...postDetailResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await getPostByIdUseCase(
      data.params.postId,
      c.get("user"),
      getPostReadDeps()
    );
  }
}

export class CreatePostEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "Create a post",
    request: {
      body: contentJson(
        z.object({
          title: z.string().min(1).max(500),
          content: z.string().min(1),
          slug: z.string().min(1).max(200).optional(),
          summary: z.string().max(5000).optional(),
          coverImage: z.string().max(2000).optional(),
          isPublished: z.boolean().optional(),
        })
      ),
    },
    responses: {
      "201": {
        description: "Post created",
        ...postDetailResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post not found",
        ...apiErrorResponse,
      },
      "409": {
        description: "Slug already taken",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    const created = await createPostUseCase(
      data.body,
      user,
      getPostWriteDeps()
    );

    return Response.json(created, { status: 201 });
  }
}

export class UpdatePostEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "Update a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
      body: contentJson(
        z
          .object({
            title: z.string().min(1).max(500).optional(),
            content: z.string().min(1).optional(),
            slug: z.string().min(1).max(200).optional(),
            summary: z.string().max(5000).optional().nullable(),
            coverImage: z.string().max(2000).optional().nullable(),
            isPublished: z.boolean().optional(),
          })
          .refine(
            (p) =>
              p.title !== undefined ||
              p.content !== undefined ||
              p.slug !== undefined ||
              p.summary !== undefined ||
              p.coverImage !== undefined ||
              p.isPublished !== undefined,
            { message: "At least one field is required" }
          )
      ),
    },
    responses: {
      "200": {
        description: "Post updated",
        ...postDetailResponse,
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
        description: "Post not found",
        ...apiErrorResponse,
      },
      "409": {
        description: "Slug already taken",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await updatePostUseCase(
      { postId: data.params.postId, ...data.body },
      user,
      getPostWriteDeps()
    );
  }
}

export class DeletePostEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Posts"],
    summary: "Delete a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Post deleted",
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
        description: "Post not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const user = c.get("user");
    ensureAuthenticated(user);
    const data = await this.getValidatedData<typeof this.schema>();
    return await deletePostUseCase(
      data.params.postId,
      user,
      getPostWriteDeps()
    );
  }
}
