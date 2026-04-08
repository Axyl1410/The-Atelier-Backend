import {
  ApiException,
  contentJson,
  NotFoundException,
  OpenAPIRoute,
} from "chanfana";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { post } from "@/db/schema/content";
import {
  ensureCanViewPostDetail,
  fetchPostById,
} from "@/lib/content/post-authorization";
import {
  cursorOlderThanPredicate,
  decodePostListCursor,
  encodePostListCursor,
} from "@/lib/content/post-cursor";
import {
  ensureAuthenticated,
  ensurePostAuthor,
} from "@/lib/content/post-tag-authorization";
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

function mapListRow(row: typeof post.$inferSelect) {
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

function mapDetailRow(row: typeof post.$inferSelect) {
  return {
    ...mapListRow(row),
    content: row.content,
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
    const limit = data.query?.limit ?? 20;
    const scope = data.query?.scope;
    const user = c.get("user");

    const database = db.getDatabase();

    const baseWhere = (() => {
      if (scope === "mine") {
        ensureAuthenticated(user);
        return eq(post.authorId, user.id);
      }
      return eq(post.isPublished, true);
    })();

    const cursorRaw = data.query?.cursor;
    const cursorPred =
      cursorRaw === undefined || cursorRaw === ""
        ? undefined
        : cursorOlderThanPredicate(decodePostListCursor(cursorRaw));

    const whereClause =
      cursorPred === undefined ? baseWhere : and(baseWhere, cursorPred);

    const rows = await database
      .select()
      .from(post)
      .where(whereClause)
      .orderBy(desc(post.createdAt), desc(post.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page.at(-1);
      if (!last) {
        // Defensive: should be unreachable because `page.length > 0`.
        throw new Error("Unexpected empty page while hasMore=true");
      }
      nextCursor = encodePostListCursor({
        createdAt: last.createdAt.getTime(),
        id: last.id,
      });
    }

    return {
      success: true as const,
      posts: page.map(mapListRow),
      nextCursor,
      hasMore,
    };
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
    const { slug } = data.params;
    const database = db.getDatabase();

    const [row] = await database
      .select()
      .from(post)
      .where(eq(post.slug, slug))
      .limit(1);

    const visible = ensureCanViewPostDetail(row, c.get("user"));
    return { success: true as const, post: mapDetailRow(visible) };
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const row = await fetchPostById(database, postId);
    const visible = ensureCanViewPostDetail(row, c.get("user"));
    return { success: true as const, post: mapDetailRow(visible) };
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
    const database = db.getDatabase();
    const b = data.body;

    const finalSlug =
      b.slug === undefined
        ? await allocateUniquePostSlug(database, b.title)
        : slugify(b.slug);

    if (b.slug !== undefined) {
      const [taken] = await database
        .select({ id: post.id })
        .from(post)
        .where(eq(post.slug, finalSlug))
        .limit(1);
      if (taken) {
        throwConflict("Post slug already taken");
      }
    }

    const id = crypto.randomUUID();
    try {
      await database.insert(post).values({
        id,
        slug: finalSlug,
        title: b.title,
        content: b.content,
        summary: b.summary ?? null,
        coverImage: b.coverImage ?? null,
        isPublished: b.isPublished ?? false,
        authorId: user.id,
      });
    } catch (error) {
      if (isUniqueConstraintForSlug(error)) {
        throwConflict("Post slug already taken");
      }
      throw error;
    }

    const created = await fetchPostById(database, id);
    if (!created) {
      throw new NotFoundException("Post not found");
    }

    return Response.json(
      { success: true as const, post: mapDetailRow(created) },
      { status: 201 }
    );
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const existing = await fetchPostById(database, postId);
    if (!existing) {
      throw new NotFoundException("Post not found");
    }
    ensurePostAuthor(
      {
        id: existing.id,
        authorId: existing.authorId,
        isPublished: existing.isPublished,
      },
      user
    );

    const b = data.body;
    const patch: Partial<typeof post.$inferInsert> = {};

    if (b.title !== undefined) {
      patch.title = b.title;
    }
    if (b.content !== undefined) {
      patch.content = b.content;
    }
    if (b.summary !== undefined) {
      patch.summary = b.summary;
    }
    if (b.coverImage !== undefined) {
      patch.coverImage = b.coverImage;
    }
    if (b.isPublished !== undefined) {
      patch.isPublished = b.isPublished;
    }

    if (b.slug !== undefined) {
      const nextSlug = slugify(b.slug);
      const [other] = await database
        .select({ id: post.id })
        .from(post)
        .where(and(eq(post.slug, nextSlug), ne(post.id, postId)))
        .limit(1);
      if (other) {
        throwConflict("Post slug already taken");
      }
      patch.slug = nextSlug;
    }

    if (Object.keys(patch).length > 0) {
      try {
        await database.update(post).set(patch).where(eq(post.id, postId));
      } catch (error) {
        if (isUniqueConstraintForSlug(error)) {
          throwConflict("Post slug already taken");
        }
        throw error;
      }
    }

    const updated = await fetchPostById(database, postId);
    if (!updated) {
      throw new NotFoundException("Post not found");
    }

    return { success: true as const, post: mapDetailRow(updated) };
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
    const { postId } = data.params;
    const database = db.getDatabase();

    const existing = await fetchPostById(database, postId);
    if (!existing) {
      throw new NotFoundException("Post not found");
    }
    ensurePostAuthor(
      {
        id: existing.id,
        authorId: existing.authorId,
        isPublished: existing.isPublished,
      },
      user
    );

    const removed = await database
      .delete(post)
      .where(eq(post.id, postId))
      .returning({ id: post.id });

    if (removed.length === 0) {
      throw new NotFoundException("Post not found");
    }

    return { success: true as const };
  }
}
