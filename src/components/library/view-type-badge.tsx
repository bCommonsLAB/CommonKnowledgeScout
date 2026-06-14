/**
 * Format-Abzeichen eines Dokuments (Welle A4).
 *
 * Zeigt den lesbaren DetailViewType (z.B. „Klimamaßnahme") — fuer die gemischte
 * Galerie/Tabelle und (kuenftig) Story-Verweise. Reine Praesentation: unbekannter
 * oder fehlender Typ → kein Abzeichen (kein falsches Label).
 */

import { Badge } from '@/components/ui/badge'
import { getViewTypeLabel } from '@/lib/detail-view-types/view-type-display'

export interface ViewTypeBadgeProps {
  detailViewType?: string
  className?: string
}

export function ViewTypeBadge({ detailViewType, className }: ViewTypeBadgeProps) {
  const label = getViewTypeLabel(detailViewType)
  if (!label) return null
  return (
    <Badge variant="outline" className={className} title="Inhaltstyp">
      {label}
    </Badge>
  )
}
