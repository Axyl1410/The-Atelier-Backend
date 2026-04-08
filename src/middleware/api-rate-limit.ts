import type { Next } from "hono";
import { checkRateLimit, type RateLimitOptions } from "@/lib/rate-limit";
import type { AppContext } from "@/types";

const READ_LIMIT: RateLimitOptions = { limit: 60, window: "60 s" };
const WRITE_LIMIT: RateLimitOptions = { limit: 20, window: "60 s" };

function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

function isReadRoute(method: string, path: string): boolean {
  if (method !== "GET") {
    return false;
  }

  if (path === "/api/posts" || path.startsWith("/api/posts/")) {
    return true;
  }

  if (path === "/api/tags" || path.startsWith("/api/tags/")) {
    return true;
  }

  return false;
}

function isWriteRoute(method: string, path: string): boolean {
  const isWriteMethod =
    method === "POST" || method === "PATCH" || method === "DELETE";
  if (!isWriteMethod) {
    return false;
  }

  if (path === "/api/posts" || path.startsWith("/api/posts/")) {
    return true;
  }

  if (path === "/api/tags" || path.startsWith("/api/tags/")) {
    return true;
  }

  if (path.startsWith("/api/comments/")) {
    return true;
  }

  return false;
}

function pickPolicy(method: string, path: string): RateLimitOptions | null {
  if (
    path === "/api/session" ||
    path === "/api/resend-verification-email" ||
    path.startsWith("/api/auth/")
  ) {
    return null;
  }

  if (isWriteRoute(method, path)) {
    return WRITE_LIMIT;
  }
  if (isReadRoute(method, path)) {
    return READ_LIMIT;
  }
  return null;
}

export async function apiRateLimitMiddleware(c: AppContext, next: Next) {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const policy = pickPolicy(c.req.method, c.req.path);
  if (!policy) {
    await next();
    return;
  }

  const userId = c.get("user")?.id;
  const identifier =
    userId === undefined
      ? `ip:${getClientIp(c.req.raw.headers)}`
      : `user:${userId}`;

  const { success, limit, remaining, reset } = await checkRateLimit(
    identifier,
    policy
  );

  if (!success) {
    return c.json({ message: "Too many requests", code: "RATE_LIMITED" }, 429);
  }

  await next();
  c.res.headers.set("X-RateLimit-Limit", String(limit));
  c.res.headers.set("X-RateLimit-Remaining", String(remaining));
  c.res.headers.set("X-RateLimit-Reset", String(reset));
}

