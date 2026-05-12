'use client'

/**
 * src/components/library/gallery/document-card/refurbed-device-card.tsx
 *
 * RefurbedDeviceCard fuer detailViewType='refurbedDevice'.
 *
 * Aus document-card.tsx ausgegliedert (Welle 3-III-a, Schritt 1/N).
 *
 * Vollflaechiges Hintergrundbild fuer gebrauchte PCs/Notebooks:
 * - OBEN: Geraetetyp (klein, uppercase) + Modell/Titel (gross)
 * - UNTEN: Schnellinfo-Zeile mit Prozessor, RAM, Festplatte (mit Icons)
 * - Optional: Jahr-Badge oben rechts
 * - Hover-Effekte: Scale, Schatten, Linie unten
 * - Fallback ohne Bild: Smaragd-Gradient (passt zur emerald-Akzentfarbe
 *   der Detailansicht)
 *
 * Format: aspect-[4/3] passt typisch zu PC-Produktfotos.
 *
 * Verhalten 1:1 portiert — keine Logik-Aenderung.
 */

import React from 'react'
import Image from 'next/image'
import { Cpu, MemoryStick, HardDrive } from 'lucide-react'
import type { DocCardMeta } from '@/lib/gallery/types'
import { useTranslation } from '@/lib/i18n/hooks'
import { SourceStarsBadge } from '../source-stars-badge'

export interface RefurbedDeviceCardProps {
  doc: DocCardMeta
  onClick: () => void
  libraryId?: string
}

export function RefurbedDeviceCard({ doc, onClick, libraryId }: RefurbedDeviceCardProps) {
  const { t } = useTranslation()
  // Thumbnail bevorzugen fuer Galerie-Performance, Fallback auf Original
  const displayImageUrl = doc.coverThumbnailUrl || doc.coverImageUrl

  // Lesbares Geraetetyp-Label aus i18n; bei unbekanntem Wert den raw-Wert
  // anzeigen (kein silent fallback)
  const geraetetypLabel = doc.geraetetyp
    ? t(`gallery.refurbedDevice.deviceTypes.${doc.geraetetyp}`, { defaultValue: doc.geraetetyp })
    : undefined

  // Schnellinfo-Items (Prozessor, RAM, Festplatte) - leere Werte werden weggelassen
  const quickSpecs: Array<{ icon: React.ReactNode; value: string }> = []
  if (doc.prozessor) quickSpecs.push({ icon: <Cpu className='w-3 h-3' />, value: doc.prozessor })
  if (doc.arbeitsspeicher) quickSpecs.push({ icon: <MemoryStick className='w-3 h-3' />, value: doc.arbeitsspeicher })
  if (doc.festplatte) quickSpecs.push({ icon: <HardDrive className='w-3 h-3' />, value: doc.festplatte })

  // Primaerer Titel: Modell (wenn gesetzt) > shortTitle > title > fileName
  const primaryTitle = doc.modell || doc.shortTitle || doc.title || doc.fileName || 'Geraet'

  return (
    <article
      className='group relative aspect-[4/3] overflow-hidden rounded-lg shadow-md transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
      onClick={onClick}
    >
      {/* Hintergrundbild: Thumbnail bevorzugt fuer bessere Performance */}
      {displayImageUrl ? (
        <Image
          src={displayImageUrl}
          alt={primaryTitle}
          fill
          className='object-cover transition-transform duration-500 group-hover:scale-105'
          loading='lazy'
          unoptimized
        />
      ) : (
        // Fallback: Smaragd-Gradient (passt zum emerald-Akzent der Detailansicht)
        <div className='absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-600' />
      )}

      {/* Gradient-Overlay: oben dezent, unten staerker fuer Lesbarkeit der Schnellinfos */}
      <div className='absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60' />

      {/* Content Container */}
      <div className='relative h-full flex flex-col justify-between p-4'>
        {/* OBEN: Geraetetyp + Modell/Titel */}
        <div className='pr-8'>
          {geraetetypLabel && (
            <span className='block text-[10px] font-semibold uppercase tracking-widest text-white/90 drop-shadow-lg mb-1'>
              {geraetetypLabel}
            </span>
          )}
          <h3 className='text-lg font-semibold leading-tight text-white drop-shadow-lg line-clamp-2 text-balance'>
            {primaryTitle}
          </h3>
        </div>

        {/* UNTEN: Schnellinfo-Zeile (Prozessor, RAM, Festplatte) */}
        {quickSpecs.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {quickSpecs.map((spec, idx) => (
              <div
                key={idx}
                className='flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm bg-black/40 text-white/95'
              >
                {spec.icon}
                <span className='line-clamp-1'>{spec.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jahr-Badge oben rechts (analog Session) */}
      {doc.year && (
        <div className='absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur-sm bg-black/30 text-white'>
          {String(doc.year)}
        </div>
      )}

      <SourceStarsBadge
        libraryId={libraryId}
        fileId={doc.fileId}
        variant='light'
        className='absolute top-3 left-3 z-10'
      />

      {/* Hover-Linie unten */}
      <div className='absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left' />
    </article>
  )
}
