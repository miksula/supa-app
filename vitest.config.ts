import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests run in Node without the app's Vite plugins (WASM, Tailwind).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./app/src/lib", import.meta.url)) },
  },
  test: {
    include: ["app/src/**/*.test.ts", "packages/**/*.test.ts", "scripts/**/*.test.js"],
    environment: "node",
    restoreMocks: true,
  },
});
