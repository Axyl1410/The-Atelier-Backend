import { NotFoundException } from "chanfana";

export interface LikeActor {
  id: string;
}

export interface LikePostDeps {
  findPostById: (postId: string) => Promise<{
    id: string;
    authorId: string;
    isPublished: boolean;
  } | null>;
  hasLike: (userId: string, postId: string) => Promise<boolean>;
  insertLike: (userId: string, postId: string) => Promise<void>;
  isUniqueLikeError: (error: unknown) => boolean;
}

interface UnlikePostDeps {
  deleteLike: (userId: string, postId: string) => Promise<void>;
  findPostById: LikePostDeps["findPostById"];
}

interface LikeStatusDeps {
  findPostById: LikePostDeps["findPostById"];
  hasLike: LikePostDeps["hasLike"];
}

async function ensurePostVisible(
  postId: string,
  actor: LikeActor,
  deps: Pick<LikePostDeps, "findPostById">
) {
  const post = await deps.findPostById(postId);
  if (!post) {
    throw new NotFoundException("Post not found");
  }
  if (post.isPublished || post.authorId === actor.id) {
    return;
  }
  throw new NotFoundException("Post not found");
}

export async function likePostUseCase(
  postId: string,
  actor: LikeActor,
  deps: LikePostDeps
) {
  await ensurePostVisible(postId, actor, deps);
  const existing = await deps.hasLike(actor.id, postId);
  if (existing) {
    return { status: 200 as const, body: { success: true as const } };
  }
  try {
    await deps.insertLike(actor.id, postId);
  } catch (error) {
    if (deps.isUniqueLikeError(error)) {
      return { status: 200 as const, body: { success: true as const } };
    }
    throw error;
  }
  return { status: 201 as const, body: { success: true as const } };
}

export async function unlikePostUseCase(
  postId: string,
  actor: LikeActor,
  deps: UnlikePostDeps
) {
  await ensurePostVisible(postId, actor, deps);
  await deps.deleteLike(actor.id, postId);
  return { success: true as const };
}

export async function getMyLikeStatusUseCase(
  postId: string,
  actor: LikeActor,
  deps: LikeStatusDeps
) {
  await ensurePostVisible(postId, actor, deps);
  const liked = await deps.hasLike(actor.id, postId);
  return { success: true as const, liked };
}
