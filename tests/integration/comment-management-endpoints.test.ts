import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Comment Management API Integration Tests", () => {
  it("PATCH /api/comments/:commentId requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/comments/comment-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      }
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("DELETE /api/comments/:commentId requires auth", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/comments/comment-1",
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
