import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

describe("Comments API Integration Tests", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS post (id TEXT PRIMARY KEY, isPublished INTEGER NOT NULL DEFAULT 0)"
    ).run();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS comment (id TEXT PRIMARY KEY, content TEXT NOT NULL, postId TEXT NOT NULL, authorId TEXT NOT NULL, parentId TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)"
    ).run();
  });

  it("POST /api/posts/:postId/comments requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-does-not-matter/comments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("GET /api/posts/:postId/comments returns 404 when post not found", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/does-not-exist/comments",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Post not found",
      code: 7002,
    });
  });

  it("GET /api/posts/:postId/comments returns 200 with empty list when post exists", async () => {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post (id, isPublished) VALUES (?, ?)"
    )
      .bind("post-empty-comments", 1)
      .run();

    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-empty-comments/comments",
      { method: "GET" }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      comments: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("GET /api/posts/:postId/comments returns 404 when parentId is not found", async () => {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post (id, isPublished) VALUES (?, ?)"
    )
      .bind("post-parent-check", 1)
      .run();

    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-parent-check/comments?parentId=missing-parent",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Comment not found",
      code: 7002,
    });
  });

  it("GET /api/posts/:postId/comments returns 400 for invalid limit", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-empty-comments/comments?limit=0",
      { method: "GET" }
    );

    expect(res.status).toBe(400);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("errors");
  });

  it("GET /api/posts/:postId/comments returns 400 for invalid cursor", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-empty-comments/comments?cursor=invalid_cursor",
      { method: "GET" }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      message: "Invalid cursor",
      code: 7001,
    });
  });
});
