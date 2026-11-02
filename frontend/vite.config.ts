import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Sans backend :4000 → 502. Toujours lancer `npm run dev` à la racine du monorepo.
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        timeout: 60_000,
        proxyTimeout: 60_000,
      },
      "/health": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
});
