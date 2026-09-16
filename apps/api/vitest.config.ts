import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@modules": path.resolve(__dirname, "src/modules"),
      "@core": path.resolve(__dirname, "src/core"),
      "@test": path.resolve(__dirname, "src/test"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@generated": path.resolve(__dirname, "src/generated"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["reflect-metadata", "./src/test/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
        "**/*.interface.ts",
        "src/generated/**",
        "src/test/**",
        "src/main.ts",
        "src/core/http/app.ts",
        "src/core/http/routes/**",
        "src/core/http/logger.ts",
        "src/core/container/**",
        "src/core/config/**",
        "src/core/database/**",
        "src/core/service/error-reporter/**",
        "src/shared/provider/**",
        "src/modules/**/domain/repository/**",
        "src/modules/**/infrastructure/route/**",
        "src/modules/**/infrastructure/repository/**",
        "src/modules/**/application/interface/**",
        "src/modules/ai/infrastructure/prompts/**",
      ],
    },
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
  },
});
