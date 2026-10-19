'use client'

/**
 * Tooltip-Inhalt der Stern-Badge: wer hat den Stern gegeben (nur Mitglieder,
 * ADR 0012). Aus `source-stars-badge.tsx` ausgelagert (200-Zeilen-Regel).
 */

import React from 'react'
import { useTranslation } from '@ks/i18n/react'
import type { FavoriteVoter } from '@ks/contracts'

interface VoterTooltipBodyProps {
  voters: FavoriteVoter[]
}

function emailPrefix(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return email
  return email.slice(0, at)
}

export function VoterTooltipBody({ voters }: VoterTooltipBodyProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium opacity-70">
        {t('gallery.favorites.voterTooltipHeader', {
          count: voters.length,
          defaultValue: 'Sterne ({{count}})',
        })}
      </div>
      <ul className="flex flex-col gap-0.5">
        {voters.map((voter) => {
          const name = voter.name?.trim() || emailPrefix(voter.email)
          return (
            <li key={voter.email} className="truncate text-xs">
              {name}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
