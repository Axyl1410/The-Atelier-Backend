import { env, exports } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuthTestHelpers } from "./helpers/integration-auth-test-utils";
import { resetContentTablesForIntegrationAuthTests } from "./helpers/reset-content-tables-for-integration-auth";

/**
 * Runs last (`z-` prefix): resets content tables, then covers authenticated flows for
 * posts, tags (admin), likes, comments, and post-tags using Better Auth test utils.
 */
describe("Authenticated content API (posts, tags, likes, comments, post-tags)", () => {
  let testHelpers: Awaited<ReturnType<typeof getAuthTestHelpers>>;
  let adminId: string;
  let authorId: string;
  let strangerId: string;
  let tagId = "";
  let publishedPostId = "";
  let commentId = "";

  async function headersFor(userId: string): Promise<Headers> {
    const h = await testHelpers.getAuthHeaders({ userId });
    return new Headers(h);
  }

  beforeAll(async () => {
    await resetContentTablesForIntegrationAuthTests(env.DB);
    testHelpers = await getAuthTestHelpers(env.DB);

    const admin = testHelpers.createUser({
      email: "z-auth-admin@example.com",
      name: "Z Admin",
      emailVerified: true,
      role: "admin",
    });
    const author = testHelpers.createUser({
      email: "z-auth-author@example.com",
      name: "Z Author",
      emailVerified: true,
    });
    const stranger = testHelpers.createUser({
      email: "z-auth-stranger@example.com",
      name: "Z Stranger",
      emailVerified: true,
    });

    const savedAdmin = await testHelpers.saveUser(admin);
    const savedAuthor = await testHelpers.saveUser(author);
    const savedStranger = await testHelpers.saveUser(stranger);
    adminId = savedAdmin.id;
    authorId = savedAuthor.id;
    strangerId = savedStranger.id;

    await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
      .bind(adminId)
      .run();
  });

  afterAll(async () => {
    await testHelpers.deleteUser(strangerId);
    await testHelpers.deleteUser(authorId);
    await testHelpers.deleteUser(adminId);
  });

  it("POST /api/tags returns 403 for non-admin", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch("http://local.test/api/tags", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Forbidden Tag" }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7012,
    });
  });

  it("POST /api/tags returns 201 for admin", async () => {
    const h = await headersFor(adminId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch("http://local.test/api/tags", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Z Admin Tag" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ success: boolean; tag: { id: string } }>();
    expect(body.success).toBe(true);
    tagId = body.tag.id;
    expect(tagId.length).toBeGreaterThan(0);
  });

  it("PATCH /api/tags/:tagId returns 200 for admin", async () => {
    expect(tagId).toBeTruthy();
    const h = await headersFor(adminId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/tags/${tagId}`,
      {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ name: "Z Admin Tag Renamed" }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ tag: { name: string } }>();
    expect(body.tag.name).toBe("Z Admin Tag Renamed");
  });

  it("POST /api/posts returns 201 for author (published)", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch("http://local.test/api/posts", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: "Z Likes Post",
        content: "Hello",
        isPublished: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ post: { id: string } }>();
    publishedPostId = body.post.id;
    expect(publishedPostId.length).toBeGreaterThan(0);
  });

  it("GET /api/posts?scope=mine returns author's post", async () => {
    const h = await headersFor(authorId);
    const res = await exports.default.fetch(
      "http://local.test/api/posts?scope=mine",
      { method: "GET", headers: h }
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      success: boolean;
      posts: Array<{ id: string }>;
    }>();
    expect(body.success).toBe(true);
    expect(body.posts.some((p) => p.id === publishedPostId)).toBe(true);
  });

  it("PATCH /api/posts/:postId returns 403 for non-author", async () => {
    const h = await headersFor(strangerId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}`,
      {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ title: "Hacked" }),
      }
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7011,
    });
  });

  it("PATCH /api/posts/:postId returns 200 for author", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}`,
      {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ title: "Z Likes Post Updated" }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ post: { title: string } }>();
    expect(body.post.title).toBe("Z Likes Post Updated");
  });

  it("POST like + GET me + DELETE like (stranger)", async () => {
    let h = await headersFor(strangerId);
    let res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/likes`,
      { method: "POST", headers: h }
    );
    expect(res.status).toBe(201);

    h = await headersFor(strangerId);
    res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/likes/me`,
      { method: "GET", headers: h }
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      liked: true,
    });

    h = await headersFor(strangerId);
    res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/likes`,
      { method: "DELETE", headers: h }
    );
    expect(res.status).toBe(200);

    h = await headersFor(strangerId);
    res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/likes/me`,
      { method: "GET", headers: h }
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      liked: false,
    });
  });

  it("POST /api/posts/:postId/comments returns 201", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/comments`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ content: "First comment" }),
      }
    );

    expect(res.status).toBe(201);
    const body = await res.json<{ comment: { id: string } }>();
    commentId = body.comment.id;
    expect(commentId.length).toBeGreaterThan(0);
  });

  it("PATCH /api/comments/:commentId returns 200 for author", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/comments/${commentId}`,
      {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ content: "Updated comment" }),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ comment: { content: string } }>();
    expect(body.comment.content).toBe("Updated comment");
  });

  it("DELETE /api/comments/:commentId returns 200 for author", async () => {
    const h = await headersFor(authorId);
    const res = await exports.default.fetch(
      `http://local.test/api/comments/${commentId}`,
      { method: "DELETE", headers: h }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  // PUT sync uses Drizzle transactions (SQL BEGIN); local D1 in Vitest errors on that.
  // Author attach via POST covers the same authorization path without a transaction.
  it("POST /api/posts/:postId/tags returns 201 for author (attach)", async () => {
    expect(tagId).toBeTruthy();
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/tags`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ tagId }),
      }
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it("POST /api/posts/:postId/tags returns 403 for non-author", async () => {
    const h = await headersFor(strangerId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/tags`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ tagId }),
      }
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7011,
    });
  });

  it("DELETE /api/posts/:postId returns 200 for author", async () => {
    const h = await headersFor(authorId);
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}`,
      { method: "DELETE", headers: h }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });
});
