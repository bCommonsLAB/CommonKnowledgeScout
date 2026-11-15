'use client'

/**
 * @fileoverview Zustand des Coverage-Reports fuer die Reiter, die ihn brauchen (W8, Welle R3).
 *
 * @description
 * Seit dem Reiter „Sitzungen" haengt die Reiterleiste nicht mehr am Report:
 * Nur Aktuell, Werkbank, Baum, Board und Todos brauchen ihn. Dieses Tor zeigt
 * in diesen Reitern Fehler, Laden oder „Noch kein Scan" und erst mit Report
 * den Inhalt — vorher stand das ueber der ganzen Sicht und verdeckte die
 * Reiter (Plan sitzungen-register, W8).
 *
 * @module components/library/agent-view
 */

import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@ks/ui'
import type { CoverageResponse } from '@/hooks/agent-view/use-coverage-report'

export function ReportGate({
  daten,
  isLoading,
  neverScanned,
  error,
  children,
}: {
  daten: CoverageResponse | null
  isLoading: boolean
  neverScanned: boolean
  error: string | null
  children: (daten: CoverageResponse) => ReactNode
}) {
  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Coverage nicht verfuegbar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {daten?.gapsTruncated && (
        <Alert className="mb-3">
          <AlertTitle>Befundliste gekappt</AlertTitle>
          <AlertDescription>
            Gespeichert sind {daten.report.gaps.length} von {daten.totalGaps} Befunden. Die Zaehler des Reports
            (Karten im Leerzustand, &bdquo;Scan-Details&ldquo; im Kopf) sind vollstaendig; nur die Befundliste ist gekappt.
          </AlertDescription>
        </Alert>
      )}
      {isLoading && !daten && <p className="text-sm text-muted-foreground">Lade juengsten Report...</p>}
      {neverScanned && !daten && (
        <Alert>
          <AlertTitle>Noch kein Scan</AlertTitle>
          <AlertDescription>
            Fuer diese Library gibt es noch keinen Coverage-Report. &bdquo;Neu scannen&ldquo; berechnet ihn &mdash; der Report ist
            abgeleitet und jederzeit wegwerfbar.
          </AlertDescription>
        </Alert>
      )}
      {daten && children(daten)}
    </>
  )
}
