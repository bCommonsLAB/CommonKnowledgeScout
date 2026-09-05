'use client'

/**
 * @fileoverview Aktuell-Panel (Welle A7) — der Einstieg in die Agentensicht.
 *
 * @description
 * „Woran arbeite ich gerade?" auf einen Blick: Termine, aktive Vorhaben, die
 * nächsten Schritte, dazu Ruhendes und die Abdeckungslücke. Die Sicht
 * berechnet sich AUS DEM GESPEICHERTEN REPORT ({@link baueAktuellSicht}) —
 * kein eigener Fetch, kein zweiter Scan, keine Datei: dieselben
 * Bericht-Felder, aus denen der Export `Organisation/AKTUELL.md` entsteht.
 * Damit können Browser-Sicht und Obsidian-Datei nicht auseinanderlaufen.
 *
 * Anders als die Datei ist hier jede Zeile ein Einstieg: ein Klick öffnet das
 * Vorhaben in der Werkbank (`?tab=werkbank&vorhaben=…&filter=alle`).
 *
 * @module components/library/agent-view
 */

import { useMemo } from 'react'
import { Mail } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { Alert, AlertDescription, AlertTitle } from '@ks/ui'
import { baueAktuellSicht, sichtIstLeer } from '@/lib/agent-view/aktuell-sicht'
import { isoHeute } from '@/lib/agent-view/sichten/types'
import type { CoverageReport } from '@/lib/agent-view/types'
import { AktuellRandbereiche } from './aktuell-randbereiche'
import { AktuellSchritte } from './aktuell-schritte'
import { AktuellTermine } from './aktuell-termine'
import { AktuellVorhabenTabelle } from './aktuell-vorhaben-tabelle'

export interface AktuellPanelProps {
  report: CoverageReport
  /** Zeitstempel des gespeicherten Reports — sagt, wie alt dieser Blick ist. */
  generatedAt: string
}

export function AktuellPanel({ report, generatedAt }: AktuellPanelProps) {
  const [, setTab] = useQueryState('tab', parseAsString)
  const [, setVorhaben] = useQueryState('vorhaben', parseAsString)
  const [, setFilter] = useQueryState('filter', parseAsString)

  // „Überfällig" misst gegen HEUTE, nicht gegen den Scan-Tag: ein Termin
  // verstreicht auch ohne Scan. Einmal beim Aufbau bestimmt, damit die
  // Sicht während einer Sitzung nicht unter der Hand springt.
  const heute = useMemo(() => isoHeute(new Date()), [])
  const schwelle = report.conventions.postfachMaxRueckstandWochen ?? null
  const sicht = useMemo(
    () => baueAktuellSicht(report.vorhaben, heute, { postfachMaxRueckstandWochen: schwelle }),
    [report.vorhaben, heute, schwelle],
  )
  const rueckstaendig = useMemo(
    () => new Set(sicht.postfachRueckstaendig.map((v) => v.folderId)),
    [sicht.postfachRueckstaendig],
  )

  const oeffneVorhaben = (folderId: string) => {
    // `filter=alle`: das angeklickte Vorhaben muss in der Werkbank-Liste auch
    // dann stehen, wenn es nicht „bereit" ist (Default-Filter der Werkbank).
    void setTab('werkbank')
    void setFilter('alle')
    void setVorhaben(folderId)
  }

  if (sichtIstLeer(sicht)) {
    return (
      <Alert>
        <AlertTitle>Noch keine Vorhaben mit Bericht</AlertTitle>
        <AlertDescription>
          Diese Sicht liest die <code>BERICHT.md</code>-Dateien der Vorhaben. Solange keines einen
          Bericht trägt, gibt es nichts zusammenzufassen — die Werkbank führt die Befunde{' '}
          <code>report_missing</code> und <code>index_missing</code>, mit denen das anfängt.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5 pb-6">
      <p className="text-xs text-muted-foreground">
        Aus den Berichten des Reports vom{' '}
        <span className="font-medium text-foreground">
          {new Date(generatedAt).toLocaleString('de-DE')}
        </span>
        {' — '}gepflegt werden die Berichte, diese Übersicht entsteht daraus. Dieselben Daten schreibt
        das Brücken-Werkzeug <code>sichten_regenerieren</code> als{' '}
        <code>Organisation/AKTUELL.md</code> für Obsidian und Cowork.
      </p>

      {sicht.altKarten > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          {sicht.altKarten} Vorhaben stammen aus einem Scan vor Welle A7 — Termine, Rollen und offene
          Punkte erscheinen für sie erst nach &bdquo;Neu scannen&ldquo;.
        </p>
      )}

      {/* A7b: Die Antwort auf „ist diese Liste noch aktuell?" — die Sicht sagt
          selbst, wo E-Mails auf Auswertung warten. Ohne konfigurierte Schwelle
          ist die Liste leer und der Hinweis bleibt weg. */}
      {sicht.postfachRueckstaendig.length > 0 && (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" aria-hidden />
            {sicht.postfachRueckstaendig.length === 1
              ? 'Ein Vorhaben wartet auf seine E-Mail-Auswertung'
              : `${String(sicht.postfachRueckstaendig.length)} Vorhaben warten auf ihre E-Mail-Auswertung`}
          </AlertTitle>
          <AlertDescription>
            {sicht.postfachRueckstaendig.map((v) => v.titel).join(' · ')}
            {' — '}der Scan führt sie als Cowork-Befund{' '}
            <code>postfach_veraltet</code>; der Auftragstext dazu steht unter
            &bdquo;Todos &amp; Auftrag&ldquo;.
          </AlertDescription>
        </Alert>
      )}

      <AktuellTermine termine={sicht.termine} onOeffnen={oeffneVorhaben} />
      <AktuellVorhabenTabelle
        aktiv={sicht.aktiv}
        libraryId={report.libraryId}
        rueckstaendig={rueckstaendig}
        onOeffnen={oeffneVorhaben}
      />
      <AktuellSchritte
        vorhaben={sicht.mitSchritten}
        aktivGesamt={sicht.aktiv.length}
        onOeffnen={oeffneVorhaben}
      />
      <AktuellRandbereiche sicht={sicht} onOeffnen={oeffneVorhaben} />
    </div>
  )
}
