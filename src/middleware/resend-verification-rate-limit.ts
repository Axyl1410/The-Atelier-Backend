import type { Context, Next } from "hono";
import { checkRateLimit } from "@/lib/rate-limit";

function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function resendVerificationRateLimit(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const identifier = `resend-verification:${getClientIp(c.req.raw.headers)}`;
  const { success, limit, remaining, reset } = await checkRateLimit(identifier);

  if (!success) {
    return c.json(
      {
        message: "Too many requests",
        code: "RATE_LIMITED",
      },
      429
    );
  }

  await next();
  c.res.headers.set("X-RateLimit-Limit", String(limit));
  c.res.headers.set("X-RateLimit-Remaining", String(remaining));
  c.res.headers.set("X-RateLimit-Reset", String(reset));
}
