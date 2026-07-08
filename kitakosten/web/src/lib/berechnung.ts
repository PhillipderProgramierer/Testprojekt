/**
 * Reine, framework-freie Berechnungslogik für den Kita-Elternbeitrag.
 *
 * Die gesamte Gebührenlogik steckt in den Daten (Gebührenmodell-JSON) –
 * diese Funktion interpretiert sie generisch. Das Ergebnis enthält immer
 * einen nachvollziehbaren Rechenweg ("Wie wurde das berechnet?").
 */

import type {
  Altersgruppe,
  Betreuungsstufe,
  Einkommensstufe,
  Kommune,
  Modell,
  ModellEinkommensstaffel,
  ModellFormel,
  ModellPauschale,
} from "./gebuehrenmodell";

export interface Eingaben {
  /** Haushalts-Jahreseinkommen (in der Basis, die das Modell vorgibt: brutto oder netto). */
  einkommenJahr: number;
  /** Alter des Kindes in Monaten. */
  alterMonate: number;
  /** Betreuungsumfang in Wochenstunden. */
  wochenstunden: number;
  /** Anzahl gleichzeitig im Haushalt betreuter Kinder. */
  anzahlKinder: number;
}

export interface Rechenschritt {
  label: string;
  detail: string;
}

export interface EssensgeldErgebnis {
  betrag: number | null;
  von: number | null;
  bis: number | null;
  hinweis: string | null;
}

export interface Ergebnis {
  /** Endgültiger monatlicher Elternbeitrag nach Rabatt & beitragsfreien Jahren, in Euro. */
  beitragMonat: number;
  /** Beitrag vor Anwendung des Geschwisterrabatts, in Euro. */
  grundbeitrag: number;
  /** Höhe des Geschwisterrabatts, in Euro. */
  rabattBetrag: number;
  /** true, wenn die Betreuung (in diesem Fall) beitragsfrei ist. */
  beitragsfrei: boolean;
  /** Verpflegungskosten, separat vom Elternbeitrag. */
  essensgeld: EssensgeldErgebnis | null;
  /** Auf welche Einkommensbasis sich die Berechnung bezieht (falls einkommensabhängig). */
  einkommensbasis: "brutto" | "netto" | null;
  konfidenz: Kommune["konfidenz"];
  /** Nachvollziehbarer Rechenweg für die "Wie wurde das berechnet?"-Anzeige. */
  rechenweg: Rechenschritt[];
  /** Hinweise aus den Kommunendaten (Essensgeld, Sonderregeln …). */
  hinweise: string[];
  /** Warnungen, z. B. wenn Alter/Stunden außerhalb der abgebildeten Bereiche liegen. */
  warnungen: string[];
}

/** Rundet auf zwei Nachkommastellen (Euro-Cent). */
function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100;
}

/**
 * Wählt die Altersgruppe, deren Bereich [von, bis) das Alter enthält.
 * Liegt das Alter außerhalb, wird die nächstgelegene Gruppe gewählt und eine
 * Warnung erzeugt.
 */
function findeAltersgruppe(
  gruppen: Altersgruppe[],
  alterMonate: number,
  warnungen: string[],
): Altersgruppe {
  const sortiert = [...gruppen].sort((a, b) => a.alter_von_monate - b.alter_von_monate);
  const treffer = sortiert.find(
    (g) => alterMonate >= g.alter_von_monate && alterMonate < g.alter_bis_monate,
  );
  if (treffer) return treffer;

  const erste = sortiert[0];
  const letzte = sortiert[sortiert.length - 1];
  if (alterMonate < erste.alter_von_monate) {
    warnungen.push(
      `Das Alter (${alterMonate} Monate) liegt unter der niedrigsten abgebildeten Altersgruppe. Es wird "${erste.label}" verwendet.`,
    );
    return erste;
  }
  warnungen.push(
    `Das Alter (${alterMonate} Monate) liegt über der höchsten abgebildeten Altersgruppe. Es wird "${letzte.label}" verwendet.`,
  );
  return letzte;
}

