import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Session & Profile API Integration Tests", () => {
  it("GET /api/session returns 401 when not authenticated", async () => {
    const res = await exports.default.fetch("http://local.test/api/session", {
      method: "GET",
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });

  it("GET /api/profile returns 401 when not authenticated", async () => {
    const res = await exports.default.fetch("http://local.test/api/profile", {
      method: "GET",
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Unauthorized",
      code: 7010,
    });
  });
});
