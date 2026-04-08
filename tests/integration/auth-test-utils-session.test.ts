import { env, exports } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuthTestHelpers } from "./helpers/integration-auth-test-utils";

/**
 * Uses Better Auth {@link https://better-auth.com/docs/plugins/test-utils test utils}:
 * saveUser + getAuthHeaders for real session cookies against the Worker.
 */
describe("Better Auth test utils + session API", () => {
  let testHelpers: Awaited<ReturnType<typeof getAuthTestHelpers>>;
  let savedUserId: string;

  beforeAll(async () => {
    testHelpers = await getAuthTestHelpers(env.DB);
    const user = testHelpers.createUser({
      email: "integration-test-utils@example.com",
      name: "Integration Test Utils User",
      emailVerified: true,
    });
    const saved = await testHelpers.saveUser(user);
    savedUserId = saved.id;
  });

  afterAll(async () => {
    if (savedUserId) {
      await testHelpers.deleteUser(savedUserId);
    }
  });

  it("GET /api/session returns 200 with user when Cookie header is from test.getAuthHeaders", async () => {
    const headers = await testHelpers.getAuthHeaders({ userId: savedUserId });
    const res = await exports.default.fetch("http://local.test/api/session", {
      method: "GET",
      headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json<{
      user: { id: string; email: string };
      session: { userId: string };
    }>();
    expect(body.user.id).toBe(savedUserId);
    expect(body.user.email).toBe("integration-test-utils@example.com");
    expect(body.session.userId).toBe(savedUserId);
  });

  it("GET /api/profile returns 200 with success and user id", async () => {
    const headers = await testHelpers.getAuthHeaders({ userId: savedUserId });
    const res = await exports.default.fetch("http://local.test/api/profile", {
      method: "GET",
      headers,
    });

    expect(res.status).toBe(200);
    const body = await res.json<{
      success: boolean;
      user: { id: string; email?: string };
    }>();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe(savedUserId);
  });
});
