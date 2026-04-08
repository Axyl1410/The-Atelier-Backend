import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "tests/vitest.unit.config.mts",
      "tests/vitest.integration.config.mts",
    ],
  },
});
