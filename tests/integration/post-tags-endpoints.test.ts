import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

describe("Post Tags API Integration Tests", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS post (id TEXT PRIMARY KEY, authorId TEXT NOT NULL, isPublished INTEGER NOT NULL DEFAULT 0)"
    ).run();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS tag (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE)"
    ).run();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS post_tag (postId TEXT NOT NULL, tagId TEXT NOT NULL, PRIMARY KEY (postId, tagId))"
    ).run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO tag (id, name, slug) VALUES (?, ?, ?)"
    )
      .bind("tag-1", "Tag 1", "tag-1")
      .run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post (id, authorId, isPublished) VALUES (?, ?, ?)"
    )
      .bind("post-published", "author-1", 1)
      .run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post (id, authorId, isPublished) VALUES (?, ?, ?)"
    )
      .bind("post-draft", "author-1", 0)
      .run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post_tag (postId, tagId) VALUES (?, ?)"
    )
      .bind("post-published", "tag-1")
      .run();
  });

  it("GET /api/posts/:postId/tags returns 404 when post not found", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/missing-post/tags",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Post not found",
      code: 7002,
    });
  });

  it("GET /api/posts/:postId/tags returns 200 for published post", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-published/tags",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      tags: [
        {
          id: "tag-1",
          name: "Tag 1",
          slug: "tag-1",
        },
      ],
    });
  });

  it("GET /api/posts/:postId/tags returns 404 for draft post without auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-draft/tags",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Post not found",
      code: 7002,
    });
  });

  it("POST /api/posts/:postId/tags requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/p-1/tags",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: "t-1" }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("PUT /api/posts/:postId/tags requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/p-1/tags",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: ["t-1"] }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("DELETE /api/posts/:postId/tags/:tagId requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/p-1/tags/t-1",
      {
        method: "DELETE",
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });
});
