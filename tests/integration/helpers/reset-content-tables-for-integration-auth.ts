/**
 * Drops and recreates content/social tables used by authenticated integration tests.
 * Intended for `z-*.test.ts` (runs last) so earlier tests are not affected mid-suite.
 */
export async function resetContentTablesForIntegrationAuthTests(
  db: D1Database
): Promise<void> {
  for (const sql of [
    "DROP TABLE IF EXISTS post_like;",
    "DROP TABLE IF EXISTS comment;",
    "DROP TABLE IF EXISTS post_tag;",
    "DROP TABLE IF EXISTS post;",
    "DROP TABLE IF EXISTS tag;",
  ]) {
    await db.prepare(sql).run();
  }

  for (const sql of [
    "CREATE TABLE tag (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);",
    "CREATE TABLE post (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL, summary TEXT, coverImage TEXT, isPublished INTEGER NOT NULL DEFAULT 0, authorId TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);",
    "CREATE TABLE post_tag (postId TEXT NOT NULL, tagId TEXT NOT NULL, PRIMARY KEY (postId, tagId));",
    "CREATE TABLE comment (id TEXT PRIMARY KEY, content TEXT NOT NULL, postId TEXT NOT NULL, authorId TEXT NOT NULL, parentId TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);",
    "CREATE TABLE post_like (userId TEXT NOT NULL, postId TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (userId, postId));",
  ]) {
    await db.prepare(sql).run();
  }
}
