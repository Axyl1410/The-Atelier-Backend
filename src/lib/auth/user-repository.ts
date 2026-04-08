import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";

export interface VerificationCandidateUser {
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
}

export async function findVerificationCandidateByEmail(
  email: string
): Promise<VerificationCandidateUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [existingUser] = await db
    .getDatabase()
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(eq(userTable.email, normalizedEmail))
    .limit(1);

  return existingUser ?? null;
}
