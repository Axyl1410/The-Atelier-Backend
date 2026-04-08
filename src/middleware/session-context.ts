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
  const isProtectedRoute = path === "/api/session" || path.startsWith("/api/");

  if (!isProtectedRoute) {
    await next();
    return;
  }

  // Fast path for anonymous requests: skip costly session lookup
  // unless the request carries auth hints.
  const hasAuthHeaders =
    c.req.raw.headers.has("cookie") || c.req.raw.headers.has("authorization");
  if (!hasAuthHeaders) {
    c.set("user", null);
    c.set("session", null);
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
