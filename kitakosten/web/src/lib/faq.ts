/** Generiert FAQ-Einträge aus den Kommunendaten (für Anzeige und JSON-LD). */

import type { Kommune } from "./gebuehrenmodell";
import { euro } from "./format";

export interface FaqEintrag {
  frage: string;
  antwort: string;
}

function modellBeschreibung(kommune: Kommune): string {
  const m = kommune.modell;
  switch (m.typ) {
    case "beitragsfrei":
      return `In ${kommune.name} ist die Kindertagesbetreuung beitragsfrei. Es fällt in der Regel nur ein Beitrag für die Verpflegung an.`;
    case "pauschale":
      return `In ${kommune.name} wird ein fester monatlicher Elternbeitrag erhoben, der vom Alter des Kindes und vom Betreuungsumfang abhängt – unabhängig vom Einkommen.`;
    case "einkommensstaffel":
      return `In ${kommune.name} richtet sich der Elternbeitrag nach dem ${m.einkommensbasis === "netto" ? "Netto" : "Brutto"}jahreseinkommen des Haushalts, dem Alter des Kindes und dem Betreuungsumfang.`;
    case "formel":
      return `In ${kommune.name} wird der Elternbeitrag als prozentualer Anteil (${m.prozentsatz} %) des ${m.einkommensbasis === "netto" ? "Netto" : "Brutto"}einkommens berechnet, mindestens ${euro(m.min)} und höchstens ${euro(m.max)} pro Monat.`;
  }
}

export function faqFuerKommune(kommune: Kommune): FaqEintrag[] {
  const eintraege: FaqEintrag[] = [];

  eintraege.push({
    frage: `Wie hoch sind die Kita-Gebühren in ${kommune.name}?`,
    antwort:
      modellBeschreibung(kommune) +
      " Mit dem Rechner auf dieser Seite können Sie Ihren voraussichtlichen Beitrag anhand Ihrer persönlichen Angaben ermitteln.",
  });

  eintraege.push({
    frage: `Wovon hängt der Kita-Beitrag in ${kommune.name} ab?`,
    antwort: modellBeschreibung(kommune),
  });

  const bfj = kommune.beitragsfreie_jahre;
  if (kommune.modell.typ === "beitragsfrei") {
    eintraege.push({
      frage: `Ist die Kita in ${kommune.name} kostenlos?`,
      antwort: `Die Betreuung selbst ist in ${kommune.name} beitragsfrei. Für die Verpflegung kann ein separater Beitrag anfallen.`,
    });
  } else if (bfj && bfj.anzahl && bfj.anzahl > 0) {
    eintraege.push({
      frage: `Gibt es in ${kommune.name} beitragsfreie Kita-Jahre?`,
      antwort:
        bfj.beschreibung ??
        `Ja, in ${kommune.name} sind ${bfj.anzahl} Kita-Jahr(e) beitragsfrei. Für die Verpflegung kann weiterhin ein Beitrag anfallen.`,
    });
  }

  const rabatt = kommune.geschwisterrabatt;
  if (rabatt && rabatt.typ !== "keiner") {
    let antwort: string;
    switch (rabatt.typ) {
      case "prozent":
        antwort = `Ja, für jedes weitere gleichzeitig betreute Kind wird der Beitrag um ${rabatt.wert} % ermäßigt.`;
        break;
      case "festbetrag":
        antwort = `Ja, für jedes weitere gleichzeitig betreute Kind wird ein fester Betrag von ${euro(rabatt.wert ?? 0)} vom Beitrag abgezogen.`;
        break;
      case "zweitkind_frei":
        antwort = `Ja, werden mehrere Kinder eines Haushalts gleichzeitig betreut, ist für die Geschwisterkinder kein Beitrag zu zahlen.`;
        break;
      default:
        antwort = rabatt.beschreibung ?? "Ja, es gibt eine Geschwisterermäßigung.";
    }
    eintraege.push({
      frage: `Gibt es in ${kommune.name} einen Geschwisterrabatt?`,
      antwort,
    });
  }

  if (kommune.essensgeld) {
    const e = kommune.essensgeld;
    let betragText: string;
    if (e.betrag != null) betragText = `rund ${euro(e.betrag)} pro Monat`;
    else if (e.von != null && e.bis != null) betragText = `je nach Einrichtung etwa ${euro(e.von)} bis ${euro(e.bis)} pro Monat`;
    else betragText = "je nach Einrichtung unterschiedlich";
    eintraege.push({
      frage: `Was kostet die Verpflegung in ${kommune.name}?`,
      antwort: `Die Verpflegung (Essensgeld) wird zusätzlich zum Elternbeitrag erhoben und beträgt ${betragText}.${e.hinweis ? " " + e.hinweis : ""}`,
    });
  }

  return eintraege.slice(0, 5);
}
