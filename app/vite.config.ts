import { defineConfig, loadEnv } from "vite";
import wasm from "vite-plugin-wasm";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, new URL(".", import.meta.url).pathname, "VITE_");
  if (
    command === "build" &&
    env.VITE_OFFLINE_MODE === "true" &&
    (!env.VITE_LOCAL_AUTH_EMAIL || !env.VITE_LOCAL_AUTH_PASSWORD)
  ) {
    throw new Error(
      "Local-Only builds need VITE_LOCAL_AUTH_EMAIL and VITE_LOCAL_AUTH_PASSWORD (see app/.env.local.template).",
    );
  }
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
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Local First Todos",
          short_name: "Todos",
          description: "Local-first todo list app",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#09090b",
          theme_color: "#09090b",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
          // OPFSCoopSyncVFS only loads the synchronous wa-sqlite build. The async builds
          // (IndexedDB VFS) and mc-* builds (encryption) are never loaded, and the async
          // .wasm files exceed Workbox's 2 MiB precache limit.
          globIgnores: ["**/*wa-sqlite-async*", "**/mc-wa-sqlite*"],
          navigateFallback: "/index.html",
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
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