/**
 * Wählt die Betreuungsstufe, deren Bereich (von, bis] die Wochenstunden enthält.
 * Die Untergrenze ist exklusiv, die Obergrenze inklusive – so gehören z. B.
 * genau 25 Std. noch zur Stufe "bis 25 Std.". Die erste Stufe schließt ihre
 * Untergrenze mit ein.
 */
function findeBetreuungsstufe<T extends { stunden_von: number; stunden_bis: number; label: string }>(
  stufen: T[],
  stunden: number,
  warnungen: string[],
): T {
  const sortiert = [...stufen].sort((a, b) => a.stunden_von - b.stunden_von);
  const treffer = sortiert.find((s, i) => {
    const untenInklusive = i === 0;
    const obenOk = stunden <= s.stunden_bis;
    const untenOk = untenInklusive ? stunden >= s.stunden_von : stunden > s.stunden_von;
    return untenOk && obenOk;
  });
  if (treffer) return treffer;

  const erste = sortiert[0];
  const letzte = sortiert[sortiert.length - 1];
  if (stunden <= erste.stunden_von) {
    return erste;
  }
  warnungen.push(
    `Der Betreuungsumfang (${stunden} Std./Woche) liegt über der höchsten abgebildeten Stufe. Es wird "${letzte.label}" verwendet.`,
  );
  return letzte;
}

/** Wählt die Einkommensstufe, deren Bereich [von, bis) das Einkommen enthält. */
function findeEinkommensstufe(
  stufen: Einkommensstufe[],
  einkommen: number,
  warnungen: string[],
): Einkommensstufe {
  const sortiert = [...stufen].sort((a, b) => a.von - b.von);
  const treffer = sortiert.find(
    (s) => einkommen >= s.von && (s.bis === null || einkommen < s.bis),
  );
  if (treffer) return treffer;

  const erste = sortiert[0];
  if (einkommen < erste.von) {
    warnungen.push(
      `Das Einkommen liegt unter der niedrigsten Stufe. Es wird die niedrigste Stufe verwendet.`,
    );
    return erste;
  }
  return sortiert[sortiert.length - 1];
}

/** Liest den Beitrag für die Altersgruppe aus einer Betreuungsstufe. */
function beitragAusStufe(
  stufe: Betreuungsstufe,
  gruppe: Altersgruppe,
  warnungen: string[],
): number {
  const wert = stufe.betraege[gruppe.key];
  if (wert === undefined) {
    warnungen.push(
      `Für die Altersgruppe "${gruppe.label}" ist in der Stufe "${stufe.label}" kein Beitrag hinterlegt. Es wird 0 € angenommen.`,
    );
    return 0;
  }
  return wert;
}

function berechnePauschale(
  modell: ModellPauschale,
  eingaben: Eingaben,
  rechenweg: Rechenschritt[],
  warnungen: string[],
): number {
  const gruppe = findeAltersgruppe(modell.altersgruppen, eingaben.alterMonate, warnungen);
  const stufe = findeBetreuungsstufe(modell.betreuungsstufen, eingaben.wochenstunden, warnungen);
  const betrag = beitragAusStufe(stufe, gruppe, warnungen);
  rechenweg.push({
    label: "Modelltyp: feste Pauschale",
    detail: `Altersgruppe "${gruppe.label}", Betreuungsumfang "${stufe.label}" ⟶ ${betrag} € / Monat.`,
  });
  return betrag;
}

