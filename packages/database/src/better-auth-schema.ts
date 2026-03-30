import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "./schema";

/** Shape expected by `better-auth/adapters/drizzle` `drizzleAdapter(..., { schema })`. */
export const betterAuthSchema = {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
} as const;
