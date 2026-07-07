"""CLI-Einstiegspunkt: python -m pipeline fetch|extract|validate"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="KitaKosten-Datenpipeline: Satzungen laden, extrahieren, validieren.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch", help="Satzungen aus kommunen-liste.csv herunterladen.")
    sub.add_parser("extract", help="Satzungen per LLM zu Gebührenmodell-JSON extrahieren.")
    sub.add_parser("validate", help="Alle Kommunen-JSONs gegen Schema + Plausibilität prüfen.")

    args = parser.parse_args(argv)

    if args.command == "fetch":
        from .fetch import fetch_all

        fetch_all()
        return 0
    if args.command == "extract":
        from .extract import extract_all

        extract_all()
        return 0
    if args.command == "validate":
        from .validate import validate_all

        return validate_all()

    parser.error(f"Unbekannter Befehl: {args.command}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
