import { describe, it, expect } from "vitest";
import { berechneBeitrag, type Eingaben } from "./berechnung";
import type { Kommune, ModellFormel } from "./gebuehrenmodell";

import berlinJson from "../../../data/kommunen/berlin.json";
import muenchenJson from "../../../data/kommunen/muenchen.json";
import koelnJson from "../../../data/kommunen/koeln.json";
import stuttgartJson from "../../../data/kommunen/stuttgart.json";
import nagoldJson from "../../../data/kommunen/nagold.json";
import torgauJson from "../../../data/kommunen/torgau.json";

const berlin = berlinJson as unknown as Kommune;
const muenchen = muenchenJson as unknown as Kommune;
const koeln = koelnJson as unknown as Kommune;
const stuttgart = stuttgartJson as unknown as Kommune;
const nagold = nagoldJson as unknown as Kommune;
const torgau = torgauJson as unknown as Kommune;

const basis: Eingaben = {
  einkommenJahr: 50000,
  alterMonate: 40,
  wochenstunden: 35,
  anzahlKinder: 1,
};

describe("beitragsfrei (Berlin)", () => {
  it("liefert 0 € Beitrag, aber Essensgeld", () => {
    const r = berechneBeitrag(berlin, basis);
    expect(r.beitragMonat).toBe(0);
    expect(r.beitragsfrei).toBe(true);
    expect(r.essensgeld?.betrag).toBe(23);
    expect(r.einkommensbasis).toBeNull();
  });
});

describe("pauschale (München)", () => {
  it("wählt Alters- und Betreuungsstufe unabhängig vom Einkommen", () => {
    // ue3 (40 Monate), 35 Std. -> Stufe "über 25 bis 35" -> 130 €
    const r = berechneBeitrag(muenchen, { ...basis, einkommenJahr: 200000 });
    expect(r.beitragMonat).toBe(130);
    expect(r.grundbeitrag).toBe(130);
  });

  it("Krippe (u3) ist teurer als Kindergarten (ue3)", () => {
    const u3 = berechneBeitrag(muenchen, { ...basis, alterMonate: 20 });
    const ue3 = berechneBeitrag(muenchen, { ...basis, alterMonate: 40 });
    expect(u3.beitragMonat).toBe(220);
    expect(ue3.beitragMonat).toBe(130);
  });

  it("Geschwisterrabatt 50 % ab 2 Kindern", () => {
    const einKind = berechneBeitrag(muenchen, { ...basis, anzahlKinder: 1 });
    const zweiKinder = berechneBeitrag(muenchen, { ...basis, anzahlKinder: 2 });
    expect(einKind.rabattBetrag).toBe(0);
    expect(einKind.beitragMonat).toBe(130);
    expect(zweiKinder.rabattBetrag).toBe(65);
    expect(zweiKinder.beitragMonat).toBe(65);
  });

  it("Betreuungsumfang exakt auf Stufengrenze (25 Std.) fällt in die untere Stufe", () => {
    const r = berechneBeitrag(muenchen, { ...basis, wochenstunden: 25 });
    // 25 Std. -> "bis 25 Std." -> ue3 90 €
    expect(r.beitragMonat).toBe(90);
  });

  it("26 Std. fällt in die nächste Stufe", () => {
    const r = berechneBeitrag(muenchen, { ...basis, wochenstunden: 26 });
    expect(r.beitragMonat).toBe(130);
  });
});

describe("einkommensstaffel (Köln)", () => {
  it("niedriges Einkommen (< 25000) ist beitragsfrei", () => {
    const r = berechneBeitrag(koeln, { ...basis, einkommenJahr: 20000, alterMonate: 30 });
    expect(r.beitragMonat).toBe(0);
  });

  it("Einkommen exakt auf Stufengrenze (37000) fällt in die obere Stufe", () => {
    // 37000 -> Stufe 37000-49000; u3 (30 Monate), 35 Std. -> 175 €
    const r = berechneBeitrag(koeln, {
      ...basis,
      einkommenJahr: 37000,
      alterMonate: 30,
      wochenstunden: 35,
    });
    expect(r.beitragMonat).toBe(175);
  });

  it("knapp unter der Grenze (36999) bleibt in der unteren Stufe", () => {
    const r = berechneBeitrag(koeln, {
      ...basis,
      einkommenJahr: 36999,
      alterMonate: 30,
      wochenstunden: 35,
    });
    expect(r.beitragMonat).toBe(90);
  });

  it("höchste, nach oben offene Stufe greift bei sehr hohem Einkommen", () => {
    const r = berechneBeitrag(koeln, {
      ...basis,
      einkommenJahr: 250000,
      alterMonate: 20,
      wochenstunden: 45,
    });
    expect(r.beitragMonat).toBe(560);
  });

  it("beitragsfreies Jahr: Kind ab 48 Monaten zahlt nichts, trotz hohem Einkommen", () => {
    const r = berechneBeitrag(koeln, {
      ...basis,
      einkommenJahr: 250000,
      alterMonate: 50,
      wochenstunden: 45,
    });
    expect(r.beitragMonat).toBe(0);
    expect(r.beitragsfrei).toBe(true);
    // Rechenweg dokumentiert das beitragsfreie Jahr.
    expect(r.rechenweg.some((s) => s.label === "Beitragsfreies Jahr")).toBe(true);
  });

  it("knapp unter der Altersgrenze (47 Monate) zahlt regulär", () => {
    const r = berechneBeitrag(koeln, {
      ...basis,
      einkommenJahr: 55000,
      alterMonate: 47,
      wochenstunden: 35,
    });
    // 49000-61000, ue3, 35 Std. -> 180 €
    expect(r.beitragMonat).toBe(180);
  });

  it("Zweitkind ist frei (zweitkind_frei) ab 2 Kindern", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 55000,
      alterMonate: 30,
      wochenstunden: 35,
      anzahlKinder: 2,
    };
    const r = berechneBeitrag(koeln, eingaben);
    // Grundbeitrag 49000-61000, u3, 35 Std. -> 275; Zweitkind frei -> 0
    expect(r.grundbeitrag).toBe(275);
    expect(r.rabattBetrag).toBe(275);
    expect(r.beitragMonat).toBe(0);
  });
});

