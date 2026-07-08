// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// Öffentliche Basis-URL der Website. Für das Deployment ggf. auf die
// echte Domain anpassen (wird für kanonische URLs und die Sitemap genutzt).
const site = process.env.SITE_URL ?? "https://kitakosten.de";

// https://astro.build/config
export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  integrations: [react(), tailwind(), sitemap()],
});
