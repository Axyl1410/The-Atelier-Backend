import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  test: {
    name: "unit",
    environment: "node",
    include: ["unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
      "@tests": path.resolve(__dirname),
    },
  },
});
