import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const post = sqliteTable(
  "post",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    coverImage: text("coverImage"),
    isPublished: integer("isPublished", { mode: "boolean" })
      .default(false)
      .notNull(),
    authorId: text("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("post_authorId_idx").on(table.authorId),
    index("post_slug_idx").on(table.slug),
    index("post_isPublished_createdAt_idx").on(
      table.isPublished,
      table.createdAt
    ),
    index("post_authorId_createdAt_idx").on(table.authorId, table.createdAt),
  ]
);

export const tag = sqliteTable("tag", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const postTag = sqliteTable(
  "post_tag",
  {
    postId: text("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    tagId: text("tagId")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("post_tag_tagId_idx").on(table.tagId),
  ]
);

export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    postId: text("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parentId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Needed so composite self-reference (id, postId) is valid in SQLite.
    uniqueIndex("comment_id_postId_uidx").on(table.id, table.postId),
    index("comment_postId_idx").on(table.postId),
    index("comment_authorId_idx").on(table.authorId),
    index("comment_parentId_idx").on(table.parentId),
    foreignKey({
      columns: [table.parentId, table.postId],
      foreignColumns: [table.id, table.postId],
      name: "comment_parent_same_post_fk",
    }).onDelete("cascade"),
  ]
);
