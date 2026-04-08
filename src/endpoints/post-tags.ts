import {
  contentJson,
  InputValidationException,
  NotFoundException,
  OpenAPIRoute,
} from "chanfana";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { postTag, tag } from "@/db/schema/content";
import {
  ensureAuthenticated,
  ensureCanViewPostTags,
  ensurePostAuthor,
  ensurePostExists,
  fetchPostForTagAccess,
} from "@/lib/content/post-tag-authorization";
import type { AppContext } from "@/types";

const tagDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const tagsListResponse = contentJson(
  z.object({
    success: z.literal(true),
    tags: z.array(tagDto),
  })
);

const successOnlyResponse = contentJson(
  z.object({
    success: z.literal(true),
  })
);

const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function selectTagsForPost(postId: string) {
  const database = db.getDatabase();
  return database
    .select({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })
    .from(postTag)
    .innerJoin(tag, eq(postTag.tagId, tag.id))
    .where(eq(postTag.postId, postId));
}

export class GetPostTagsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Tags"],
    summary: "List tags linked to a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Tags for the post",
        ...tagsListResponse,
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
    const row = await fetchPostForTagAccess(database, postId);
    ensurePostExists(row);
    ensureCanViewPostTags(row, c.get("user"));

    const tags = await selectTagsForPost(postId);
    return { success: true as const, tags };
  }
}

export class PostPostTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Tags"],
    summary: "Attach a tag to a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
      body: contentJson(
        z.object({
          tagId: z.string().min(1),
        })
      ),
    },
    responses: {
      "200": {
        description: "Tag was already linked (idempotent)",
        ...successOnlyResponse,
      },
      "201": {
        description: "Tag linked",
        ...successOnlyResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "403": {
        description: "Not the post author",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or tag not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { postId } = data.params;
    const { tagId } = data.body;
    const user = c.get("user");
    ensureAuthenticated(user);

    const database = db.getDatabase();
    const row = await fetchPostForTagAccess(database, postId);
    ensurePostExists(row);
    ensurePostAuthor(row, user);

    const [tagRow] = await database
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.id, tagId))
      .limit(1);
    if (!tagRow) {
      throw new NotFoundException("Tag not found");
    }

    const [existing] = await database
      .select({ postId: postTag.postId })
      .from(postTag)
      .where(and(eq(postTag.postId, postId), eq(postTag.tagId, tagId)))
      .limit(1);

    if (existing) {
      return Response.json({ success: true as const }, { status: 200 });
    }

    await database.insert(postTag).values({ postId, tagId });
    return Response.json({ success: true as const }, { status: 201 });
  }
}

export class DeletePostTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Tags"],
    summary: "Remove a tag from a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
        tagId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Link removed",
        ...successOnlyResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "403": {
        description: "Not the post author",
        ...apiErrorResponse,
      },
      "404": {
        description: "Post or post-tag link not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { postId, tagId } = data.params;
    const user = c.get("user");
    ensureAuthenticated(user);

    const database = db.getDatabase();
    const row = await fetchPostForTagAccess(database, postId);
    ensurePostExists(row);
    ensurePostAuthor(row, user);

    const removed = await database
      .delete(postTag)
      .where(and(eq(postTag.postId, postId), eq(postTag.tagId, tagId)))
      .returning({ postId: postTag.postId });

    if (removed.length === 0) {
      throw new NotFoundException("Post tag link not found");
    }

    return { success: true as const };
  }
}

export class PutPostTagsSyncEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Post Tags"],
    summary: "Replace all tags for a post",
    request: {
      params: z.object({
        postId: z.string().min(1),
      }),
      body: contentJson(
        z.object({
          tagIds: z.array(z.string().min(1)),
        })
      ),
    },
    responses: {
      "200": {
        description: "Tags synchronized",
        ...tagsListResponse,
      },
      "401": {
        description: "Not authenticated",
        ...apiErrorResponse,
      },
      "403": {
        description: "Not the post author",
        ...apiErrorResponse,
      },
      "400": {
        description: "Invalid tagIds payload",
        ...apiErrorResponse,
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
    const { tagIds } = data.body;
    const user = c.get("user");
    ensureAuthenticated(user);

    const database = db.getDatabase();
    const row = await fetchPostForTagAccess(database, postId);
    ensurePostExists(row);
    ensurePostAuthor(row, user);

    const uniqueIds = [...new Set(tagIds)];

    if (uniqueIds.length > 0) {
      const found = await database
        .select({ id: tag.id })
        .from(tag)
        .where(inArray(tag.id, uniqueIds));
      if (found.length !== uniqueIds.length) {
        throw new InputValidationException("One or more tags do not exist.", [
          "body",
          "tagIds",
        ]);
      }
    }

    await database.transaction(async (tx) => {
      const current = await tx
        .select({ tagId: postTag.tagId })
        .from(postTag)
        .where(eq(postTag.postId, postId));

      const currentSet = new Set(current.map((r) => r.tagId));
      const desiredSet = new Set(uniqueIds);

      const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));
      const toAdd = [...desiredSet].filter((id) => !currentSet.has(id));

      if (toRemove.length > 0) {
        await tx
          .delete(postTag)
          .where(
            and(eq(postTag.postId, postId), inArray(postTag.tagId, toRemove))
          );
      }

      if (toAdd.length > 0) {
        await tx.insert(postTag).values(
          toAdd.map((tid) => ({
            postId,
            tagId: tid,
          }))
        );
      }
    });

    const tags = await selectTagsForPost(postId);
    return { success: true as const, tags };
  }
}