function berechneEinkommensstaffel(
  modell: ModellEinkommensstaffel,
  eingaben: Eingaben,
  rechenweg: Rechenschritt[],
  warnungen: string[],
): number {
  const gruppe = findeAltersgruppe(modell.altersgruppen, eingaben.alterMonate, warnungen);
  const einkommensstufe = findeEinkommensstufe(
    modell.einkommensstufen,
    eingaben.einkommenJahr,
    warnungen,
  );
  const obenLabel = einkommensstufe.bis === null ? "und mehr" : `bis ${einkommensstufe.bis} €`;
  const stufe = findeBetreuungsstufe(
    einkommensstufe.betreuungsstufen,
    eingaben.wochenstunden,
    warnungen,
  );
  const betrag = beitragAusStufe(stufe, gruppe, warnungen);
  rechenweg.push({
    label: "Modelltyp: Einkommensstaffel",
    detail: `Einkommensstufe ${einkommensstufe.von} € ${obenLabel} (${modell.einkommensbasis}), Altersgruppe "${gruppe.label}", Betreuungsumfang "${stufe.label}" ⟶ ${betrag} € / Monat.`,
  });
  return betrag;
}

function berechneFormel(
  modell: ModellFormel,
  eingaben: Eingaben,
  rechenweg: Rechenschritt[],
  warnungen: string[],
): number {
  const gruppe = findeAltersgruppe(modell.altersgruppen, eingaben.alterMonate, warnungen);
  const einkommenBasis =
    modell.basis === "monat" ? eingaben.einkommenJahr / 12 : eingaben.einkommenJahr;
  let roh = (modell.prozentsatz / 100) * einkommenBasis;
  if (modell.basis === "jahr") {
    roh = roh / 12;
  }

  const altersfaktor = modell.altersfaktoren?.[gruppe.key] ?? 1;

  let betreuungsfaktor = 1;
  let betreuungsLabel = "ohne Gewichtung";
  if (modell.betreuungsfaktoren && modell.betreuungsfaktoren.length > 0) {
    const bf = findeBetreuungsstufe(
      modell.betreuungsfaktoren,
      eingaben.wochenstunden,
      warnungen,
    );
    betreuungsfaktor = bf.faktor;
    betreuungsLabel = bf.label;
  }

  const vorDeckel = roh * altersfaktor * betreuungsfaktor;
  const nachDeckel = Math.min(Math.max(vorDeckel, modell.min), modell.max);

  const monatsEinkommen = eingaben.einkommenJahr / 12;
  rechenweg.push({
    label: "Modelltyp: Formel (Anteil vom Einkommen)",
    detail:
      `${modell.prozentsatz} % von ${runde(modell.basis === "monat" ? monatsEinkommen : eingaben.einkommenJahr)} € ` +
      `(${modell.basis === "monat" ? "Monat" : "Jahr"}, ${modell.einkommensbasis}) = ${runde(roh)} €; ` +
      `Altersfaktor ${altersfaktor} (${gruppe.label}), Betreuungsfaktor ${betreuungsfaktor} (${betreuungsLabel}) ` +
      `⟶ ${runde(vorDeckel)} €.`,
  });
  if (nachDeckel !== vorDeckel) {
    rechenweg.push({
      label: "Deckelung",
      detail:
        nachDeckel === modell.min
          ? `Mindestbeitrag ${modell.min} € greift.`
          : `Höchstbeitrag ${modell.max} € greift.`,
    });
  }
  return nachDeckel;
}

/** Berechnet den Grundbeitrag (vor Rabatt/beitragsfreien Jahren) je nach Modelltyp. */
function berechneGrundbeitrag(
  modell: Modell,
  eingaben: Eingaben,
  rechenweg: Rechenschritt[],
  warnungen: string[],
): number {
  switch (modell.typ) {
    case "beitragsfrei":
      rechenweg.push({
        label: "Modelltyp: beitragsfrei",
        detail: "Die Betreuung ist in dieser Kommune beitragsfrei (es kann Verpflegungsgeld anfallen).",
      });
      return 0;
    case "pauschale":
      return berechnePauschale(modell, eingaben, rechenweg, warnungen);
    case "einkommensstaffel":
      return berechneEinkommensstaffel(modell, eingaben, rechenweg, warnungen);
    case "formel":
      return berechneFormel(modell, eingaben, rechenweg, warnungen);
  }
}

function einkommensbasisVon(modell: Modell): "brutto" | "netto" | null {
  if (modell.typ === "einkommensstaffel" || modell.typ === "formel") {
    return modell.einkommensbasis;
  }
  return null;
}

