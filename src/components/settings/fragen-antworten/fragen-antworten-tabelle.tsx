/**
 * @fileoverview Tabelle der Verwaltungssicht „Fragen & Antworten" (Owner/Moderator).
 *
 * @description
 * Gespeicherte Antworten einer Library: Suche, Filter „nur veraltete" und
 * „nur gültige", Zeilen aufklappbar (Antwort, Quellen), „Antwort verwerfen"
 * je Zeile und „Alle Antworten verwerfen" mit Zahl in der Rückfrage. Kein
 * Löschen — das bleibt dem eigenen Eintrag im Story-Modus vorbehalten.
 *
 * @module settings
 */

"use client"

import { Alert, AlertDescription, Button, Checkbox, Input, Label, Table, TableBody, TableHead, TableHeader, TableRow } from '@ks/ui'
import { AlertCircle, Loader2, Ban, RefreshCw } from 'lucide-react'
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog'
import { useFragenLog } from './use-fragen-log'
import { FragenLogZeileView } from './fragen-log-zeile'

export function FragenAntwortenTabelle({ libraryId }: { libraryId: string }) {
  const { daten, laden, fehler, verbotene, seite, seiten, setSeite, filter, setFilter, verwirft, verwerfe, neuLaden } = useFragenLog(libraryId)

  if (verbotene) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Keine Berechtigung. Nur Owner oder Moderatoren dieser Bibliothek sehen die gespeicherten Antworten.</AlertDescription>
      </Alert>
    )
  }

  const gesamtTreffer = daten?.gesamtTreffer ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-nowrap">
        <Input
          placeholder="In Fragen suchen …"
          value={filter.suche}
          onChange={(e) => setFilter({ suche: e.target.value })}
          className="max-w-sm"
          aria-label="In Fragen suchen"
        />
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Checkbox id="nur-veraltete" checked={filter.nurVeraltete} onCheckedChange={(v) => setFilter({ nurVeraltete: v === true })} />
          <Label htmlFor="nur-veraltete" className="text-sm">nur veraltete</Label>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Checkbox id="nur-treffer" checked={filter.nurTreffer} onCheckedChange={(v) => setFilter({ nurTreffer: v === true })} />
          <Label htmlFor="nur-treffer" className="text-sm">nur gültige</Label>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-nowrap">
          <Button variant="ghost" size="sm" onClick={() => void neuLaden()} disabled={laden} title="Neu laden">
            <RefreshCw className={laden ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </Button>
          <ConfirmActionDialog
            trigger={
              <Button variant="outline" size="sm" disabled={gesamtTreffer === 0 || verwirft !== null} title="Alle Antworten verwerfen">
                {verwirft === 'alle' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                <span className="hidden lg:inline ml-2">Alle Antworten verwerfen</span>
              </Button>
            }
            title={`${gesamtTreffer} gespeicherte ${gesamtTreffer === 1 ? 'Antwort' : 'Antworten'} verwerfen?`}
            description="Jede gleiche Frage bekommt danach eine neue Antwort — zum Beispiel nach geänderten Antwortregeln oder neuen Dokumenten. Verlauf, Sitzungen und populäre Fragen der Besucher bleiben erhalten; gelöscht wird nichts."
            confirmLabel="Alle verwerfen"
            destructive
            onConfirm={() => void verwerfe({ alle: true })}
          />
        </div>
      </div>

      {daten?.hinweis && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{daten.hinweis}</AlertDescription>
        </Alert>
      )}
      {fehler && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {laden && !daten ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Frage</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Sprache</TableHead>
              <TableHead>Modell</TableHead>
              <TableHead className="text-right">Quellen</TableHead>
              <TableHead className="text-right" title="Einträge mit derselben Antwort">Einträge</TableHead>
              <TableHead>Stand</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daten && daten.zeilen.length === 0 && (
              <TableRow><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">Keine gespeicherten Antworten{filter.suche || filter.nurVeraltete || filter.nurTreffer ? ' für diesen Filter' : ''}.</td></TableRow>
            )}
            {daten?.zeilen.map((z) => (
              <FragenLogZeileView
                key={z.queryId}
                libraryId={libraryId}
                zeile={z}
                verwirft={verwirft === z.queryId || verwirft === 'alle'}
                onVerwerfen={(id) => void verwerfe({ queryIds: [id] })}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {daten && (
        <div className="flex items-center justify-between text-sm text-muted-foreground flex-nowrap">
          <span>{daten.gesamt} {daten.gesamt === 1 ? 'Antwort' : 'Antworten'} · davon {gesamtTreffer} noch gültig</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={seite <= 1} onClick={() => setSeite(seite - 1)}>Zurück</Button>
            <span>Seite {seite} / {seiten}</span>
            <Button variant="outline" size="sm" disabled={seite >= seiten} onClick={() => setSeite(seite + 1)}>Weiter</Button>
          </div>
        </div>
      )}
    </div>
  )
}
