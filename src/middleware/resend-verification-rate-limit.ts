import type { Context, Next } from "hono";
import { checkResendVerificationIpRateLimit } from "@/lib/rate-limit/resend-verification";

export async function resendVerificationRateLimit(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const { success, limit, remaining, reset } =
    await checkResendVerificationIpRateLimit(c.req.raw.headers);

  if (!success) {
    return c.json({ message: "Too many requests", code: "RATE_LIMITED" }, 429);
  }

  await next();
  c.res.headers.set("X-RateLimit-Limit", String(limit));
  c.res.headers.set("X-RateLimit-Remaining", String(remaining));
  c.res.headers.set("X-RateLimit-Reset", String(reset));
}
