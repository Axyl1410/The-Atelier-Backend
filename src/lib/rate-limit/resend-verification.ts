import { redis } from "@/lib/redis";
import { checkRateLimit } from "./index";

const resendVerificationIpKeyPrefix = "resend-verification";

/** Per-email send cooldown (anti-spam / inbox protection). */
const resendVerificationEmailCooldownPrefix =
  "rate-limit:resend-verification-email";
const resendVerificationEmailCooldownTtlSeconds = 60 * 60;

function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export function resendVerificationIpIdentifier(headers: Headers): string {
  return `${resendVerificationIpKeyPrefix}:${getClientIp(headers)}`;
}

/** Uses global defaults from `checkRateLimit` (same Redis prefix as other default-limited routes). */
export function checkResendVerificationIpRateLimit(headers: Headers) {
  return checkRateLimit(resendVerificationIpIdentifier(headers));
}

function normalizedEmailCooldownKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `${resendVerificationEmailCooldownPrefix}:${normalized}`;
}

/**
 * Returns true if this email may trigger a send now (sets 1h cooldown).
 * Returns false if cooldown is already active.
 */
export async function tryAcquireResendVerificationEmailCooldown(
  email: string
): Promise<boolean> {
  const key = normalizedEmailCooldownKey(email);
  const result = await redis.set(key, "1", {
    nx: true,
    ex: resendVerificationEmailCooldownTtlSeconds,
  });
  return result === "OK";
}

export async function releaseResendVerificationEmailCooldown(
  email: string
): Promise<void> {
  await redis.del(normalizedEmailCooldownKey(email));
}
