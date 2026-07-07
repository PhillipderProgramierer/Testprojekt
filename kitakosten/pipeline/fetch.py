"""fetch.py – lädt Satzungen von Kommunen-URLs höflich herunter.

- liest kommunen-liste.csv
- lädt Satzungen (PDF/HTML) nach data/quellen/
- Rate-Limit von 1 Request / 2 s, respektiert robots.txt
- User-Agent mit Kontakt-Mail (aus env KITAKOSTEN_CONTACT)
"""

from __future__ import annotations

import csv
import os
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests

from . import KOMMUNEN_LISTE, QUELLEN_DIR

CONTACT = os.environ.get("KITAKOSTEN_CONTACT", "kontakt@example.org")
USER_AGENT = f"KitaKostenBot/0.1 (+{CONTACT})"
RATE_LIMIT_SECONDS = 2.0


def _slugify(name: str) -> str:
    """Sehr einfacher Slug für Dateinamen (Umlaute -> ae/oe/ue/ss)."""
    ersetzungen = {
        "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
        "Ä": "ae", "Ö": "oe", "Ü": "ue", " ": "-",
    }
    slug = name.strip().lower()
    for alt, neu in ersetzungen.items():
        slug = slug.replace(alt.lower(), neu)
    return "".join(c for c in slug if c.isalnum() or c == "-")


def _darf_laden(url: str) -> bool:
    """Prüft robots.txt der Ziel-Domain."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        # Keine robots.txt erreichbar -> vorsichtshalber erlauben, aber mit Rate-Limit.
        return True
    return rp.can_fetch(USER_AGENT, url)


def _endung(url: str, content_type: str) -> str:
    if url.lower().endswith(".pdf") or "application/pdf" in content_type:
        return "pdf"
    return "html"


def fetch_all() -> int:
    """Lädt alle Satzungen mit URL. Gibt die Anzahl geladener Dateien zurück."""
    QUELLEN_DIR.mkdir(parents=True, exist_ok=True)

    if not KOMMUNEN_LISTE.exists():
        print(f"Kommunen-Liste nicht gefunden: {KOMMUNEN_LISTE}")
        return 0

    geladen = 0
    with KOMMUNEN_LISTE.open(encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            url = (row.get("satzung_url") or "").strip()
            name = (row.get("name") or "").strip()
            if not url:
                print(f"– {name}: keine Satzungs-URL, übersprungen.")
                continue
            if not _darf_laden(url):
                print(f"✗ {name}: robots.txt verbietet {url}, übersprungen.")
                continue

            print(f"→ {name}: lade {url} …")
            try:
                resp = requests.get(
                    url,
                    headers={"User-Agent": USER_AGENT},
                    timeout=30,
                )
                resp.raise_for_status()
            except requests.RequestException as exc:
                print(f"✗ {name}: Fehler beim Laden ({exc}).")
                time.sleep(RATE_LIMIT_SECONDS)
                continue

            endung = _endung(url, resp.headers.get("Content-Type", ""))
            ziel = QUELLEN_DIR / f"{_slugify(name)}.{endung}"
            ziel.write_bytes(resp.content)
            print(f"✓ {name}: gespeichert unter {ziel.relative_to(QUELLEN_DIR.parent.parent)}")
            geladen += 1

            time.sleep(RATE_LIMIT_SECONDS)

    print(f"\nFertig. {geladen} Datei(en) geladen.")
    return geladen


if __name__ == "__main__":
    fetch_all()
