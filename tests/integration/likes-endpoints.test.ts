import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Post Likes API Integration Tests", () => {
  it("POST /api/posts/:postId/likes requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-1/likes",
      {
        method: "POST",
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("DELETE /api/posts/:postId/likes requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-1/likes",
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

  it("GET /api/posts/:postId/likes/me requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/posts/post-1/likes/me",
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
});
