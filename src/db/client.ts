/** biome-ignore-all lint/performance/noNamespaceImport: drizzle schema object for relational queries */
import { drizzle } from "drizzle-orm/d1";
import { env } from "@/utils/cf-util";
import * as authSchema from "./schema/auth";
import * as contentSchema from "./schema/content";
import * as relationSchema from "./schema/relations";
import * as socialSchema from "./schema/social";

const schema = {
  ...authSchema,
  ...contentSchema,
  ...socialSchema,
  ...relationSchema,
};

class DatabaseClient {
  private readonly d1: D1Database;
  private readonly casing: "camelCase";

  constructor() {
    this.d1 = env.DB;
    this.casing = "camelCase";
  }

  getDatabase(d1?: D1Database) {
    return drizzle(d1 ?? this.d1, {
      schema,
      casing: this.casing,
    });
  }
}

export const db = new DatabaseClient();
