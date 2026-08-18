import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/engine/**/*.test.ts", "lib/**/*.test.ts"],
    // The blackout suite (tests/blackout) runs under Playwright, not Vitest.
  },
});
