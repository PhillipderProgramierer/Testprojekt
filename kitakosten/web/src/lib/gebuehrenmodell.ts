/**
 * TypeScript-Typen, die 1:1 dem JSON-Schema
 * data/schema/gebuehrenmodell.schema.json entsprechen.
 *
 * Diese Typen beschreiben die Daten – die Berechnungslogik in berechnung.ts
 * interpretiert sie generisch. Es wird niemals kommunenspezifischer Code
 * geschrieben.
 */

export type Konfidenz = "verifiziert" | "extrahiert" | "unsicher";
export type Einkommensbasis = "brutto" | "netto";

export interface Altersgruppe {
  key: string;
  label: string;
  alter_von_monate: number;
  alter_bis_monate: number;
}

export interface Betreuungsstufe {
  stunden_von: number;
  stunden_bis: number;
  label: string;
  /** Monatlicher Beitrag in Euro je Altersgruppen-Key. */
  betraege: Record<string, number>;
}

export interface ModellBeitragsfrei {
  typ: "beitragsfrei";
  beschreibung?: string;
}

export interface ModellPauschale {
  typ: "pauschale";
  altersgruppen: Altersgruppe[];
  betreuungsstufen: Betreuungsstufe[];
  beschreibung?: string;
}

export interface Einkommensstufe {
  von: number;
  bis: number | null;
  betreuungsstufen: Betreuungsstufe[];
}

export interface ModellEinkommensstaffel {
  typ: "einkommensstaffel";
  einkommensbasis: Einkommensbasis;
  altersgruppen: Altersgruppe[];
  einkommensstufen: Einkommensstufe[];
  beschreibung?: string;
}

export interface Betreuungsfaktor {
  stunden_von: number;
  stunden_bis: number;
  faktor: number;
  label: string;
}

export interface ModellFormel {
  typ: "formel";
  einkommensbasis: Einkommensbasis;
  prozentsatz: number;
  basis: "monat" | "jahr";
  min: number;
  max: number;
  altersgruppen: Altersgruppe[];
  altersfaktoren?: Record<string, number>;
  betreuungsfaktoren?: Betreuungsfaktor[];
  beschreibung?: string;
}

export type Modell =
  | ModellBeitragsfrei
  | ModellPauschale
  | ModellEinkommensstaffel
  | ModellFormel;

export interface Geschwisterrabatt {
  typ: "prozent" | "festbetrag" | "zweitkind_frei" | "keiner";
  wert?: number | null;
  ab_kinderzahl?: number;
  beschreibung?: string;
}

export interface Essensgeld {
  betrag?: number | null;
  von?: number | null;
  bis?: number | null;
  hinweis?: string;
}

export interface BeitragsfreieJahre {
  anzahl?: number;
  ab_alter_monate?: number | null;
  beschreibung?: string;
}

export interface Kommune {
  name: string;
  slug: string;
  ags?: string | null;
  bundesland: string;
  einwohner?: number | null;
  modell: Modell;
  geschwisterrabatt?: Geschwisterrabatt;
  essensgeld?: Essensgeld | null;
  beitragsfreie_jahre?: BeitragsfreieJahre | null;
  hinweise?: string[];
  quelle_url?: string | null;
  satzung_stand: string;
  zuletzt_geprueft: string;
  konfidenz: Konfidenz;
}
