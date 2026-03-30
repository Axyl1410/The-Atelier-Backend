import { createDb } from "@workspace/database";
import { env } from "../utils/cf-util";

class DatabaseClient {
  private readonly d1: D1Database;

  constructor() {
    this.d1 = env.DB;
  }

  getDatabase(d1?: D1Database) {
    return createDb(d1 ?? this.d1);
  }
}

export const db = new DatabaseClient();
