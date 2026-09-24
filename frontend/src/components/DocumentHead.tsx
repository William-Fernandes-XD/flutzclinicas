import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SEO, absoluteUrl, isIndexablePath } from "../lib/seo";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Ajusta robots/canonical por rota.
 * Homepage: index,follow + meta institucional.
 * Áreas privadas: noindex,nofollow (sem alterar o title da página).
 */
export function DocumentHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const indexable = isIndexablePath(pathname);
    upsertMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow");

    if (pathname === "/") {
      document.title = SEO.title;
      upsertMeta("name", "description", SEO.description);
      upsertMeta("property", "og:title", SEO.ogTitle);
      upsertMeta("property", "og:description", SEO.ogDescription);
      upsertMeta("property", "og:url", absoluteUrl("/"));
      upsertMeta("property", "og:type", "website");
      upsertMeta("property", "og:site_name", "Flutz");
      upsertMeta("property", "og:locale", "pt_BR");
      upsertLink("canonical", absoluteUrl("/"));
    }
  }, [pathname]);

  return null;
}
