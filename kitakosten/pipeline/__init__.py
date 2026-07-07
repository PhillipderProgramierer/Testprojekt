"""KitaKosten-Datenpipeline: Satzungen laden, per LLM extrahieren, validieren."""

from pathlib import Path

# Wurzelverzeichnis des Repos (kitakosten/) und die relevanten Datenpfade.
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCHEMA_PATH = DATA_DIR / "schema" / "gebuehrenmodell.schema.json"
KOMMUNEN_DIR = DATA_DIR / "kommunen"
QUELLEN_DIR = DATA_DIR / "quellen"
KOMMUNEN_LISTE = Path(__file__).resolve().parent / "kommunen-liste.csv"

__all__ = [
    "BASE_DIR",
    "DATA_DIR",
    "SCHEMA_PATH",
    "KOMMUNEN_DIR",
    "QUELLEN_DIR",
    "KOMMUNEN_LISTE",
]
