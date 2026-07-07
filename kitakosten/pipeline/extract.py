"""extract.py – extrahiert aus einer Satzung ein Gebührenmodell-JSON per Anthropic-API.

- liest Rohdateien aus data/quellen/ (PDF/HTML)
- extrahiert Text (PDF via pypdf, HTML einfach entschlagwortet)
- schickt den Text mit einem präzisen System-Prompt an die Anthropic-API
- verlangt NUR valides JSON gemäß Schema, markiert es als konfidenz "extrahiert"
- speichert das Ergebnis in data/kommunen/<slug>.json

Benötigt die Umgebungsvariable ANTHROPIC_API_KEY. Das Modell ist über
ANTHROPIC_MODEL konfigurierbar (Standard: claude-sonnet-4-6).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from . import KOMMUNEN_DIR, QUELLEN_DIR, SCHEMA_PATH

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8000

SYSTEM_PROMPT = """\
Du bist ein präziser Datenextraktor für kommunale Kita-Elternbeitragssatzungen \
in Deutschland. Deine Aufgabe: Aus dem gegebenen Satzungstext ein JSON-Objekt \
erzeugen, das exakt dem mitgelieferten JSON-Schema entspricht.

Strikte Regeln:
- Gib AUSSCHLIESSLICH das JSON-Objekt zurück. Kein Fließtext, keine Erklärungen, \
kein Markdown-Codeblock.
- Halte dich exakt an das Schema (Feldnamen, Typen, erlaubte Werte).
- Wähle den passenden Modelltyp: "beitragsfrei", "pauschale", "einkommensstaffel" \
oder "formel".
- Erfinde keine Zahlen. Wenn eine Angabe fehlt oder unklar ist, lass optionale \
Felder weg bzw. setze sie auf null und setze "konfidenz" auf "unsicher".
- Setze "konfidenz" grundsätzlich auf "extrahiert" (niemals "verifiziert").
- Setze "quelle_url" auf die angegebene Quelle, falls vorhanden, sonst null.
- Datumsangaben im Format YYYY-MM-DD.
"""


def _text_aus_pdf(pfad: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(pfad))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _text_aus_html(pfad: Path) -> str:
    roh = pfad.read_text(encoding="utf-8", errors="ignore")
    # Skripte/Styles entfernen, Tags strippen – bewusst simpel gehalten.
    roh = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", roh, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", roh)
    return re.sub(r"\s+", " ", text).strip()


def _extrahiere_text(pfad: Path) -> str:
    if pfad.suffix.lower() == ".pdf":
        return _text_aus_pdf(pfad)
    return _text_aus_html(pfad)


def _nur_json(text: str) -> str:
    """Extrahiert das erste vollständige JSON-Objekt aus der Modellantwort."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip().rstrip("`").strip()
    start = text.find("{")
    ende = text.rfind("}")
    if start == -1 or ende == -1:
        raise ValueError("Keine JSON-Struktur in der Antwort gefunden.")
    return text[start : ende + 1]


def extrahiere_datei(pfad: Path, quelle_url: str | None = None) -> Path:
    """Extrahiert ein Gebührenmodell aus einer einzelnen Quelldatei."""
    import anthropic

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("Umgebungsvariable ANTHROPIC_API_KEY ist nicht gesetzt.")

    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    satzungstext = _extrahiere_text(pfad)
    if not satzungstext.strip():
        raise ValueError(f"Kein Text aus {pfad.name} extrahierbar.")

    client = anthropic.Anthropic()
    nutzer_prompt = (
        f"JSON-Schema:\n{schema}\n\n"
        f"Quelle-URL (für das Feld quelle_url): {quelle_url or 'null'}\n\n"
        f"Satzungstext:\n{satzungstext[:60000]}"
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": nutzer_prompt}],
    )
    antwort = "".join(block.text for block in response.content if block.type == "text")

    daten = json.loads(_nur_json(antwort))
    daten["konfidenz"] = "extrahiert"  # niemals als verifiziert markieren

    slug = daten.get("slug") or pfad.stem
    KOMMUNEN_DIR.mkdir(parents=True, exist_ok=True)
    ziel = KOMMUNEN_DIR / f"{slug}.json"
    ziel.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {pfad.name} → {ziel.name}")
    return ziel


def extract_all() -> int:
    """Extrahiert alle Dateien aus data/quellen/. Gibt die Anzahl zurück."""
    if not QUELLEN_DIR.exists():
        print(f"Quellenverzeichnis fehlt: {QUELLEN_DIR}")
        return 0

    dateien = [p for p in sorted(QUELLEN_DIR.iterdir()) if p.suffix.lower() in {".pdf", ".html"}]
    if not dateien:
        print("Keine Quelldateien in data/quellen/ gefunden. Zuerst 'fetch' ausführen.")
        return 0

    erfolg = 0
    for pfad in dateien:
        try:
            extrahiere_datei(pfad)
            erfolg += 1
        except Exception as exc:  # eine fehlgeschlagene Datei bricht den Lauf nicht ab
            print(f"✗ {pfad.name}: {exc}", file=sys.stderr)
    print(f"\nFertig. {erfolg}/{len(dateien)} Datei(en) extrahiert.")
    return erfolg


if __name__ == "__main__":
    extract_all()
