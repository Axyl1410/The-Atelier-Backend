import type { TestHelpers } from "better-auth/plugins";
import { beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";

describe("protected route", () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  it("should return user data for authenticated request", async () => {
    // Setup
    const user = test.createUser({ email: "test@example.com" });
    await test.saveUser(user);

    // Get authenticated headers
    const headers = await test.getAuthHeaders({ userId: user.id });

    // Test authenticated request
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);

    // Cleanup
    await test.deleteUser(user.id);
  });
});
