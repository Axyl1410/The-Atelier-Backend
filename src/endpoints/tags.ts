import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  createTagUseCase,
  deleteTagUseCase,
  getTagUseCase,
  listTagsUseCase,
  updateTagUseCase,
} from "@/application/content/tags";
import { db } from "@/db/client";
import {
  createTag,
  deleteTag,
  findTagById,
  hasTagName,
  hasTagSlug,
  listTags,
  updateTag,
} from "@/lib/content/tags-repository";
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

const apiErrorResponse = contentJson(
  z.object({
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
  })
);

function getTagDeps() {
  return {
    listTags,
    findTagById,
    hasTagName,
    hasTagSlug,
    createTag,
    updateTag,
    deleteTag,
    allocateUniqueSlugFromName: (name: string) =>
      allocateUniqueTagSlug(db.getDatabase(), name),
    slugify,
    tagNameOrSlugLike,
    generateTagId: () => crypto.randomUUID(),
  };
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
    return await listTagsUseCase(data.query?.q, getTagDeps());
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
      "404": {
        description: "Tag not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(_c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await getTagUseCase(data.params.tagId, getTagDeps());
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
        ...apiErrorResponse,
      },
      "403": {
        description: "Not an admin",
        ...apiErrorResponse,
      },
      "409": {
        description: "Name or slug already taken",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const created = await createTagUseCase(
      data.body,
      c.get("user"),
      getTagDeps()
    );
    return Response.json(created.body, { status: created.status });
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
        ...apiErrorResponse,
      },
      "403": {
        description: "Not an admin",
        ...apiErrorResponse,
      },
      "404": {
        description: "Tag not found",
        ...apiErrorResponse,
      },
      "409": {
        description: "Name or slug already taken",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await updateTagUseCase(
      data.params.tagId,
      data.body,
      c.get("user"),
      getTagDeps()
    );
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
        ...apiErrorResponse,
      },
      "403": {
        description: "Not an admin",
        ...apiErrorResponse,
      },
      "404": {
        description: "Tag not found",
        ...apiErrorResponse,
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    return await deleteTagUseCase(
      data.params.tagId,
      c.get("user"),
      getTagDeps()
    );
  }
}
