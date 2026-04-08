import { createEmailVerificationToken } from "better-auth/api";
import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { resendVerificationEmailUseCase } from "@/application/auth/resend-verification-email";
import { findVerificationCandidateByEmail } from "@/lib/auth/user-repository";
import { sendVerificationEmail } from "@/lib/email/transactional";
import {
  releaseResendVerificationEmailCooldown,
  tryAcquireResendVerificationEmailCooldown,
} from "@/lib/rate-limit/resend-verification";
import type { AppContext } from "@/types";
import { env } from "@/utils/cf-util";

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
    const betterAuthSecret = c.env.BETTER_AUTH_SECRET ?? env.BETTER_AUTH_SECRET;
    const requestOrigin = new URL(c.req.url).origin;
    const betterAuthURL =
      c.env.BETTER_AUTH_URL ?? env.BETTER_AUTH_URL ?? requestOrigin;
    const sendTask = resendVerificationEmailUseCase(
      {
        email: body.email,
        callbackURL: body.callbackURL,
        betterAuthSecret,
        betterAuthURL,
      },
      {
        findCandidateUserByEmail: findVerificationCandidateByEmail,
        tryAcquireEmailCooldown: tryAcquireResendVerificationEmailCooldown,
        releaseEmailCooldown: releaseResendVerificationEmailCooldown,
        createVerificationToken: createEmailVerificationToken,
        sendVerificationEmail,
        warn: console.warn,
      }
    );

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
