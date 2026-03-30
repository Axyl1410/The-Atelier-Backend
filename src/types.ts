import type { Context } from "hono";
import type { auth } from "./lib/auth";

export type AppContext = Context<{
  Bindings: Env;
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>;
export type HandleArgs = [AppContext];
