export interface SessionUser {
  id: string;
  [key: string]: unknown;
}

export function getCurrentProfileUseCase(user: SessionUser | null) {
  if (!user) {
    return null;
  }
  return {
    success: true as const,
    user,
  };
}
