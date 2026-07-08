"""validate.py – validiert alle Kommunen-JSONs gegen Schema + Plausibilitätsregeln.

Prüft:
- JSON-Schema (Draft 2020-12)
- Beiträge im Bereich 0–1500 €
- Einkommens- und Betreuungsstufen lückenlos und überschneidungsfrei
- Slug passt zum Dateinamen, Datumsfelder sind gültig

Exit-Code != 0 bei Fehlern, damit CI bricht.
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from . import KOMMUNEN_DIR, SCHEMA_PATH

MAX_BEITRAG = 1500.0


def _lade_schema() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _pruefe_datum(wert: str, feld: str, fehler: list[str]) -> None:
    try:
        dt.date.fromisoformat(wert)
    except (ValueError, TypeError):
        fehler.append(f"{feld}: '{wert}' ist kein gültiges ISO-Datum (YYYY-MM-DD).")


def _pruefe_betreuungsstufen(stufen: list[dict], kontext: str, fehler: list[str]) -> None:
    """Betreuungsstufen müssen aufsteigend, lückenlos und überschneidungsfrei sein."""
    sortiert = sorted(stufen, key=lambda s: s["stunden_von"])
    for i, stufe in enumerate(sortiert):
        if stufe["stunden_bis"] <= stufe["stunden_von"]:
            fehler.append(f"{kontext}: Stufe '{stufe['label']}' hat bis <= von.")
        for wert in stufe["betraege"].values():
            if not (0 <= wert <= MAX_BEITRAG):
                fehler.append(
                    f"{kontext}: Beitrag {wert} € in '{stufe['label']}' außerhalb 0–{MAX_BEITRAG:.0f} €."
                )
        if i > 0:
            vorher = sortiert[i - 1]
            if stufe["stunden_von"] < vorher["stunden_bis"]:
                fehler.append(
                    f"{kontext}: Betreuungsstufen '{vorher['label']}' und '{stufe['label']}' überschneiden sich."
                )
            elif stufe["stunden_von"] > vorher["stunden_bis"]:
                fehler.append(
                    f"{kontext}: Lücke zwischen '{vorher['label']}' und '{stufe['label']}'."
                )


def _pruefe_einkommensstufen(stufen: list[dict], fehler: list[str]) -> None:
    sortiert = sorted(stufen, key=lambda s: s["von"])
    for i, stufe in enumerate(sortiert):
        bis = stufe["bis"]
        if bis is not None and bis <= stufe["von"]:
            fehler.append(f"Einkommensstufe ab {stufe['von']}: bis <= von.")
        if i > 0:
            vorher = sortiert[i - 1]
            if vorher["bis"] is None:
                fehler.append(
                    f"Einkommensstufe ab {vorher['von']} ist offen (bis=null), aber es folgen weitere Stufen."
                )
            elif stufe["von"] < vorher["bis"]:
                fehler.append(
                    f"Einkommensstufen ab {vorher['von']} und {stufe['von']} überschneiden sich."
                )
            elif stufe["von"] > vorher["bis"]:
                fehler.append(
                    f"Lücke zwischen Einkommensstufen bei {vorher['bis']} und {stufe['von']}."
                )
        _pruefe_betreuungsstufen(
            stufe["betreuungsstufen"], f"Einkommensstufe ab {stufe['von']}", fehler
        )


def _plausibilitaet(daten: dict, dateiname: str, fehler: list[str]) -> None:
    if daten.get("slug") and daten["slug"] != Path(dateiname).stem:
        fehler.append(
            f"Slug '{daten['slug']}' passt nicht zum Dateinamen '{dateiname}'."
        )

    for feld in ("satzung_stand", "zuletzt_geprueft"):
        if feld in daten:
            _pruefe_datum(daten[feld], feld, fehler)

    modell = daten.get("modell", {})
    typ = modell.get("typ")
    if typ == "pauschale":
        _pruefe_betreuungsstufen(modell["betreuungsstufen"], "Pauschale", fehler)
    elif typ == "einkommensstaffel":
        _pruefe_einkommensstufen(modell["einkommensstufen"], fehler)
    elif typ == "formel":
        if modell["min"] > modell["max"]:
            fehler.append("Formel: min > max.")
        if modell["max"] > MAX_BEITRAG:
            fehler.append(f"Formel: max {modell['max']} € über {MAX_BEITRAG:.0f} €.")


def validate_all() -> int:
    """Validiert alle Kommunen-JSONs. Gibt 0 zurück, wenn alles gültig ist, sonst 1."""
    validator = _lade_schema()
    dateien = sorted(KOMMUNEN_DIR.glob("*.json"))
    if not dateien:
        print(f"Keine Kommunen-Dateien in {KOMMUNEN_DIR} gefunden.")
        return 1

    gesamt_fehler = 0
    for pfad in dateien:
        fehler: list[str] = []
        try:
            daten = json.loads(pfad.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"✗ {pfad.name}: ungültiges JSON ({exc}).")
            gesamt_fehler += 1
            continue

        for err in sorted(validator.iter_errors(daten), key=lambda e: e.path):
            pfad_str = "/".join(str(p) for p in err.path) or "(Wurzel)"
            fehler.append(f"Schema: {pfad_str}: {err.message}")

        # Plausibilitätsprüfungen nur, wenn das Schema bereits passt.
        if not fehler:
            _plausibilitaet(daten, pfad.name, fehler)

        if fehler:
            print(f"✗ {pfad.name}:")
            for f in fehler:
                print(f"    - {f}")
            gesamt_fehler += len(fehler)
        else:
            print(f"✓ {pfad.name}")

    if gesamt_fehler:
        print(f"\n{gesamt_fehler} Fehler in {len(dateien)} Datei(en).")
        return 1
    print(f"\nAlle {len(dateien)} Datei(en) gültig.")
    return 0


if __name__ == "__main__":
    sys.exit(validate_all())
