import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "src/**/__tests__/**",
        "src/server.ts",
        "src/config/**",
        "**/*.d.ts",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@controllers": resolve(__dirname, "src/controllers"),
      "@services": resolve(__dirname, "src/services"),
      "@repositories": resolve(__dirname, "src/repositories"),
      "@models": resolve(__dirname, "src/models"),
      "@middlewares": resolve(__dirname, "src/middlewares"),
      "@config": resolve(__dirname, "src/config"),
      "@utils": resolve(__dirname, "src/utils"),
      "@exceptions": resolve(__dirname, "src/exceptions"),
      "@types": resolve(__dirname, "src/types"),
    },
  },
});
