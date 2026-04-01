import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const DEFAULT_LIMIT = 3;
const DEFAULT_WINDOW = "60 s";

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, DEFAULT_WINDOW),
  prefix: "@upstash/ratelimit",
});

export async function checkRateLimit(identifier: string) {
  const result = await ratelimit.limit(identifier);
  return result;
}
