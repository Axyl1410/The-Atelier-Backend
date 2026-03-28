import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { user } from "./db/schema";
import { DummyEndpoint } from "./endpoints/dummy-endpoint";
import { db } from "./functions";
import { auth, trustedBrowserOrigins } from "./lib/auth";

// Start a Hono app
const app = new Hono<{
  Bindings: Env;
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use(
  "/api/auth/*",
  cors({
    origin: (origin) =>
      origin && trustedBrowserOrigins.includes(origin) ? origin : null,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PATCH", "PUT"],
    exposeHeaders: ["Set-Auth-Token"],
    maxAge: 600,
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    // If it's a Chanfana ApiException, let Chanfana handle the response
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode
    );
  }

  console.error("Global error handler caught:", err); // Log the error if it's not known

  // For other errors, return a generic 500 response
  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500
  );
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "The Atelier Backend API",
      version: "2.0.0",
      description: "This is the documentation for the The Atelier Backend API.",
    },
  },
});

// Register other endpoints
openapi.post("/dummy/:slug", DummyEndpoint);
openapi.get("/test", async () => {
  const database = db.getDatabase();
  const result = await database.select().from(user).all();
  return Response.json(result);
});
// Export the Hono app
export default app;
