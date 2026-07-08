import { useMemo, useState } from "react";
import { berechneBeitrag, type Eingaben } from "../lib/berechnung";
import type { Kommune } from "../lib/gebuehrenmodell";

interface Props {
  kommune: Kommune;
}

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const euroCentFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function euro(betrag: number): string {
  return Number.isInteger(betrag) ? euroFormatter.format(betrag) : euroCentFormatter.format(betrag);
}

function alterLabel(monate: number): string {
  const jahre = Math.floor(monate / 12);
  const rest = monate % 12;
  if (jahre === 0) return `${rest} Monate`;
  if (rest === 0) return jahre === 1 ? "1 Jahr" : `${jahre} Jahre`;
  return `${jahre} J. ${rest} Mon.`;
}

export default function Rechner({ kommune }: Props) {
  const [einkommenJahr, setEinkommenJahr] = useState(45000);
  const [alterMonate, setAlterMonate] = useState(36);
  const [wochenstunden, setWochenstunden] = useState(35);
  const [anzahlKinder, setAnzahlKinder] = useState(1);
  const [rechenwegOffen, setRechenwegOffen] = useState(false);

  const eingaben: Eingaben = { einkommenJahr, alterMonate, wochenstunden, anzahlKinder };
  const ergebnis = useMemo(() => berechneBeitrag(kommune, eingaben), [
    kommune,
    einkommenJahr,
    alterMonate,
    wochenstunden,
    anzahlKinder,
  ]);

  const einkommensabhaengig = ergebnis.einkommensbasis !== null;
  const basisLabel = ergebnis.einkommensbasis === "netto" ? "Nettojahreseinkommen" : "Bruttojahreseinkommen";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Eingaben */}
      <form className="space-y-6" aria-label="Eingaben für die Gebührenberechnung">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="einkommen" className="font-medium text-slate-800">
              {basisLabel} des Haushalts
            </label>
            <span className="tabular-nums font-semibold text-brand-700">
              {euro(einkommenJahr)}
            </span>
          </div>
          <input
            id="einkommen"
            type="range"
            min={0}
            max={150000}
            step={1000}
            value={einkommenJahr}
            onChange={(e) => setEinkommenJahr(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <input
            type="number"
            min={0}
            step={1000}
            value={einkommenJahr}
            onChange={(e) => setEinkommenJahr(Math.max(0, Number(e.target.value)))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
            aria-label={`${basisLabel} in Euro`}
          />
          {!einkommensabhaengig && (
            <p className="mt-1 text-xs text-slate-500">
              In {kommune.name} ist der Beitrag nicht einkommensabhängig – das Einkommen beeinflusst
              das Ergebnis nicht.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="alter" className="font-medium text-slate-800">
              Alter des Kindes
            </label>
            <span className="tabular-nums font-semibold text-brand-700">{alterLabel(alterMonate)}</span>
          </div>
          <input
            id="alter"
            type="range"
            min={0}
            max={83}
            step={1}
            value={alterMonate}
            onChange={(e) => setAlterMonate(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="stunden" className="font-medium text-slate-800">
              Betreuungsumfang
            </label>
            <span className="tabular-nums font-semibold text-brand-700">
              {wochenstunden} Std./Woche
            </span>
          </div>
          <input
            id="stunden"
            type="range"
            min={10}
            max={50}
            step={1}
            value={wochenstunden}
            onChange={(e) => setWochenstunden(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
        </div>

        <div>
          <label htmlFor="kinder" className="font-medium text-slate-800">
            Kinder gleichzeitig in Betreuung
          </label>
          <select
            id="kinder"
            value={anzahlKinder}
            onChange={(e) => setAnzahlKinder(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "Kind" : "Kinder"}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* Ergebnis */}
      <div className="rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-100">
        <p className="text-sm font-medium text-brand-700">Voraussichtlicher Elternbeitrag</p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-brand-800 tabular-nums">
          {euro(ergebnis.beitragMonat)}
          <span className="text-lg font-medium text-brand-600"> / Monat</span>
        </p>

        {ergebnis.beitragsfrei && (
          <p className="mt-2 inline-block rounded-full bg-brand-600 px-3 py-1 text-sm font-medium text-white">
            Beitragsfrei
          </p>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          {ergebnis.rabattBetrag > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Geschwisterrabatt</dt>
              <dd className="tabular-nums font-medium text-green-700">
                −{euro(ergebnis.rabattBetrag)}
              </dd>
            </div>
          )}
          {ergebnis.essensgeld && (
            <div className="flex justify-between border-t border-brand-100 pt-2">
              <dt className="text-slate-600">
                zzgl. Verpflegung
                {ergebnis.essensgeld.hinweis && (
                  <span className="block text-xs text-slate-400">{ergebnis.essensgeld.hinweis}</span>
                )}
              </dt>
              <dd className="tabular-nums font-medium text-slate-700">
                {ergebnis.essensgeld.betrag != null
                  ? euro(ergebnis.essensgeld.betrag)
                  : ergebnis.essensgeld.von != null && ergebnis.essensgeld.bis != null
                    ? `${euro(ergebnis.essensgeld.von)}–${euro(ergebnis.essensgeld.bis)}`
                    : "individuell"}
              </dd>
            </div>
          )}
        </dl>

        {ergebnis.warnungen.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {ergebnis.warnungen.map((w, i) => (
              <li key={i}>⚠️ {w}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setRechenwegOffen((o) => !o)}
          className="mt-5 flex w-full items-center justify-between rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          aria-expanded={rechenwegOffen}
        >
          <span>Wie wurde das berechnet?</span>
          <span aria-hidden="true">{rechenwegOffen ? "▲" : "▼"}</span>
        </button>
        {rechenwegOffen && (
          <ol className="mt-3 space-y-3 text-sm">
            {ergebnis.rechenweg.map((schritt, i) => (
              <li key={i} className="rounded-lg bg-white p-3 ring-1 ring-brand-100">
                <p className="font-medium text-slate-800">{schritt.label}</p>
                <p className="mt-0.5 text-slate-600">{schritt.detail}</p>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-5 text-xs text-slate-500">
          Alle Angaben ohne Gewähr. Maßgeblich ist die aktuelle Satzung der Kommune.
        </p>
      </div>
    </div>
  );
}
