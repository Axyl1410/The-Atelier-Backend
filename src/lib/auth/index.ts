import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import {
  admin,
  bearer,
  haveIBeenPwned,
  openAPI,
  testUtils,
  username,
} from "better-auth/plugins";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
} from "@/db/schema/auth";
import { db } from "@/functions";
import {
  sendChangeEmailConfirmation,
  sendResetPassword,
  sendVerificationEmail,
} from "@/lib/email/transactional";
import { env } from "@/utils/cf-util";
import { redisSecondaryStorage } from "./adapters/redis-secondary-storage";
import { hashPassword, verifyPassword } from "./password-hash";

const waitUntil = await (async () => {
  try {
    const workers = await import("cloudflare:workers");
    return workers.waitUntil;
  } catch {
    return undefined;
  }
})();

const schema = {
  user,
  session,
  account,
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
  experimental: { joins: true },
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: trustedBrowserOrigins,
  baseURL,

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

  session: {
    storeSessionInDatabase: true,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: "secondary-storage",
  },

  secondaryStorage: redisSecondaryStorage,

  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"], // Cloudflare specific header example
    },
    ...(waitUntil
      ? {
          backgroundTasks: {
            handler: (p: Promise<unknown>) =>
              waitUntil(
                p.catch((err) =>
                  console.warn("[auth] Background task failed:", String(err))
                )
              ),
          },
        }
      : {}),
  },

  database: drizzleAdapter(db.getDatabase(), {
    provider: "sqlite",
    camelCase: true,
    schema,
  }),

  plugins: [
    bearer(),
    openAPI(),
    username(),
    admin(),
    haveIBeenPwned(),
    testUtils(),
  ],
});
