import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "out/**", ".next/**", "src-tauri/target/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "lib/data-tools.ts",
        "lib/portable-package.ts",
        "lib/spreadsheet.ts",
        "lib/desktop/file-transfer.ts",
      ],
      exclude: ["**/*.d.ts", "tests/**"],
      thresholds: {
        lines: 78,
        functions: 78,
        statements: 78,
        branches: 68,
      },
    },
  },
});