describe("einkommensstaffel mit feinen Altersgruppen (Stuttgart)", () => {
  it("Kind wird 2 (24 Monate) wechselt von u2 zu 2_3", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 50000,
      alterMonate: 23,
      wochenstunden: 35,
      anzahlKinder: 1,
    };
    const u2 = berechneBeitrag(stuttgart, eingaben);
    const zwei_drei = berechneBeitrag(stuttgart, { ...eingaben, alterMonate: 24 });
    // 45000-60000, 35 Std.: u2 250, 2_3 210
    expect(u2.beitragMonat).toBe(250);
    expect(zwei_drei.beitragMonat).toBe(210);
  });

  it("Kind wird 3 (36 Monate) wechselt von 2_3 zu ue3", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 50000,
      alterMonate: 35,
      wochenstunden: 35,
      anzahlKinder: 1,
    };
    const zwei_drei = berechneBeitrag(stuttgart, eingaben);
    const ue3 = berechneBeitrag(stuttgart, { ...eingaben, alterMonate: 36 });
    // 45000-60000, 35 Std.: 2_3 210, ue3 135
    expect(zwei_drei.beitragMonat).toBe(210);
    expect(ue3.beitragMonat).toBe(135);
  });

  it("Einkommen exakt auf Grenze (60000) fällt in die obere Stufe", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 60000,
      alterMonate: 40,
      wochenstunden: 45,
      anzahlKinder: 1,
    };
    const r = berechneBeitrag(stuttgart, eingaben);
    // 60000-75000, ue3, 45 Std. -> 240
    expect(r.beitragMonat).toBe(240);
  });
});

describe("formel (Nagold)", () => {
  it("berechnet Prozentsatz vom Monatseinkommen mit Faktoren", () => {
    // 2 % von 60000/12=5000 = 100 €; ue3-Faktor 0.7, 35 Std.-Faktor 1.0 -> 70 €
    const eingaben: Eingaben = {
      einkommenJahr: 60000,
      alterMonate: 40,
      wochenstunden: 35,
      anzahlKinder: 1,
    };
    const r = berechneBeitrag(nagold, eingaben);
    expect(r.beitragMonat).toBe(70);
  });

  it("Mindestbeitrag greift bei sehr niedrigem Einkommen", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 12000,
      alterMonate: 40,
      wochenstunden: 25,
      anzahlKinder: 1,
    };
    // 2 % von 1000 = 20; *0.7*0.7 = 9.8 -> unter min 30 -> 30
    const r = berechneBeitrag(nagold, eingaben);
    expect(r.beitragMonat).toBe(30);
    expect(r.rechenweg.some((s) => s.label === "Deckelung")).toBe(true);
  });

  it("Höchstbeitrag greift bei sehr hohem Einkommen", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 240000,
      alterMonate: 20,
      wochenstunden: 45,
      anzahlKinder: 1,
    };
    // 2 % von 20000 = 400; *1.0*1.3 = 520 -> über max 350 -> 350
    const r = berechneBeitrag(nagold, eingaben);
    expect(r.beitragMonat).toBe(350);
  });

  it("Festbetrag-Geschwisterrabatt zieht 40 € ab", () => {
    const eingaben: Eingaben = {
      einkommenJahr: 60000,
      alterMonate: 40,
      wochenstunden: 35,
      anzahlKinder: 2,
    };
    // Grundbeitrag 70 €, minus 40 € -> 30 €
    const r = berechneBeitrag(nagold, eingaben);
    expect(r.grundbeitrag).toBe(70);
    expect(r.rabattBetrag).toBe(40);
    expect(r.beitragMonat).toBe(30);
  });

  it("Festbetrag-Rabatt kann den Beitrag nicht unter 0 drücken", () => {
    // synthetisches Modell: niedriger Grundbeitrag, hoher Festbetrag
    const modell = nagold.modell as ModellFormel;
    const kleineKommune: Kommune = {
      ...nagold,
      modell: { ...modell, min: 20, max: 350 },
      geschwisterrabatt: { typ: "festbetrag", wert: 999, ab_kinderzahl: 2 },
    };
    const r = berechneBeitrag(kleineKommune, {
      einkommenJahr: 12000,
      alterMonate: 40,
      wochenstunden: 25,
      anzahlKinder: 2,
    });
    expect(r.beitragMonat).toBe(0);
  });
});

describe("Konfidenz und Warnungen", () => {
  it("gibt die Konfidenz der Kommune weiter (unsicher bei Torgau)", () => {
    const r = berechneBeitrag(torgau, basis);
    expect(r.konfidenz).toBe("unsicher");
  });

  it("warnt, wenn das Alter über allen Altersgruppen liegt", () => {
    const r = berechneBeitrag(muenchen, { ...basis, alterMonate: 200 });
    expect(r.warnungen.length).toBeGreaterThan(0);
  });

  it("liefert immer einen nachvollziehbaren Rechenweg", () => {
    const r = berechneBeitrag(koeln, basis);
    expect(r.rechenweg.length).toBeGreaterThan(0);
    expect(r.rechenweg[0]).toHaveProperty("label");
    expect(r.rechenweg[0]).toHaveProperty("detail");
  });
});
