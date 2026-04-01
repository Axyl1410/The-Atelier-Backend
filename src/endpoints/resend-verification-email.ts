import { createEmailVerificationToken } from "better-auth/api";
import { contentJson, OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";
import { sendVerificationEmail } from "@/lib/email/transactional";
import { redis } from "@/lib/redis";
import type { AppContext } from "@/types";
import { env } from "@/utils/cf-util";

const TRAILING_SLASHES_REGEX = /\/+$/;
const RESEND_VERIFICATION_EMAIL_TTL_SECONDS = 24 * 60 * 60;
const RESEND_VERIFICATION_EMAIL_LOCK_PREFIX =
  "rate-limit:resend-verification-email";

export class ResendVerificationEmailEndpoint extends OpenAPIRoute {
  schema = {
    tags: ["Auth"],
    summary: "Resend verification email without requiring session",
    request: {
      body: contentJson(
        z.object({
          email: z.string().email(),
          callbackURL: z.string().optional(),
        })
      ),
    },
    responses: {
      "200": {
        description:
          "Request accepted (generic response to avoid email enumeration)",
        ...contentJson(
          z.object({
            status: z.literal(true),
          })
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body as { email: string; callbackURL?: string };
    const email = body.email.trim().toLowerCase();
    const betterAuthSecret = c.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;
    const requestOrigin = new URL(c.req.url).origin;
    const betterAuthURL =
      c.env.BETTER_AUTH_URL ?? env.BETTER_AUTH_URL ?? requestOrigin;

    const [existingUser] = await db
      .getDatabase()
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        emailVerified: userTable.emailVerified,
      })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    const sendTask = (async () => {
      if (!existingUser || existingUser.emailVerified) {
        return;
      }
      if (!betterAuthSecret) {
        console.warn(
          "[resend-verification-email] missing BETTER_AUTH_SECRET, skip sending email"
        );
        return;
      }

      const resendLockKey = `${RESEND_VERIFICATION_EMAIL_LOCK_PREFIX}:${email}`;
      const lockAcquireResult = await redis.set(resendLockKey, "1", {
        nx: true,
        ex: RESEND_VERIFICATION_EMAIL_TTL_SECONDS,
      });

      if (lockAcquireResult !== "OK") {
        return;
      }

      try {
        const token = await createEmailVerificationToken(
          betterAuthSecret,
          existingUser.email
        );
        const callbackURL = body.callbackURL
          ? encodeURIComponent(body.callbackURL)
          : encodeURIComponent("/");
        const authBaseURL = betterAuthURL.replace(TRAILING_SLASHES_REGEX, "");
        const verificationURL = `${authBaseURL}/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`;

        await sendVerificationEmail({
          user: {
            email: existingUser.email,
            name: existingUser.name,
          },
          url: verificationURL,
        });
      } catch (error) {
        await redis.del(resendLockKey);
        throw error;
      }
    })();

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(
        sendTask.catch((error) => {
          console.warn(
            "[resend-verification-email] background task failed:",
            error
          );
        })
      );
    } else {
      await sendTask;
    }

    return {
      status: true as const,
    };
  }
}
