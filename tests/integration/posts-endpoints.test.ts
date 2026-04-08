import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

describe("Posts API Integration Tests", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS post (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, coverImage TEXT, isPublished INTEGER NOT NULL DEFAULT 0, authorId TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)"
    ).run();
    const now = Date.now();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO post (id, slug, title, content, summary, coverImage, isPublished, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        "post-public-1",
        "post-public-1",
        "Public Post",
        "Public content",
        null,
        null,
        1,
        "author-1",
        now,
        now
      )
      .run();
  });

  it("GET /api/posts returns 200", async () => {
    const res = await exports.default.fetch("http://local.test/api/posts", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = await res.json<{
      success: boolean;
      posts: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    }>();
    expect(body.success).toBe(true);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.posts.some((p) => p.id === "post-public-1")).toBe(true);
  });

  it("GET /api/posts with scope=mine requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts?scope=mine",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("GET /api/posts returns 400 for invalid limit", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts?limit=0",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(400);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("errors");
  });

  it("GET /api/posts returns 400 for invalid cursor", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts?cursor=not_a_cursor",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      message: "Invalid cursor",
      code: 7001,
    });
  });

  it("GET /api/posts/by-slug/:slug returns 404 when post not found", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/by-slug/missing-post",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Post not found",
      code: 7002,
    });
  });

  it("GET /api/posts/by-slug/:slug returns 200 for published post", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/by-slug/post-public-1",
      { method: "GET" }
    );

    expect(res.status).toBe(200);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("post.id", "post-public-1");
  });

  it("GET /api/posts/:postId returns 404 when post not found", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/missing-post",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Post not found",
      code: 7002,
    });
  });

  it("GET /api/posts/:postId returns 200 for published post", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-public-1",
      { method: "GET" }
    );

    expect(res.status).toBe(200);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("post.slug", "post-public-1");
  });

  it("POST /api/posts requires auth", async () => {
    const res = await exports.default.fetch("http://local.test/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello", content: "World" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("PATCH /api/posts/:postId requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("DELETE /api/posts/:postId requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-1",
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
