import { cors } from "hono/cors";
import { trustedBrowserOrigins } from "@/lib/auth";

export const authCorsMiddleware = cors({
  origin: (origin) =>
    origin && trustedBrowserOrigins.includes(origin) ? origin : null,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PATCH", "PUT"],
  exposeHeaders: ["Set-Auth-Token"],
  maxAge: 600,
  credentials: true,
});
