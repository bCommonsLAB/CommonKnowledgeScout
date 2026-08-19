'use client'

/**
 * @fileoverview Twin-Knoten des Agenten-Baums mit Inline-Kuration (Welle 4, F4).
 *
 * @description
 * Zeigt je Twin-Familie das FUEHRENDE Artefakt (Contract §2b) mit
 * Vertrauensampel, `twin_status`-Dropdown und Verify-Aktion. Beide Aktionen
 * laufen ueber die Kurations-Patch-Route (Contract §4) — die Agentensicht hat
 * keinen eigenen Schreibpfad. 409-Befunde (Spiegel-Drift, Selbst-Verifikation)
 * erscheinen als Klartext an der Zeile; es wurde nichts ueberschrieben.
 *
 * @module components/library/agent-view
 */

import { BadgeCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { twinStatusLabel, verificationLabel } from '@/lib/agent-view/labels'
import type { TwinFamilySummary, VerificationState } from '@/lib/agent-view/types'
import { TWIN_STATUS_VALUES } from '@/lib/shadow-twin/twin-core-fields'

const VERIFICATION_CLASS: Record<VerificationState, string> = {
  unverifiziert: 'bg-zinc-400',
  maschinell: 'bg-sky-500',
  mensch: 'bg-emerald-500',
  ungueltig: 'bg-red-500',
}

function VerificationDot({ state }: { state: VerificationState }) {
  const title = verificationLabel(state)
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${VERIFICATION_CLASS[state]}`}
      title={title}
      aria-label={title}
    />
  )
}

/** Kurzbezeichner des fuehrenden Artefakts, z. B. „standard-konzept.de". */
function leadingDescriptor(family: TwinFamilySummary): string {
  const leading = family.leading
  if (!leading) return ''
  if (leading.kind === 'transcript') return 'Transkript'
  return `${leading.templateName ?? '(ohne Template)'}.${leading.targetLanguage || '?'}`
}

export interface TwinFamilyRowProps {
  /** Familie mit ggf. bereits uebergelagertem Kurationszustand (Override). */
  family: TwinFamilySummary
  pending: boolean
  error: string | null
  onSetStatus: (twinStatus: string) => void
  onVerify: () => void
}

export function TwinFamilyRow({ family, pending, error, onSetStatus, onVerify }: TwinFamilyRowProps) {
  const leading = family.leading

  if (!leading) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-zinc-300" aria-hidden />
        <span title={family.path}>{family.sourceName}</span>
        <span>— ohne fuehrendes Artefakt (kein Transkript, keine Standard-Transformation)</span>
      </div>
    )
  }

  // Unbekannte Bestandswerte bleiben als eigene (nicht waehlbare) Option
  // sichtbar, statt still auf einen gueltigen Wert umzuspringen.
  const currentStatus = leading.twinStatus ?? ''
  const isKnownStatus = (TWIN_STATUS_VALUES as readonly string[]).includes(currentStatus)

  return (
    <div className="py-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <VerificationDot state={leading.verification} />
        <span className="font-medium" title={family.path}>
          {family.sourceName}
        </span>
        <span className="text-muted-foreground" title="Fuehrendes Artefakt (Contract §2b)">
          {leadingDescriptor(family)}
        </span>
        {leading.verifiedBy && (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground"
            title={`${verificationLabel(leading.verification)} — ${leading.verifiedBy} am ${leading.verifiedAt ?? '—'}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            {leading.verifiedBy}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor={`twin-status-${family.sourceId}`}>
            twin_status von {family.sourceName}
          </label>
          <select
            id={`twin-status-${family.sourceId}`}
            className="h-6 rounded border border-input bg-background px-1 text-xs"
            value={currentStatus}
            disabled={pending}
            onChange={(event) => onSetStatus(event.target.value)}
          >
            {currentStatus === '' && (
              <option value="" disabled>
                {twinStatusLabel(null)}
              </option>
            )}
            {!isKnownStatus && currentStatus !== '' && (
              <option value={currentStatus} disabled>
                {twinStatusLabel(currentStatus)}
              </option>
            )}
            {TWIN_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {twinStatusLabel(status)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            disabled={pending}
            onClick={onVerify}
            title="Setzt verified_by: human:<user> + verified_at ueber die Kurations-Patch-Route"
          >
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
            Verifizieren
          </Button>
        </span>
      </div>
      {error && (
        <p className="mt-0.5 pl-4 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
