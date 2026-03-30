import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  bearer,
  haveIBeenPwned,
  openAPI,
  username,
} from "better-auth/plugins";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "../../db/schema/auth";
import { db } from "../../functions";
import { env } from "../../utils/cf-util";
import {
  sendChangeEmailConfirmation,
  sendResetPassword,
  sendVerificationEmail,
} from "../email/transactional";
import { hashPassword, verifyPassword } from "./password-hash";

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
    sendResetPassword,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation,
    },
  },
  emailVerification: {
    sendVerificationEmail,
  },
  database: drizzleAdapter(db.getDatabase(), {
    provider: "sqlite",
    camelCase: true,
    schema,
  }),
  plugins: [bearer(), openAPI(), username(), admin(), haveIBeenPwned()],
});
