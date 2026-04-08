const TRAILING_SLASHES_REGEX = /\/+$/;

export interface ResendVerificationCandidateUser {
  email: string;
  emailVerified: boolean;
  name?: string | null;
}

export interface ResendVerificationEmailInput {
  betterAuthSecret?: string;
  betterAuthURL: string;
  callbackURL?: string;
  email: string;
}

export interface ResendVerificationEmailDeps {
  createVerificationToken: (secret: string, email: string) => Promise<string>;
  findCandidateUserByEmail: (
    email: string
  ) => Promise<ResendVerificationCandidateUser | null>;
  releaseEmailCooldown: (email: string) => Promise<void>;
  sendVerificationEmail: (args: {
    user: { email: string; name?: string | null };
    url: string;
  }) => Promise<void>;
  tryAcquireEmailCooldown: (email: string) => Promise<boolean>;
  warn: (message: string, ...args: unknown[]) => void;
}

export async function resendVerificationEmailUseCase(
  input: ResendVerificationEmailInput,
  deps: ResendVerificationEmailDeps
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const existingUser = await deps.findCandidateUserByEmail(email);
  if (!existingUser || existingUser.emailVerified) {
    return;
  }

  if (!input.betterAuthSecret) {
    deps.warn(
      "[resend-verification-email] missing BETTER_AUTH_SECRET, skip sending email"
    );
    return;
  }

  const acquired = await deps.tryAcquireEmailCooldown(email);
  if (!acquired) {
    return;
  }

  try {
    const token = await deps.createVerificationToken(
      input.betterAuthSecret,
      existingUser.email
    );
    const callbackURL = input.callbackURL
      ? encodeURIComponent(input.callbackURL)
      : encodeURIComponent("/");
    const authBaseURL = input.betterAuthURL.replace(TRAILING_SLASHES_REGEX, "");
    const verificationURL = `${authBaseURL}/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`;

    await deps.sendVerificationEmail({
      user: {
        email: existingUser.email,
        name: existingUser.name,
      },
      url: verificationURL,
    });
  } catch (error) {
    await deps.releaseEmailCooldown(email);
    throw error;
  }
}
