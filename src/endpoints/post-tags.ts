import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
  addPostTagUseCase,
  deletePostTagUseCase,
  getPostTagsUseCase,
  syncPostTagsUseCase,
} from "@/application/content/post-tags";
import { ensureAuthenticated } from "@/lib/content/post-tag-authorization";
import {
  countExistingTags,
  deletePostTagLink,
  findPostForAccess,
  findTagById,
  hasPostTagLink,
  insertPostTagLink,
  listTagsForPost,
  syncPostTags,
} from "@/lib/content/post-tags-repository";
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

function getPostTagDeps() {
  return {
    findPostForAccess,
    listTagsForPost,
    findTagById,
    hasPostTagLink,
    insertPostTagLink,
    deletePostTagLink,
    countExistingTags,
    syncPostTags,
  };
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
    return await getPostTagsUseCase(
      data.params.postId,
      c.get("user"),
      getPostTagDeps()
    );
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
    const result = await addPostTagUseCase(
      postId,
      tagId,
      user,
      getPostTagDeps()
    );
    return Response.json(result.body, { status: result.status });
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
    return await deletePostTagUseCase(postId, tagId, user, getPostTagDeps());
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
    return await syncPostTagsUseCase(postId, tagIds, user, getPostTagDeps());
  }
}
