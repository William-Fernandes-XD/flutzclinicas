import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function seoPlaceholders(siteUrl: string, canonical: string, ogImage: string): Plugin {
  const apply = (text: string) =>
    text
      .replaceAll("%SITE_URL%", siteUrl)
      .replaceAll("%CANONICAL_URL%", canonical)
      .replaceAll("%OG_IMAGE_URL%", ogImage);

  return {
    name: "html-seo-placeholders",
    transformIndexHtml(html) {
      return apply(html);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/robots.txt" && url !== "/sitemap.xml") {
          next();
          return;
        }
        const filePath = path.join(process.cwd(), "public", url.slice(1));
        if (!fs.existsSync(filePath)) {
          next();
          return;
        }
        const body = apply(fs.readFileSync(filePath, "utf8"));
        res.setHeader("Content-Type", url.endsWith(".xml") ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8");
        res.end(body);
      });
    },
    writeBundle(options) {
      const outDir = options.dir;
      if (!outDir) return;
      for (const file of ["sitemap.xml", "robots.txt"]) {
        const filePath = path.join(outDir, file);
        if (!fs.existsSync(filePath)) continue;
        const raw = fs.readFileSync(filePath, "utf8");
        fs.writeFileSync(filePath, apply(raw), "utf8");
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Domínio real do projeto (docs/produção). Não inventar outro host.
  const siteUrl =
    env.VITE_SITE_URL?.replace(/\/$/, "") ||
    (mode === "production" ? "https://flutzclinicas.com.br" : "http://127.0.0.1:5173");
  const canonical = `${siteUrl}/`;
  const ogImage = `${siteUrl}/logo-flutz.png`;

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
    plugins: [seoPlaceholders(siteUrl, canonical, ogImage), react(), tailwindcss()],
  };
});
