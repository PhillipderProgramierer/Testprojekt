/** Formatierungs-Helfer für die Anzeige (Euro, Datum, Alter). */

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const euroCentFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatiert einen Euro-Betrag. Ganze Beträge ohne Nachkommastellen. */
export function euro(betrag: number): string {
  return Number.isInteger(betrag) ? euroFormatter.format(betrag) : euroCentFormatter.format(betrag);
}

/** Formatiert ein ISO-Datum (YYYY-MM-DD) als deutsches Datum. */
export function datum(iso: string): string {
  const [jahr, monat, tag] = iso.split("-");
  if (!jahr || !monat || !tag) return iso;
  return `${tag}.${monat}.${jahr}`;
}

/** Wandelt ein Alter in Monaten in eine lesbare Angabe um. */
export function alterLesbar(monate: number): string {
  const jahre = Math.floor(monate / 12);
  const restMonate = monate % 12;
  if (jahre === 0) return `${restMonate} Monate`;
  if (restMonate === 0) return jahre === 1 ? "1 Jahr" : `${jahre} Jahre`;
  return `${jahre} ${jahre === 1 ? "Jahr" : "Jahre"} ${restMonate} Mon.`;
}
