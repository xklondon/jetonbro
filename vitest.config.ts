import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Global admin wipe deletes every Table; keep it out of the parallel suite unless requested.
    exclude: process.env.VITEST_INCLUDE_WIPE ? [] : ["**/wipe-tables.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
