import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = env.VITE_SITE_URL?.replace(/\/$/, "") || "";
  const canonical = siteUrl ? `${siteUrl}/` : "/";
  const ogImage = siteUrl ? `${siteUrl}/logo-flutz.png` : "/logo-flutz.png";

  return {
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8081",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      {
        name: "html-seo-placeholders",
        transformIndexHtml(html) {
          return html
            .replaceAll("%CANONICAL_URL%", canonical)
            .replaceAll("%OG_IMAGE_URL%", ogImage);
        },
      },
      react(),
      tailwindcss(),
    ],
  };
});
