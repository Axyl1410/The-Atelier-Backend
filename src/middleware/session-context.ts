import type { Context, Next } from "hono";
import { auth } from "@/lib/auth";

export async function sessionContextMiddleware(c: Context, next: Next) {
  // Avoid doing session lookups on every request:
  // - Skip preflight requests
  // - Only evaluate sessions for protected routes (and /api/session)
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const path = c.req.path;
  const isProtectedRoute =
    path === "/api/session" || path.startsWith("/api/protected/");

  if (!isProtectedRoute) {
    await next();
    return;
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
}
