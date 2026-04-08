import { NotFoundException } from "chanfana";
import {
  decodePostListCursor,
  encodePostListCursor,
} from "@/lib/content/post-cursor";
import {
  ensureAuthenticated,
  type PostTagAccessRow,
} from "@/lib/content/post-tag-authorization";

export interface PostReadModel extends PostTagAccessRow {
  content: string;
  coverImage: string | null;
  createdAt: Date;
  slug: string;
  summary: string | null;
  title: string;
  updatedAt: Date;
}

export interface PostViewer {
  id: string;
}

export interface ListPostsQuery {
  cursor?: string;
  limit?: number;
  scope?: "mine";
}

export interface ListPostsDeps {
  listPostsPage(args: {
    limitPlusOne: number;
    cursor?: { createdAt: number; id: string };
    viewerId?: string;
  }): Promise<PostReadModel[]>;
}

function mapListRow(row: PostReadModel) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverImage: row.coverImage,
    isPublished: row.isPublished,
    authorId: row.authorId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function mapDetailRow(row: PostReadModel) {
  return {
    ...mapListRow(row),
    content: row.content,
  };
}

export async function listPostsUseCase(
  query: ListPostsQuery,
  viewer: PostViewer | null,
  deps: ListPostsDeps
) {
  const limit = query.limit ?? 20;
  const viewerId =
    query.scope === "mine" ? ensureMineScope(viewer).id : undefined;
  const cursor =
    query.cursor === undefined || query.cursor === ""
      ? undefined
      : decodePostListCursor(query.cursor);

  const rows = await deps.listPostsPage({
    limitPlusOne: limit + 1,
    cursor,
    viewerId,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodePostListCursor({
          createdAt: last.createdAt.getTime(),
          id: last.id,
        })
      : null;

  return {
    success: true as const,
    posts: page.map(mapListRow),
    nextCursor,
    hasMore,
  };
}

export interface PostDetailDeps {
  findPostById(postId: string): Promise<PostReadModel | null>;
  findPostBySlug(slug: string): Promise<PostReadModel | null>;
}

export async function getPostBySlugUseCase(
  slug: string,
  viewer: PostViewer | null,
  deps: Pick<PostDetailDeps, "findPostBySlug">
) {
  const row = await deps.findPostBySlug(slug);
  const visible = ensureVisiblePost(row, viewer);
  return { success: true as const, post: mapDetailRow(visible) };
}

export async function getPostByIdUseCase(
  postId: string,
  viewer: PostViewer | null,
  deps: Pick<PostDetailDeps, "findPostById">
) {
  const row = await deps.findPostById(postId);
  const visible = ensureVisiblePost(row, viewer);
  return { success: true as const, post: mapDetailRow(visible) };
}

function ensureMineScope(viewer: PostViewer | null): PostViewer {
  ensureAuthenticated(viewer);
  return viewer;
}

function ensureVisiblePost(
  row: PostReadModel | null,
  viewer: PostViewer | null
): PostReadModel {
  if (!row) {
    throw new NotFoundException("Post not found");
  }
  if (row.isPublished) {
    return row;
  }
  if (viewer?.id === row.authorId) {
    return row;
  }
  throw new NotFoundException("Post not found");
}

export function requirePostFound(row: PostReadModel | null): PostReadModel {
  if (!row) {
    throw new NotFoundException("Post not found");
  }
  return row;
}
