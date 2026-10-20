import { defineConfig } from "vitest/config";

// Unit tests run in Node without the app's Vite plugins (WASM, Tailwind).
export default defineConfig({
  test: {
    include: ["app/src/**/*.test.ts", "packages/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
