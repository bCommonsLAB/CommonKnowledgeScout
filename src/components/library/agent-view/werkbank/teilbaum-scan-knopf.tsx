'use client'

/**
 * @fileoverview „Teilbaum neu scannen" im Detail-Kopf (F10, Welle W8).
 *
 * @description
 * Erscheint erst mit der Merge-Welle (§F10): Der Teilbaum-Scan MERGED in den
 * gespeicherten Voll-Report, statt ihn zu ersetzen — die Werkbank-Liste
 * bleibt vollstaendig. Kann nicht gemergt werden, ersetzt der Teil-Report
 * wie vor W8; der benannte Grund erscheint als `scanHinweis` im Detail.
 *
 * @module components/library/agent-view
 */

import { RefreshCw } from 'lucide-react'
import { Button } from '@ks/ui'

/** Prop-Buendel des Teilbaum-Scans (Panel → Detail); `hinweis` = benannter Merge-Fallback. */
export interface TeilbaumScanProps {
  onScan: (folderId: string) => void
  isScanning: boolean
  hinweis: string | null
}

export function TeilbaumScanKnopf({ folderId, onTeilbaumScan, isScanning }: {
  folderId: string
  onTeilbaumScan: (folderId: string) => void
  isScanning: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-xs"
      disabled={isScanning}
      onClick={() => onTeilbaumScan(folderId)}
      title="Rechnet nur diesen Teilbaum neu und merged das Ergebnis in den gespeicherten Report (F10)."
    >
      <RefreshCw className={`mr-1 h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} aria-hidden />
      {isScanning ? 'scannt …' : 'Teilbaum neu scannen'}
    </Button>
  )
}
