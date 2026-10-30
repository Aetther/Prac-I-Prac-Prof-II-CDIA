import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/game/**/*",
        "src/api/**/*",
        "src/audio/**/*",
        "src/components/questionEditorForm.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/game/types.ts",
        "src/api/types.ts",
        "src/api/index.ts",
        "src/audio/index.ts",
      ],
      thresholds: {
        lines: 100,
        branches: 100,
      },
    },
  },
});
