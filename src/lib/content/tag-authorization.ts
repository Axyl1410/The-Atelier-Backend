import { ApiException } from "chanfana";
import { ensureAuthenticated } from "@/lib/content/post-tag-authorization";

export function ensureAdmin(
  user: { id: string; role?: string | null } | null
): asserts user is { id: string; role?: string | null } {
  ensureAuthenticated(user);
  if (user.role !== "admin") {
    const err = new ApiException("Forbidden");
    err.status = 403;
    err.code = 7012;
    throw err;
  }
}
