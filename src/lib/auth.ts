import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "../db/schema";
import { db } from "../functions";
import { env } from "../utils/cf-util";
import resend from "./resend";

const schema = {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};

const baseURL = env.BETTER_AUTH_URL;

/** Origins allowed for browser / WebView (CORS + Better Auth CSRF). Native apps often send no Origin — CORS allows that. */
export const trustedBrowserOrigins = [
  ...new Set([
    baseURL,
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "http://localhost:3000",
  ]),
];

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: trustedBrowserOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      await resend.emails.send({
        from: "Axyl <contact@axyl.io.vn>",
        to: user.email,
        subject: "Verify your email address",
        text: `Click the link to verify your email: ${url}?token=${token}`,
      });
    },
  },
  database: drizzleAdapter(db.getDatabase(), {
    provider: "sqlite",
    camelCase: true,
    schema,
  }),
  plugins: [bearer(), openAPI()],
});
