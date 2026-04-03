import {
  ApiException,
  contentJson,
  NotFoundException,
  OpenAPIRoute,
} from "chanfana";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { tag } from "@/db/schema/content";
import { ensureAdmin } from "@/lib/content/tag-authorization";
import type { AppContext } from "@/types";
import {
  allocateUniqueTagSlug,
  slugify,
  tagNameOrSlugLike,
} from "@/utils/slugify";

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

const tagOneResponse = contentJson(
  z.object({
    success: z.literal(true),
    tag: tagDto,
  })
);

const jsonApiError = contentJson(
  z.object({
    success: z.literal(false),
    errors: z.array(
      z.object({
        code: z.number(),
        message: z.string(),
      })
    ),
  })
);

function throwConflict(message: string): never {
  const err = new ApiException(message);
  err.status = 409;
  err.code = 7013;
  throw err;
}

export class ListTagsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Tags"],
    summary: "List all tags",
    request: {
      query: z.object({
        q: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "Tags ordered by name",
        ...tagsListResponse,
      },
    },
  };

  async handle(_c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const q = data.query?.q;
    const database = db.getDatabase();

    const nameOrSlugFilter = q === undefined ? undefined : tagNameOrSlugLike(q);

    const tags = nameOrSlugFilter
      ? await database
          .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
          })
          .from(tag)
          .where(nameOrSlugFilter)
          .orderBy(asc(tag.name))
      : await database
          .select({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
          })
          .from(tag)
          .orderBy(asc(tag.name));

    return { success: true as const, tags };
  }
}

export class GetTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Tags"],
    summary: "Get a tag by id",
    request: {
      params: z.object({
        tagId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Tag",
        ...tagOneResponse,
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(_c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { tagId } = data.params;
    const database = db.getDatabase();

    const [row] = await database
      .select({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })
      .from(tag)
      .where(eq(tag.id, tagId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Tag not found");
    }

    return { success: true as const, tag: row };
  }
}

export class CreateTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Tags"],
    summary: "Create a tag (admin only)",
    request: {
      body: contentJson(
        z.object({
          name: z.string().min(1).max(200),
          slug: z.string().min(1).max(200).optional(),
        })
      ),
    },
    responses: {
      "201": {
        description: "Tag created",
        ...tagOneResponse,
      },
      "401": {
        description: "Not authenticated",
        ...jsonApiError,
      },
      "403": {
        description: "Not an admin",
        ...jsonApiError,
      },
      "409": {
        description: "Name or slug already taken",
        ...jsonApiError,
      },
    },
  };

  async handle(c: AppContext) {
    ensureAdmin(c.get("user"));
    const data = await this.getValidatedData<typeof this.schema>();
    const name = data.body.name.trim();
    const database = db.getDatabase();

    const [nameTaken] = await database
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.name, name))
      .limit(1);
    if (nameTaken) {
      throwConflict("Tag name already taken");
    }

    let finalSlug: string;
    if (data.body.slug === undefined) {
      finalSlug = await allocateUniqueTagSlug(database, name);
    } else {
      finalSlug = slugify(data.body.slug);
      const [slugTaken] = await database
        .select({ id: tag.id })
        .from(tag)
        .where(eq(tag.slug, finalSlug))
        .limit(1);
      if (slugTaken) {
        throwConflict("Tag slug already taken");
      }
    }

    const id = crypto.randomUUID();
    await database.insert(tag).values({ id, name, slug: finalSlug });

    return Response.json(
      {
        success: true as const,
        tag: { id, name, slug: finalSlug },
      },
      { status: 201 }
    );
  }
}

export class UpdateTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Tags"],
    summary: "Update a tag (admin only)",
    request: {
      params: z.object({
        tagId: z.string().min(1),
      }),
      body: contentJson(
        z
          .object({
            name: z.string().min(1).max(200).optional(),
            slug: z.string().min(1).max(200).optional(),
          })
          .refine((b) => b.name !== undefined || b.slug !== undefined, {
            message: "At least one of name or slug is required",
          })
      ),
    },
    responses: {
      "200": {
        description: "Tag updated",
        ...tagOneResponse,
      },
      "401": {
        description: "Not authenticated",
        ...jsonApiError,
      },
      "403": {
        description: "Not an admin",
        ...jsonApiError,
      },
      ...NotFoundException.schema(),
      "409": {
        description: "Name or slug already taken",
        ...jsonApiError,
      },
    },
  };

  async handle(c: AppContext) {
    ensureAdmin(c.get("user"));
    const data = await this.getValidatedData<typeof this.schema>();
    const { tagId } = data.params;
    const database = db.getDatabase();

    const [current] = await database
      .select({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })
      .from(tag)
      .where(eq(tag.id, tagId))
      .limit(1);

    if (!current) {
      throw new NotFoundException("Tag not found");
    }

    const newName =
      data.body.name === undefined ? undefined : data.body.name.trim();
    const newSlugRaw = data.body.slug;

    if (newName !== undefined) {
      const [other] = await database
        .select({ id: tag.id })
        .from(tag)
        .where(and(eq(tag.name, newName), ne(tag.id, tagId)))
        .limit(1);
      if (other) {
        throwConflict("Tag name already taken");
      }
    }

    if (newSlugRaw !== undefined) {
      const nextSlug = slugify(newSlugRaw);
      const [other] = await database
        .select({ id: tag.id })
        .from(tag)
        .where(and(eq(tag.slug, nextSlug), ne(tag.id, tagId)))
        .limit(1);
      if (other) {
        throwConflict("Tag slug already taken");
      }
    }

    const patch: { name?: string; slug?: string } = {};
    if (newName !== undefined) {
      patch.name = newName;
    }
    if (newSlugRaw !== undefined) {
      patch.slug = slugify(newSlugRaw);
    }

    await database.update(tag).set(patch).where(eq(tag.id, tagId));

    const [updated] = await database
      .select({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      })
      .from(tag)
      .where(eq(tag.id, tagId))
      .limit(1);

    if (!updated) {
      throw new NotFoundException("Tag not found");
    }

    return {
      success: true as const,
      tag: updated,
    };
  }
}

export class DeleteTagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Tags"],
    summary: "Delete a tag (admin only)",
    request: {
      params: z.object({
        tagId: z.string().min(1),
      }),
    },
    responses: {
      "200": {
        description: "Tag deleted",
        ...contentJson(
          z.object({
            success: z.literal(true),
          })
        ),
      },
      "401": {
        description: "Not authenticated",
        ...jsonApiError,
      },
      "403": {
        description: "Not an admin",
        ...jsonApiError,
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(c: AppContext) {
    ensureAdmin(c.get("user"));
    const data = await this.getValidatedData<typeof this.schema>();
    const { tagId } = data.params;
    const database = db.getDatabase();

    const removed = await database
      .delete(tag)
      .where(eq(tag.id, tagId))
      .returning({ id: tag.id });

    if (removed.length === 0) {
      throw new NotFoundException("Tag not found");
    }

    return { success: true as const };
  }
}
