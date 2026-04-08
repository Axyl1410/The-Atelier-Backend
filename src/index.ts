import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { DummyEndpoint } from "./endpoints/dummy-endpoint";
import {
  CreatePostCommentEndpoint,
  DeleteCommentEndpoint,
  ListPostCommentsEndpoint,
  UpdateCommentEndpoint,
} from "./endpoints/comments";
import {
  DeletePostTagEndpoint,
  GetPostTagsEndpoint,
  PostPostTagEndpoint,
  PutPostTagsSyncEndpoint,
} from "./endpoints/post-tags";
import {
  CreatePostEndpoint,
  DeletePostEndpoint,
  GetPostBySlugEndpoint,
  GetPostEndpoint,
  ListPostsEndpoint,
  UpdatePostEndpoint,
} from "./endpoints/posts";
import { ResendVerificationEmailEndpoint } from "./endpoints/resend-verification-email";
import {
  CreateTagEndpoint,
  DeleteTagEndpoint,
  GetTagEndpoint,
  ListTagsEndpoint,
  UpdateTagEndpoint,
} from "./endpoints/tags";
import { auth } from "./lib/auth";
import { authCorsMiddleware } from "./middleware/auth-cors";
import { resendVerificationRateLimit } from "./middleware/resend-verification-rate-limit";
import { sessionContextMiddleware } from "./middleware/session-context";

// Start a Hono app
const app = new Hono<{
  Bindings: Env;
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use("/api/auth/*", authCorsMiddleware);

app.use("/api/resend-verification-email", resendVerificationRateLimit);
app.use("*", sessionContextMiddleware);

app.get("/api/session", (c) => {
  const session = c.get("session");
  const user = c.get("user");

  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  return c.json({
    session,
    user,
  });
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    const message = err.message || "Unexpected error";
    return c.json({ message }, err.status as ContentfulStatusCode);
  }

  console.error("Global error handler caught:", err); // Log the error if it's not known

  return c.json({ message: "Internal Server Error" }, 500);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "The Atelier Backend API",
      version: "2.0.0",
      description:
        "The Atelier Backend API. Authentication (sign-up / sign-in / sign-out) is documented under Better Auth: interactive UI at `/api/auth/reference`, OpenAPI JSON at `/api/auth/open-api/generate-schema`. See `docs/better-auth-openapi.md`.",
    },
  },
});

// Register other endpoints
openapi.post("/dummy/:slug", DummyEndpoint);
openapi.post("/api/resend-verification-email", ResendVerificationEmailEndpoint);
openapi.get("/api/tags", ListTagsEndpoint);
openapi.get("/api/tags/:tagId", GetTagEndpoint);
openapi.post("/api/tags", CreateTagEndpoint);
openapi.patch("/api/tags/:tagId", UpdateTagEndpoint);
openapi.delete("/api/tags/:tagId", DeleteTagEndpoint);
openapi.get("/api/posts", ListPostsEndpoint);
openapi.get("/api/posts/by-slug/:slug", GetPostBySlugEndpoint);
openapi.get("/api/posts/:postId", GetPostEndpoint);
openapi.post("/api/posts", CreatePostEndpoint);
openapi.patch("/api/posts/:postId", UpdatePostEndpoint);
openapi.delete("/api/posts/:postId", DeletePostEndpoint);
openapi.get("/api/posts/:postId/tags", GetPostTagsEndpoint);
openapi.post("/api/posts/:postId/tags", PostPostTagEndpoint);
openapi.put("/api/posts/:postId/tags", PutPostTagsSyncEndpoint);
openapi.delete("/api/posts/:postId/tags/:tagId", DeletePostTagEndpoint);
openapi.get("/api/posts/:postId/comments", ListPostCommentsEndpoint);
openapi.post("/api/posts/:postId/comments", CreatePostCommentEndpoint);
openapi.patch("/api/comments/:commentId", UpdateCommentEndpoint);
openapi.delete("/api/comments/:commentId", DeleteCommentEndpoint);

// Export the Hono app
export default app;
