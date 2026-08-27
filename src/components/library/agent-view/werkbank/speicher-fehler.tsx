'use client'

/**
 * @fileoverview Ladefehler mit Weg zur Loesung (Befund 27.08.2026).
 *
 * @description
 * „Nicht authentifiziert" und „fetch failed" lasen sich fuer den Benutzer wie
 * ein Programmfehler. Diese Anzeige nimmt dieselbe Meldung, erkennt am
 * geteilten Marker {@link istAnmeldungNoetig}, ob nur die Anmeldung beim
 * Speicher fehlt, und bietet dann den Weg dorthin an — statt eine
 * Sackgasse zu zeigen. Alle anderen Fehler bleiben unveraendert sichtbar
 * (kein Schoenreden, `no-silent-fallbacks.mdc`).
 *
 * @module components/library/agent-view
 */

import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { istAnmeldungNoetig } from '@/lib/storage/types'

/** Text eines unbekannten Fehlerwerts — ohne Raten. */
export function fehlerText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function SpeicherFehler({ titel, error }: { titel: string; error: unknown }) {
  const text = fehlerText(error)
  if (!istAnmeldungNoetig(text)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{titel}</AlertTitle>
        <AlertDescription>{text}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertTitle>Bitte beim Speicher neu anmelden</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Die Anmeldung fehlt oder ist abgelaufen — deshalb laesst sich hier gerade nichts laden.
          Deine Dateien sind unberuehrt.
        </p>
        <p>
          <Link href="/settings/archive" className="font-medium underline underline-offset-2">
            Zu den Einstellungen → Archiv
          </Link>{' '}
          und dort die Verbindung erneuern.
        </p>
      </AlertDescription>
    </Alert>
  )
}
