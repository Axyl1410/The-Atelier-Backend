import { auth } from "@/lib/auth";
import { ensureBetterAuthTables } from "./ensure-auth-schema";

export async function getAuthTestHelpers(db: D1Database) {
  await ensureBetterAuthTables(db);
  const ctx = await auth.$context;
  if (!ctx.test) {
    throw new Error(
      "Better Auth test utils missing: add testUtils() to auth plugins"
    );
  }
  return ctx.test;
}
