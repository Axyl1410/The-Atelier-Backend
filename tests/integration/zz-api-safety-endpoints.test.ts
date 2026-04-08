import { env, exports } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuthTestHelpers } from "./helpers/integration-auth-test-utils";
import { resetContentTablesForIntegrationAuthTests } from "./helpers/reset-content-tables-for-integration-auth";

const notFoundJson = { message: "Post not found", code: 7002 };
const forbiddenJson = { message: "Forbidden", code: 7012 };

/**
 * Runs after `z-authenticated-*` (`zz-` prefix). Focus: không lộ draft cho người ngoài,
 * list công khai chỉ published, comment/post chỉ đúng chủ sở hữu / điều kiện published.
 */
describe("API safety (draft visibility, list filter, comment & post ACL)", () => {
  let testHelpers: Awaited<ReturnType<typeof getAuthTestHelpers>>;
  let authorId: string;
  let strangerId: string;
  let draftPostId = "";
  let draftSlug = "";
  let publishedPostId = "";
  let publishedSlug = "";
  let commentId = "";

  async function headersFor(userId: string): Promise<Headers> {
    const h = await testHelpers.getAuthHeaders({ userId });
    return new Headers(h);
  }

  beforeAll(async () => {
    await resetContentTablesForIntegrationAuthTests(env.DB);
    testHelpers = await getAuthTestHelpers(env.DB);

    const author = testHelpers.createUser({
      email: "zz-safety-author@example.com",
      name: "Safety Author",
      emailVerified: true,
    });
    const stranger = testHelpers.createUser({
      email: "zz-safety-stranger@example.com",
      name: "Safety Stranger",
      emailVerified: true,
    });
    authorId = (await testHelpers.saveUser(author)).id;
    strangerId = (await testHelpers.saveUser(stranger)).id;

    const suffix = crypto.randomUUID().slice(0, 8);
    draftSlug = `draft-${suffix}`;
    publishedSlug = `pub-${suffix}`;

    let h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    let res = await exports.default.fetch("http://local.test/api/posts", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: "Draft only",
        content: "Secret",
        slug: draftSlug,
        isPublished: false,
      }),
    });
    expect(res.status).toBe(201);
    const draftBody = await res.json<{ post: { id: string } }>();
    draftPostId = draftBody.post.id;

    h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    res = await exports.default.fetch("http://local.test/api/posts", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: "Published",
        content: "Public",
        slug: publishedSlug,
        isPublished: true,
      }),
    });
    expect(res.status).toBe(201);
    const pubBody = await res.json<{ post: { id: string } }>();
    publishedPostId = pubBody.post.id;

    h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}/comments`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ content: "Author comment" }),
      }
    );
    expect(res.status).toBe(201);
    const cBody = await res.json<{ comment: { id: string } }>();
    commentId = cBody.comment.id;
  });

  afterAll(async () => {
    await testHelpers.deleteUser(strangerId);
    await testHelpers.deleteUser(authorId);
  });

  it("anonymous GET /api/posts does not include drafts (only published)", async () => {
    const res = await exports.default.fetch("http://local.test/api/posts", {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ posts: Array<{ id: string }> }>();
    const ids = body.posts.map((p) => p.id);
    expect(ids).toContain(publishedPostId);
    expect(ids).not.toContain(draftPostId);
  });

  it("anonymous GET /api/posts/by-slug for draft returns 404 (no existence leak)", async () => {
    const res = await exports.default.fetch(
      `http://local.test/api/posts/by-slug/${draftSlug}`,
      { method: "GET" }
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual(notFoundJson);
  });

  it("anonymous GET /api/posts/:id for draft returns 404", async () => {
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${draftPostId}`,
      { method: "GET" }
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual(notFoundJson);
  });

  it("stranger GET /api/posts/:id for author's draft returns 404", async () => {
    const h = await headersFor(strangerId);
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${draftPostId}`,
      { method: "GET", headers: h }
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual(notFoundJson);
  });

  it("author GET /api/posts/:id for own draft returns 200", async () => {
    const h = await headersFor(authorId);
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${draftPostId}`,
      { method: "GET", headers: h }
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      post: { id: string; isPublished: boolean };
    }>();
    expect(body.post.id).toBe(draftPostId);
    expect(body.post.isPublished).toBe(false);
  });

  it("POST comment on draft returns 404 even for author (comments only on published)", async () => {
    const h = await headersFor(authorId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${draftPostId}/comments`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({ content: "Should fail" }),
      }
    );
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual(notFoundJson);
  });

  it("stranger PATCH someone else's comment returns 403", async () => {
    const h = await headersFor(strangerId);
    h.set("Content-Type", "application/json");
    const res = await exports.default.fetch(
      `http://local.test/api/comments/${commentId}`,
      {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ content: "Hijack" }),
      }
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7011,
    });
  });

  it("stranger DELETE someone else's comment returns 403", async () => {
    const h = await headersFor(strangerId);
    const res = await exports.default.fetch(
      `http://local.test/api/comments/${commentId}`,
      { method: "DELETE", headers: h }
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7011,
    });
  });

  it("stranger DELETE author's post returns 403", async () => {
    const h = await headersFor(strangerId);
    const res = await exports.default.fetch(
      `http://local.test/api/posts/${publishedPostId}`,
      { method: "DELETE", headers: h }
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: "Forbidden",
      code: 7011,
    });
  });

  it("non-admin DELETE /api/tags/:id returns 403", async () => {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO tag (id, name, slug) VALUES (?, ?, ?)"
    )
      .bind("tag-safety-1", "Safety Tag", "safety-tag-1")
      .run();

    const h = await headersFor(authorId);
    const res = await exports.default.fetch(
      "http://local.test/api/tags/tag-safety-1",
      { method: "DELETE", headers: h }
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual(forbiddenJson);
  });
});
