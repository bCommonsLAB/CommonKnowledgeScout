"use client"

/**
 * Zusammenfassung des Wizards (C2): jede geltende Entscheidung mit Stand aus
 * `pruefeEinrichtung`. Pflicht offen blockiert die Anlage, Empfohlenes darf
 * offen bleiben und steht sichtbar als „offen" da.
 */

import { Badge } from "@ks/ui"
import type { EinrichtungsPruefung, EntscheidungsStand } from "@/lib/library-setup/typen"

const GEWICHT_LABEL: Record<EntscheidungsStand["gewicht"], string> = { pflicht: "Pflicht", empfohlen: "empfohlen", spaeter: "später" }

function Zeile({ stand }: { stand: EntscheidungsStand }) {
  const offen = stand.status === "offen"
  return (
    <li className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0">
        <span className={offen && stand.gewicht === "pflicht" ? "text-destructive font-medium" : ""}>{stand.titel}</span>
        {offen && stand.vorgabe && <span className="block text-xs text-muted-foreground">ohne Antwort: {stand.vorgabe}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{GEWICHT_LABEL[stand.gewicht]}</Badge>
        <Badge variant={offen ? (stand.gewicht === "pflicht" ? "destructive" : "secondary") : "default"} className="text-[10px]">
          {offen ? "offen" : "beantwortet"}
        </Badge>
      </span>
    </li>
  )
}

interface Props {
  pruefung: EinrichtungsPruefung | null
  fehler: string | null
}

export function SchrittZusammenfassung({ pruefung, fehler }: Props) {
  if (fehler) return <p className="text-sm text-destructive">Eine Antwort ist ungültig: {fehler}</p>
  if (!pruefung) return null
  const jetzt = pruefung.alle.filter((s) => s.gewicht !== "spaeter")
  const spaeter = pruefung.alle.filter((s) => s.gewicht === "spaeter")
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Einrichtung: <strong>{pruefung.erledigt} von {pruefung.gesamt}</strong>
        {pruefung.pflichtOffen ? " — Pflichtangaben fehlen noch." : pruefung.vollstaendig ? " — vollständig." : " — Offenes lässt sich später in den Settings nachtragen."}
      </p>
      <ul className="divide-y">{jetzt.map((s) => <Zeile key={s.schluessel} stand={s} />)}</ul>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Später in den Settings ({spaeter.length})</summary>
        <ul className="divide-y mt-2">{spaeter.map((s) => <Zeile key={s.schluessel} stand={s} />)}</ul>
      </details>
    </div>
  )
}
