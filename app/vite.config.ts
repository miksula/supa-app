import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
  },
  css: {
    devSourcemap: true,
  },
  plugins: [
    devtoolsJson(),
    tailwindcss(),
    // @ts-ignore -- it works fine
    wasm(),
  ],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Don't optimize these packages as they contain web workers and WASM files.
    // https://github.com/vitejs/vite/issues/11672#issuecomment-1415820673
    exclude: ["@journeyapps/wa-sqlite", "@powersync/web"],
    include: [],
  },
});
