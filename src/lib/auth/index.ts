import { waitUntil } from "cloudflare:workers";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
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
  session: {
    storeSessionInDatabase: true,
    // cookieCache disabled — bug #4203 (re-enable when upstream fixes it)
    updateAge: 60 * 15,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customStorage: {
      get: async (key) => {
        try {
          const data = await env.KV.get(key);
          return data ? JSON.parse(data) : undefined;
        } catch {
          return undefined;
        }
      },
      set: async (key, value) => {
        try {
          await env.KV.put(key, JSON.stringify(value), {
            expirationTtl: 60,
          });
        } catch (e) {
          console.warn("[auth] Rate limit KV set failed", {
            key,
            error: String(e),
          });
        }
      },
      delete: async (key: string) => {
        try {
          await env.KV.delete(key);
        } catch (e) {
          console.warn("[auth] Rate limit KV delete failed", {
            key,
            error: String(e),
          });
        }
      },
    },
  },
  secondaryStorage: {
    get: async (key) => {
      try {
        return await env.KV.get(key);
      } catch {
        return null;
      }
    },
    set: async (key, value, ttl) => {
      try {
        const effectiveTtl = ttl ? Math.max(ttl, 60) : undefined;
        await env.KV.put(
          key,
          value,
          effectiveTtl ? { expirationTtl: effectiveTtl } : undefined
        );
      } catch (e) {
        console.warn("[auth] KV set failed", { key, error: String(e) });
      }
    },
    delete: async (key) => {
      try {
        await env.KV.delete(key);
      } catch (e) {
        console.warn("[auth] KV delete failed", { key, error: String(e) });
      }
    },
  },

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
  plugins: [bearer(), openAPI(), username(), admin(), haveIBeenPwned()],
});
