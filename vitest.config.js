import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    // Never let a test reach production behaviour or a real service.
    env: { VERCEL_ENV: "test" },
  },
});
