import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineProject } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineProject({
  test: {
    name: "integration",
    testTimeout: 30_000,
    fileParallelism: false,
    include: ["integration/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
      "@tests": path.resolve(__dirname),
    },
  },
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: path.resolve(__dirname, "../wrangler.jsonc"),
      },
      miniflare: {
        compatibilityFlags: [
          "nodejs_compat",
          "enable_nodejs_tty_module",
          "enable_nodejs_fs_module",
          "enable_nodejs_http_modules",
          "enable_nodejs_perf_hooks_module",
          "enable_nodejs_v8_module",
          "enable_nodejs_process_v2",
        ],
      },
    }),
  ],
});
