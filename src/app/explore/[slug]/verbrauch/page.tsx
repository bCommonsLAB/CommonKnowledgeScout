'use client'

/**
 * Verbrauchsseite einer oeffentlichen Library: `/explore/<slug>/verbrauch`.
 * Nur der Montagepunkt — Slug aus dem Datei-Routing, die Ansicht liegt in
 * `components/library/verbrauch`.
 */

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { VerbrauchAnsicht } from '@/components/library/verbrauch/verbrauch-ansicht'

export default function VerbrauchPage() {
  const params = useParams()
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  return (
    <Suspense fallback={null}>
      <VerbrauchAnsicht slug={slug} />
    </Suspense>
  )
}