/**
 * Zentrale Berechnungsfunktion.
 *
 * @param kommune Das vollständige Gebührenmodell einer Kommune.
 * @param eingaben Die Nutzereingaben.
 * @returns Ergebnis inkl. nachvollziehbarem Rechenweg.
 */
export function berechneBeitrag(kommune: Kommune, eingaben: Eingaben): Ergebnis {
  const rechenweg: Rechenschritt[] = [];
  const warnungen: string[] = [];

  let grundbeitrag = berechneGrundbeitrag(kommune.modell, eingaben, rechenweg, warnungen);
  let beitragsfrei = kommune.modell.typ === "beitragsfrei";

  // Beitragsfreie Jahre (z. B. letztes Kindergartenjahr vor Einschulung).
  const bfj = kommune.beitragsfreie_jahre;
  if (
    bfj &&
    bfj.ab_alter_monate !== null &&
    bfj.ab_alter_monate !== undefined &&
    eingaben.alterMonate >= bfj.ab_alter_monate
  ) {
    if (grundbeitrag > 0) {
      rechenweg.push({
        label: "Beitragsfreies Jahr",
        detail:
          bfj.beschreibung ??
          `Ab einem Alter von ${bfj.ab_alter_monate} Monaten ist die Betreuung beitragsfrei. Der Beitrag von ${runde(grundbeitrag)} € entfällt.`,
      });
    }
    grundbeitrag = 0;
    beitragsfrei = true;
  }

  // Geschwisterrabatt.
  const rabatt = kommune.geschwisterrabatt;
  let rabattBetrag = 0;
  if (rabatt && rabatt.typ !== "keiner" && grundbeitrag > 0) {
    const abKinderzahl = rabatt.ab_kinderzahl ?? 2;
    if (eingaben.anzahlKinder >= abKinderzahl) {
      switch (rabatt.typ) {
        case "prozent": {
          const prozent = rabatt.wert ?? 0;
          rabattBetrag = (grundbeitrag * prozent) / 100;
          rechenweg.push({
            label: "Geschwisterrabatt",
            detail: `${prozent} % Ermäßigung ab ${abKinderzahl} betreuten Kindern ⟶ −${runde(rabattBetrag)} €.`,
          });
          break;
        }
        case "festbetrag": {
          const festbetrag = rabatt.wert ?? 0;
          rabattBetrag = Math.min(festbetrag, grundbeitrag);
          rechenweg.push({
            label: "Geschwisterrabatt",
            detail: `Fester Abzug von ${festbetrag} € ab ${abKinderzahl} betreuten Kindern ⟶ −${runde(rabattBetrag)} €.`,
          });
          break;
        }
        case "zweitkind_frei": {
          rabattBetrag = grundbeitrag;
          rechenweg.push({
            label: "Geschwisterrabatt",
            detail: `Für Geschwisterkinder ist kein Beitrag zu zahlen ⟶ −${runde(rabattBetrag)} €.`,
          });
          break;
        }
      }
    }
  }

  const beitragMonat = runde(Math.max(0, grundbeitrag - rabattBetrag));

  // Essensgeld separat.
  let essensgeld: EssensgeldErgebnis | null = null;
  if (kommune.essensgeld) {
    essensgeld = {
      betrag: kommune.essensgeld.betrag ?? null,
      von: kommune.essensgeld.von ?? null,
      bis: kommune.essensgeld.bis ?? null,
      hinweis: kommune.essensgeld.hinweis ?? null,
    };
  }

  return {
    beitragMonat,
    grundbeitrag: runde(grundbeitrag),
    rabattBetrag: runde(rabattBetrag),
    beitragsfrei: beitragMonat === 0 && beitragsfrei,
    essensgeld,
    einkommensbasis: einkommensbasisVon(kommune.modell),
    konfidenz: kommune.konfidenz,
    rechenweg,
    hinweise: kommune.hinweise ?? [],
    warnungen,
  };
}
