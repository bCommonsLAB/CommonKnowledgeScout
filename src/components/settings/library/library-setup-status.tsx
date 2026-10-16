"use client"

/**
 * „Einrichtung: n von m" der aktiven Bibliothek in der Settings-Uebersicht
 * (Plan speicher-verbindungen-und-library-anlage, C2). Quelle ist derselbe
 * Entscheidungskatalog wie Anlege-Wizard und `bibliothek_pruefen`; offene
 * Pflicht- und empfohlene Entscheidungen verlinken auf die Seite, die sie setzt.
 */

import Link from "next/link"
import { useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { Card, CardContent } from "@ks/ui"
import { useActiveLibrary } from "@ks/shell/react"
import { pruefeEinrichtung } from "@/lib/library-setup/pruefung"
import type { EinrichtungsPruefung, Schritt } from "@/lib/library-setup/typen"

/** Settings-Seite je Wizard-Schritt — dort wird die Entscheidung nachgetragen. */
const SEITE_JE_SCHRITT: Record<Schritt, string> = {
  grundlagen: "/settings/archive",
  quelle: "/settings/archive",
  verarbeitung: "/settings/advanced/extraktion",
  finden: "/settings/explore",
  story: "/settings/story",
  erfassen: "/settings/archive",
  settings: "/settings/advanced/suche-ki",
}

export function LibrarySetupStatus() {
  const library = useActiveLibrary()
  const ergebnis = useMemo((): { pruefung: EinrichtungsPruefung | null; fehler: string | null } => {
    if (!library) return { pruefung: null, fehler: null }
    try {
      return { pruefung: pruefeEinrichtung(library), fehler: null }
    } catch (error) {
      console.error("[LibrarySetupStatus] Einrichtung nicht pruefbar:", error)
      return { pruefung: null, fehler: error instanceof Error ? error.message : String(error) }
    }
  }, [library])

  if (!library) return null
  if (ergebnis.fehler) return <p className="text-sm text-destructive">Einrichtung nicht prüfbar: {ergebnis.fehler}</p>
  const pruefung = ergebnis.pruefung
  if (!pruefung) return null

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="text-sm">
          Einrichtung von „{library.label}“: <strong>{pruefung.erledigt} von {pruefung.gesamt}</strong>
          {pruefung.vollstaendig ? " — vollständig." : ""}
        </p>
        {pruefung.offen.length > 0 && (
          <nav className="flex flex-col gap-1">
            {pruefung.offen.map((s) => (
              <Link
                key={s.schluessel}
                href={SEITE_JE_SCHRITT[s.schritt]}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted"
              >
                <span className={s.gewicht === "pflicht" ? "text-destructive" : ""}>
                  {s.titel} <span className="text-xs text-muted-foreground">({s.gewicht === "pflicht" ? "Pflicht" : "empfohlen"})</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        )}
      </CardContent>
    </Card>
  )
}
