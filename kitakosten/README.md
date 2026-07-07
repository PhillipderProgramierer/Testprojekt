# KitaKosten

Programmatic-SEO-Website: ein **Kita-Gebühren-Rechner und -Vergleich für deutsche
Kommunen**. Nutzer geben Kommune, Bruttojahreseinkommen, Alter des Kindes,
Betreuungsumfang und Anzahl der Kinder ein und erhalten den zu erwartenden
monatlichen Elternbeitrag inkl. Hinweisen zu Essensgeld, Geschwisterrabatt und
beitragsfreien Jahren. Pro Kommune wird eine eigene, SEO-optimierte Seite statisch
generiert.

> ⚠️ **Vor dem Launch lesen:** Die mitgelieferten Kommunendaten sind
> **Beispiel-Werte** (`konfidenz: "extrahiert"` bzw. `"unsicher"`). Sie müssen
> gegen die **Original-Satzungen** der jeweiligen Kommune geprüft und die Felder
> `quelle_url` (aktuell `null`/TODO) ausgefüllt werden, bevor die Seite
> öffentlich geht. Siehe [Datenpflege](#datenpflege-workflow).

---

## Kernidee: Gebührenlogik ist Daten, kein Code

Jede Kommune wird durch **ein JSON-Dokument** beschrieben
(`data/kommunen/<slug>.json`), das dem Schema
`data/schema/gebuehrenmodell.schema.json` (JSON Schema Draft 2020-12) folgt.
Die Berechnungslogik (`web/src/lib/berechnung.ts`) interpretiert dieses JSON
**generisch** – es wird niemals kommunenspezifischer Code geschrieben. Damit
lassen sich vier reale Modelltypen abbilden:

| Typ | Beispiel | Beschreibung |
|-----|----------|--------------|
| `beitragsfrei` | Berlin | Betreuung kostenlos, ggf. nur Verpflegung |
| `pauschale` | München | Fester Betrag je Alter × Betreuungsumfang |
| `einkommensstaffel` | Köln, Stuttgart | Einkommensstufen × Betreuung × Alter |
| `formel` | Nagold | Prozentsatz vom Einkommen mit Min/Max-Deckel |

Zusätzlich pro Kommune: Geschwisterrabatt, Essensgeld, beitragsfreie Jahre,
Konfidenz-Stufe, Quelle, Stand der Satzung u. a.

---

## Projektstruktur

```
kitakosten/
├── data/
│   ├── schema/gebuehrenmodell.schema.json   # JSON Schema (Herzstück)
│   ├── kommunen/                            # eine JSON-Datei pro Kommune
│   └── quellen/                             # heruntergeladene Roh-Satzungen (gitignored)
├── pipeline/                                # Python-Datenpipeline
│   ├── fetch.py · extract.py · validate.py
│   └── kommunen-liste.csv
├── web/                                     # Astro-Website (SSG)
│   ├── src/lib/berechnung.ts                # reine Berechnungslogik (+ Vitest-Tests)
│   ├── src/components/Rechner.tsx           # interaktiver React-Island-Rechner
│   └── src/pages/…                          # Startseite, Kommunenseiten, Vergleich, Ratgeber …
├── .env.example
└── README.md
```

Die GitHub-Action liegt aus technischen Gründen im **Repo-Wurzelverzeichnis**
unter `.github/workflows/deploy.yml` (GitHub liest Workflows nur von dort).
Eine identische Standalone-Variante liegt zusätzlich unter
`kitakosten/.github/workflows/deploy.yml` für den Fall, dass `kitakosten/` als
eigenes Repository ausgelagert wird.

---

## Voraussetzungen

- Node.js ≥ 20
- Python ≥ 3.11
- Git

---

## Setup

```bash
# Website
cd kitakosten/web
npm install

# Pipeline (empfohlen: virtuelle Umgebung)
cd ../pipeline
python -m venv .venv && source .venv/bin/activate
pip install -e .        # installiert requests, pypdf, jsonschema, anthropic
```

Danach `.env.example` nach `.env` kopieren und ausfüllen (siehe Datei für Details).

---

## Website entwickeln

Alle Befehle in `kitakosten/web`:

```bash
npm run dev        # lokaler Dev-Server (http://localhost:4321)
npm test           # Vitest-Unit-Tests der Berechnungslogik
npm run build      # statischer Build nach dist/ (inkl. sitemap.xml)
npm run preview    # gebautes dist/ lokal ansehen
npm run typecheck  # astro check (TypeScript strict)
```

Die Website ist reines SSG (`output: 'static'`), mobile-first, ohne Cookies und
ohne Tracking. Pro Kommune entsteht eine Seite unter
`/kita-gebuehren/<slug>/` mit eigenem Title/Meta, JSON-LD (FAQPage +
WebApplication), crawlbarer Gebührentabelle, FAQ und internen Links.

### Neue Kommune manuell hinzufügen

1. `data/kommunen/<slug>.json` nach dem Schema anlegen (`slug` = Dateiname).
2. `cd pipeline && python -m pipeline validate` – muss fehlerfrei durchlaufen.
3. `cd ../web && npm run build` – die Seite wird automatisch generiert
   (`getStaticPaths` liest alle JSONs).

---

## Datenpflege-Workflow

Die Pipeline wird aus `kitakosten/` heraus bedient:

```bash
python -m pipeline fetch      # lädt Satzungen aus kommunen-liste.csv nach data/quellen/
python -m pipeline extract    # Satzung -> Gebührenmodell-JSON via Anthropic-API
python -m pipeline validate   # prüft alle JSONs gegen Schema + Plausibilität
```

- **fetch** liest `pipeline/kommunen-liste.csv` (Spalten: `name, bundesland,
  ags, einwohner, satzung_url, status`), lädt Satzungen höflich (1 Request/2 s,
  Kontakt-User-Agent, robots.txt) nach `data/quellen/` (gitignored).
- **extract** extrahiert PDF-/HTML-Text, schickt ihn an die Anthropic-API
  (Modell `claude-sonnet-4-6`, konfigurierbar über `ANTHROPIC_MODEL`) und
  speichert das Ergebnis als `data/kommunen/<slug>.json` mit
  `konfidenz: "extrahiert"`. Benötigt `ANTHROPIC_API_KEY`.
- **validate** prüft JSON-Schema **und** Plausibilität (Beiträge 0–1500 €,
  lückenlose/überschneidungsfreie Stufen, gültige Datumsangaben, Slug =
  Dateiname). Exit-Code ≠ 0 bricht die CI.

### Verifizierung vor dem Launch (wichtig!)

Extrahierte oder handgepflegte Daten sind mit `konfidenz: "extrahiert"` bzw.
`"unsicher"` markiert; die Website zeigt dafür einen deutlichen Hinweis an. Vor
dem Livegang jede Kommune gegen die **Original-Satzung** prüfen, `quelle_url`
und `satzung_stand` setzen und die Konfidenz auf `"verifiziert"` heben. Erst
dann verschwindet der Warnhinweis.

Die sechs mitgelieferten Kommunen (Berlin, München, Köln, Stuttgart, Nagold,
Torgau) decken alle Modelltypen ab, sind aber **Demonstrationsdaten** mit
plausiblen, jedoch nicht amtlich bestätigten Beträgen und ohne Quellen-URLs.

---

## Deployment auf Cloudflare Pages

Die CI (`.github/workflows/deploy.yml`) validiert bei jedem Push die Daten, baut
die Website und deployt bei Push auf `main` auf Cloudflare Pages – **sofern ein
Cloudflare-API-Token hinterlegt ist**. Ohne Token laufen Validierung, Tests und
Build trotzdem (nur der Deploy-Schritt wird übersprungen).

### Schritt für Schritt

1. **Cloudflare-Account** anlegen (falls nicht vorhanden) auf
   <https://dash.cloudflare.com>.
2. **Pages-Projekt anlegen:** Dashboard → *Workers & Pages* → *Create* →
   *Pages* → *Connect to Git* (oder ein leeres „Direct Upload"-Projekt namens
   `kitakosten` anlegen; die CI lädt das gebaute `dist/` per Wrangler hoch).
3. **API-Token erstellen:** Profil → *API Tokens* → *Create Token* → Vorlage
   *„Edit Cloudflare Workers"* oder ein eigenes Token mit der Berechtigung
   *Account → Cloudflare Pages → Edit*. Token kopieren.
4. **Account-ID** kopieren (rechte Seitenleiste im Dashboard).
5. **GitHub-Secrets & -Variables** setzen (Repo → *Settings* → *Secrets and
   variables* → *Actions*):
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables: `CLOUDFLARE_PROJECT_NAME` (z. B. `kitakosten`),
     `SITE_URL` (z. B. `https://kitakosten.de`)
6. **Push auf `main`** → die Action baut und deployt automatisch.

### Domain anbinden

Im Pages-Projekt → *Custom domains* → *Set up a custom domain* → Domain
eintragen. Läuft die Domain über Cloudflare, wird der DNS-Eintrag automatisch
gesetzt; sonst den angezeigten CNAME beim eigenen DNS-Anbieter hinterlegen.
Anschließend `SITE_URL` auf die echte Domain setzen (GitHub-Variable), damit
kanonische URLs und die Sitemap korrekt sind.

### Analytics (optional, später)

Bewusst kein Tracking-Skript eingebaut. Für datenschutzfreundliche Statistik
lässt sich später **Cloudflare Web Analytics** (cookiefrei) im Pages-Projekt
aktivieren; der Datenschutzhinweis (`src/pages/datenschutz.astro`) ist dafür
bereits vorbereitet.

---

## Rechtliches

`src/pages/impressum.astro` und `src/pages/datenschutz.astro` enthalten klar
markierte `[PLATZHALTER: …]`-Felder, die vor dem Launch ausgefüllt werden
müssen. Jede Kommunenseite trägt einen Disclaimer: „Alle Angaben ohne Gewähr,
keine Rechtsberatung, maßgeblich ist die aktuelle Satzung der Kommune."

---

## Tests

```bash
cd web && npm test          # 24 Vitest-Unit-Tests (alle Modelltypen + Randfälle)
cd pipeline && python -m pipeline validate   # Daten-Validierung
```
