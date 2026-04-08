/**
 * Minimal Better Auth tables for D1 integration tests (aligned with drizzle/0001 + 0002).
 * Run early so later tests that use `CREATE TABLE IF NOT EXISTS user (...)` keep a superset schema.
 */
export async function ensureBetterAuthTables(db: D1Database): Promise<void> {
  const statements = [
    "CREATE TABLE IF NOT EXISTS `user` (\n" +
      "\t\t\t`id` text PRIMARY KEY NOT NULL,\n" +
      "\t\t\t`name` text NOT NULL,\n" +
      "\t\t\t`email` text NOT NULL,\n" +
      "\t\t\t`emailVerified` integer DEFAULT false NOT NULL,\n" +
      "\t\t\t`image` text,\n" +
      "\t\t\t`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n" +
      "\t\t\t`updatedAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n" +
      "\t\t\t`username` text,\n" +
      "\t\t\t`displayUsername` text,\n" +
      "\t\t\t`role` text,\n" +
      "\t\t\t`banned` integer DEFAULT false,\n" +
      "\t\t\t`banReason` text,\n" +
      "\t\t\t`banExpires` integer\n" +
      "\t\t);",
    "CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);",
    "CREATE UNIQUE INDEX IF NOT EXISTS `user_username_unique` ON `user` (`username`);",
    "CREATE TABLE IF NOT EXISTS `session` (\n" +
      "\t\t\t`id` text PRIMARY KEY NOT NULL,\n" +
      "\t\t\t`expiresAt` integer NOT NULL,\n" +
      "\t\t\t`token` text NOT NULL,\n" +
      "\t\t\t`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n" +
      "\t\t\t`updatedAt` integer NOT NULL,\n" +
      "\t\t\t`ipAddress` text,\n" +
      "\t\t\t`userAgent` text,\n" +
      "\t\t\t`userId` text NOT NULL,\n" +
      "\t\t\t`impersonatedBy` text,\n" +
      "\t\t\tFOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n" +
      "\t\t);",
    "CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);",
    "CREATE INDEX IF NOT EXISTS `session_userId_idx` ON `session` (`userId`);",
    "CREATE TABLE IF NOT EXISTS `account` (\n" +
      "\t\t\t`id` text PRIMARY KEY NOT NULL,\n" +
      "\t\t\t`accountId` text NOT NULL,\n" +
      "\t\t\t`providerId` text NOT NULL,\n" +
      "\t\t\t`userId` text NOT NULL,\n" +
      "\t\t\t`accessToken` text,\n" +
      "\t\t\t`refreshToken` text,\n" +
      "\t\t\t`idToken` text,\n" +
      "\t\t\t`accessTokenExpiresAt` integer,\n" +
      "\t\t\t`refreshTokenExpiresAt` integer,\n" +
      "\t\t\t`scope` text,\n" +
      "\t\t\t`password` text,\n" +
      "\t\t\t`createdAt` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,\n" +
      "\t\t\t`updatedAt` integer NOT NULL,\n" +
      "\t\t\tFOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade\n" +
      "\t\t);",
    "CREATE INDEX IF NOT EXISTS `account_userId_idx` ON `account` (`userId`);",
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}
