import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Comments API Integration Tests", () => {
  it("POST /api/posts/:postId/comments requires auth", async () => {
    const res = await SELF.fetch(
      "http://local.test/api/posts/post-does-not-matter/comments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("GET /api/posts/:postId/comments returns 404 when post not found", async () => {
    const res = await SELF.fetch(
      "http://local.test/api/posts/does-not-exist/comments",
      { method: "GET" }
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "Post not found" });
  });
});
