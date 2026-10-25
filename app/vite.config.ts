import { defineConfig, loadEnv } from "vite";
import wasm from "vite-plugin-wasm";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL(".", import.meta.url).pathname, "VITE_");
  const parsedPort = env.VITE_DEV_PORT ? Number.parseInt(env.VITE_DEV_PORT, 10) : Number.NaN;
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : undefined;

  return {
    root: "./src",
    envDir: "..",
    publicDir: "../public",
    server: port ? { port } : undefined,
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      outDir: "../dist",
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
  };
});
