/**
 * Lädt die Kommunen-Gebührenmodelle zur Build-Zeit aus data/kommunen/.
 *
 * Diese Datei nutzt das Node-Dateisystem und darf ausschließlich
 * serverseitig (in .astro-Frontmatter / getStaticPaths) importiert werden –
 * niemals in einer Client-Komponente.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kommune } from "./gebuehrenmodell";

const kommunenDir = fileURLToPath(new URL("../../../data/kommunen", import.meta.url));

let cache: Kommune[] | null = null;

/** Lädt alle Kommunen, alphabetisch nach Name sortiert (mit Cache). */
export function ladeKommunen(): Kommune[] {
  if (cache) return cache;
  const dateien = fs.readdirSync(kommunenDir).filter((f) => f.endsWith(".json"));
  const kommunen = dateien.map((f) => {
    const inhalt = fs.readFileSync(path.join(kommunenDir, f), "utf-8");
    return JSON.parse(inhalt) as Kommune;
  });
  kommunen.sort((a, b) => a.name.localeCompare(b.name, "de"));
  cache = kommunen;
  return kommunen;
}

/** Lädt eine einzelne Kommune per Slug. */
export function ladeKommune(slug: string): Kommune | undefined {
  return ladeKommunen().find((k) => k.slug === slug);
}

/**
 * Liefert bis zu n Kommunen ähnlicher Größe (nach Einwohnerzahl),
 * für die interne Verlinkung auf der Kommunenseite.
 */
export function aehnlicheKommunen(kommune: Kommune, n = 5): Kommune[] {
  const alle = ladeKommunen().filter((k) => k.slug !== kommune.slug);
  const einwohner = kommune.einwohner ?? 0;
  return [...alle]
    .sort(
      (a, b) =>
        Math.abs((a.einwohner ?? 0) - einwohner) - Math.abs((b.einwohner ?? 0) - einwohner),
    )
    .slice(0, n);
}
