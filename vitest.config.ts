import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" throws on import outside a Server Component — correct in
      // production, fatal in a unit test. Stubbed here only.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/engine/**/*.test.ts", "tests/notify/**/*.test.ts", "lib/**/*.test.ts"],
    // The blackout suite (tests/blackout) runs under Playwright, not Vitest.
  },
});
