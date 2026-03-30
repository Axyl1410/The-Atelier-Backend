/** biome-ignore-all lint/performance/noNamespaceImport: <explanation> */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { env } from "../utils/cf-util";

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
