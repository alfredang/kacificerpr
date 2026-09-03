import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      APP_ENCRYPTION_KEY: "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktdGVzdC0xMjM=",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
