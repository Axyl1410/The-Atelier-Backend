import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

describe("Resend Verification API Integration Tests", () => {
  beforeAll(async () => {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, emailVerified INTEGER NOT NULL DEFAULT 0)"
    ).run();
  });

  it("POST /api/resend-verification-email returns 400 for invalid email", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }
    );

    expect(res.status).toBe(400);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toHaveProperty("errors");
  });

  it("POST /api/resend-verification-email returns 200 for valid email payload", async () => {
    const res = await exports.default.fetch(
      "http://local.test/api/resend-verification-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: true });
  });
});
