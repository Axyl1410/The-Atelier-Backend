import { createEmailVerificationToken } from "better-auth/api";
import { contentJson, OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";
import { sendVerificationEmail } from "@/lib/email/transactional";
import type { AppContext } from "@/types";
import { env } from "@/utils/cf-util";

const TRAILING_SLASHES_REGEX = /\/+$/;

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
        description: "Verification email sent",
        ...contentJson(
          z.object({
            status: z.literal(true),
          })
        ),
      },
      "400": {
        description: "Invalid input or already verified",
        ...contentJson(
          z.object({
            message: z.string(),
            code: z.string(),
          })
        ),
      },
      "404": {
        description: "User does not exist",
        ...contentJson(
          z.object({
            message: z.string(),
            code: z.string(),
          })
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body as { email: string; callbackURL?: string };
    const email = body.email.trim().toLowerCase();

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

    if (!existingUser) {
      return c.json(
        {
          message: "User not found",
          code: "USER_NOT_FOUND",
        },
        404
      );
    }

    if (existingUser.emailVerified) {
      return c.json(
        {
          message: "Email already verified",
          code: "EMAIL_ALREADY_VERIFIED",
        },
        400
      );
    }

    const token = await createEmailVerificationToken(
      env.BETTER_AUTH_SECRET,
      existingUser.email
    );
    const callbackURL = body.callbackURL
      ? encodeURIComponent(body.callbackURL)
      : encodeURIComponent("/");
    const authBaseURL = env.BETTER_AUTH_URL.replace(TRAILING_SLASHES_REGEX, "");
    const verificationURL = `${authBaseURL}/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`;

    await sendVerificationEmail({
      user: {
        email: existingUser.email,
        name: existingUser.name,
      },
      url: verificationURL,
    });

    return {
      status: true as const,
    };
  }
}
