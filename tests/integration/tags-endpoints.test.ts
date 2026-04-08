import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

describe("Tags API Integration Tests", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS tag (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE)"
    ).run();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO tag (id, name, slug) VALUES (?, ?, ?)"
    )
      .bind("tag-tech", "Tech", "tech")
      .run();
  });

  it("GET /api/tags returns 200", async () => {
    const res = await exports.default.fetch("http://local.test/api/tags", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = await res.json<{
      success: boolean;
      tags: Array<{ id: string }>;
    }>();
    expect(body.success).toBe(true);
    expect(body.tags.length).toBeGreaterThan(0);
  });

  it("GET /api/tags/:tagId returns 404 when tag not found", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/tags/missing-tag",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      message: "Tag not found",
      code: 7002,
    });
  });

  it("GET /api/tags/:tagId returns 200 when tag exists", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/tags/tag-tech",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      tag: {
        id: "tag-tech",
        name: "Tech",
        slug: "tech",
      },
    });
  });

  it("GET /api/tags supports query filter", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/tags?q=tec",
      {
        method: "GET",
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      success: boolean;
      tags: Array<{ id: string }>;
    }>();
    expect(body.success).toBe(true);
    expect(body.tags.some((t) => t.id === "tag-tech")).toBe(true);
  });

  it("POST /api/tags requires auth", async () => {
    const res = await exports.default.fetch("http://local.test/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tech" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("PATCH /api/tags/:tagId requires auth", async () => {
    const res = await exports.default.fetch("http://local.test/api/tags/t-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("DELETE /api/tags/:tagId requires auth", async () => {
    const res = await exports.default.fetch("http://local.test/api/tags/t-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });
});
