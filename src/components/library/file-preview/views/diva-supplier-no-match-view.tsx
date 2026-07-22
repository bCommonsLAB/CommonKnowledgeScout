'use client'

/**
 * @fileoverview DIVA-Info ohne Sidecar-Match: Sidecar vorhanden, aber kein Eintrag fuer die Textur.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { MatchAttempt } from '@/lib/diva-texture/types'

interface DivaSupplierNoMatchViewProps {
  fileName: string
  entryCount: number
  attempts: MatchAttempt[]
}

export function DivaSupplierNoMatchView({
  fileName,
  entryCount,
  attempts,
}: DivaSupplierNoMatchViewProps) {
  const triedStrategies = [...new Set(attempts.map((a) => a.strategy))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Sidecar gefunden</Badge>
        <span className="text-xs text-muted-foreground">
          {entryCount} Textur-Eintraege in optionvalues.json
        </span>
      </div>

      <Alert>
        <AlertTitle>Kein Liefersystem-Eintrag fuer diese Textur</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            Die Sidecar-Datei liegt im Grosseltern-Ordner von{' '}
            <span className="font-mono">{fileName}</span>, aber keiner der{' '}
            {entryCount} Textur-Eintraege (IsTexture=&quot;True&quot;) passt zum Dateinamen.
          </p>
          <p className="text-xs text-muted-foreground">
            Gepruefte Strategien: {triedStrategies.length > 0 ? triedStrategies.join(', ') : '—'}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
