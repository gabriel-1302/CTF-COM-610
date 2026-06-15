import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: "static",
  integrations: [react(), tailwind({ applyBaseStyles: true })],
  server: { port: 4321 },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://backend:8000",
          changeOrigin: true,
        },
      },
    },
  },
});