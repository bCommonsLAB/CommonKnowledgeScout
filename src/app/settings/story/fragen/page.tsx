/**
 * @fileoverview Settings-Seite „Fragen & Antworten" (meSpace > Story).
 *
 * @description
 * Verwaltungssicht auf die gespeicherten Fragen und Antworten der aktiven
 * Library: sehen, gezielt verwerfen, alle verwerfen. Zugriff prüft die
 * Route (Owner/Moderator); die Seite zeigt sonst die Fehlermeldung.
 *
 * @module settings
 */

"use client"

import { useActiveLibraryId } from '@ks/shell/react'
import { Alert, AlertDescription, AlertTitle, Separator } from '@ks/ui'
import { AlertCircle } from 'lucide-react'
import { FragenAntwortenTabelle } from '@/components/settings/fragen-antworten/fragen-antworten-tabelle'

export default function FragenAntwortenPage() {
  const activeLibraryId = useActiveLibraryId()
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Fragen &amp; Antworten</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Jede beantwortete Frage wird gespeichert und als Antwort wiederverwendet, solange Antwortregeln, Facetten
          und Dokumentbestand gleich bleiben. Hier sehen Sie diese Antworten und können sie verwerfen — die nächste
          gleiche Frage wird dann neu beantwortet. Der Verlauf der Besucher bleibt erhalten.
        </p>
      </div>
      <Separator />
      {activeLibraryId ? (
        <FragenAntwortenTabelle libraryId={activeLibraryId} />
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Bibliothek ausgewählt</AlertTitle>
          <AlertDescription>Bitte wählen Sie zuerst eine Bibliothek aus.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
