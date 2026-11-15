'use client'

/**
 * @fileoverview Belege, Kennung, Vorschlag und Bemerkung einer Sitzung (Register, Welle R3).
 *
 * @description
 * Figma „Beleg", „Kennung", „Vorschlag" und „Bemerkung". Belege oeffnen im
 * Archiv (Ordner + Datei). Der Vorschlag waehlt ein Vorhaben aus denen, die
 * das Register kennt — er verschiebt nichts. Die Bemerkung wird erst mit
 * „Speichern" geschrieben, nie still beim Verlassen des Feldes.
 *
 * @module components/library/agent-view/sitzungen
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, FileText, MessageSquare } from 'lucide-react'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@ks/ui'
import { HERKUNFT_TEXT, KENNUNG_TEXT, archivDateiHref, stempelTag } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

const Abschnitt = ({ titel, children }: { titel: string; children: ReactNode }) => (
  <section className="flex w-full flex-col gap-2">
    <h3 className="text-xs font-semibold text-muted-foreground">{titel}</h3>
    {children}
  </section>
)

export function SitzungBelege({ zeile, libraryId }: { zeile: SitzungsSicht; libraryId: string }) {
  return (
    <Abschnitt titel={zeile.belege.length > 1 ? `Belege (${zeile.belege.length})` : 'Beleg'}>
      {zeile.belege.length === 0 && <p className="text-[13px] text-muted-foreground">Noch kein Beleg.</p>}
      {zeile.belege.map((b) => (
        <a
          key={b.sourceId}
          href={archivDateiHref(libraryId, b.parentId, b.sourceId)}
          className="flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 hover:bg-accent"
          title="Im Archiv öffnen"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px]">{b.name}</span>
          {b.zuege !== null && <span className="shrink-0 text-xs text-muted-foreground">Züge {b.zuege.replace('-', '–')}</span>}
          <span className="shrink-0 text-xs text-muted-foreground">
            {b.notiz ? (b.notizAktualisiert !== null ? `Notiz ${stempelTag(b.notizAktualisiert)}` : 'Notiz') : 'ohne Notiz'}
          </span>
          <ExternalLink className="h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ))}
    </Abschnitt>
  )
}

export function SitzungKennung({ zeile }: { zeile: SitzungsSicht }) {
  return (
    <Abschnitt titel="Kennung">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-mono text-foreground/80">{zeile.sitzungId ?? zeile.registerId}</span>
        <span className="text-muted-foreground">
          · {KENNUNG_TEXT[zeile.kennung]} · {HERKUNFT_TEXT[zeile.gemeldetVon]} am {stempelTag(zeile.gemeldetAm)}
          {zeile.gespeichert ? '' : ' · noch nicht im Register gespeichert'}
        </span>
      </p>
    </Abschnitt>
  )
}

export function SitzungVorschlag({
  zeile,
  vorhaben,
  speichert,
  onSetzen,
}: {
  zeile: SitzungsSicht
  /** Ordnernamen der Vorhaben, die das Register kennt. */
  vorhaben: readonly string[]
  speichert: boolean
  onSetzen: (ordner: string | null) => void
}) {
  const aktuell = zeile.vorhabenVorschlag?.ordner
  return (
    <Abschnitt titel="Vorschlag">
      <div className="flex w-full items-center gap-2">
        <Select value={aktuell ?? ''} onValueChange={(v) => onSetzen(v)} disabled={speichert}>
          <SelectTrigger className="h-[37px] flex-1 text-[13px]" aria-label="Vorhaben wählen">
            <SelectValue placeholder="Vorhaben wählen …" />
          </SelectTrigger>
          <SelectContent>
            {vorhaben.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {aktuell !== undefined && (
          <Button variant="ghost" size="sm" onClick={() => onSetzen(null)} disabled={speichert}>Entfernen</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Der Vorschlag verschiebt nichts. Den Beleg verschieben bleibt ein eigener Schritt (Cowork oder Brücke).
        {zeile.vorhabenVorschlag !== null && ` Vorgeschlagen von: ${zeile.vorhabenVorschlag.herkunft}.`}
      </p>
    </Abschnitt>
  )
}

export function SitzungBemerkung({
  zeile,
  speichert,
  onSpeichern,
}: {
  zeile: SitzungsSicht
  speichert: boolean
  onSpeichern: (text: string) => void
}) {
  const [text, setText] = useState(zeile.bemerkung ?? '')
  useEffect(() => setText(zeile.bemerkung ?? ''), [zeile.registerId, zeile.bemerkung])
  const geaendert = text !== (zeile.bemerkung ?? '')
  return (
    <Abschnitt titel="Bemerkung">
      <div className="flex w-full items-start gap-2 rounded-lg border px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
        <MessageSquare className="mt-1 h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bemerkung hinzufügen …"
          rows={text.length > 120 ? 4 : 1}
          className="min-h-0 resize-y border-0 p-0 text-[13px] shadow-none focus-visible:ring-0"
          aria-label="Bemerkung"
        />
      </div>
      {geaendert && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onSpeichern(text)} disabled={speichert}>Speichern</Button>
          <Button size="sm" variant="ghost" onClick={() => setText(zeile.bemerkung ?? '')} disabled={speichert}>Verwerfen</Button>
        </div>
      )}
    </Abschnitt>
  )
}
