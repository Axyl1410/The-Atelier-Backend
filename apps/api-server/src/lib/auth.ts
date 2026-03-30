import { betterAuthSchema } from "@workspace/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import { db } from "../functions";
import { env } from "../utils/cf-util";

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
  },
  database: drizzleAdapter(db.getDatabase(), {
    provider: "sqlite",
    camelCase: true,
    schema: betterAuthSchema,
  }),
  plugins: [bearer(), openAPI()],
});
