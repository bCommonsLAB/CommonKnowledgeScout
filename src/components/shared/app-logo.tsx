'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  /** Größe des Logos in Pixeln (Standard: 32) */
  size?: number
  /** Zusätzliche CSS-Klassen */
  className?: string
  /** Fallback, wenn Bild nicht geladen werden kann */
  fallback?: React.ReactNode
}

const LOGO_URL = 'https://ragtempproject.blob.core.windows.net/knowledgescout/images/CommonKnowledgeScout_logo.png'

/**
 * Wiederverwendbare Logo-Komponente für CommonKnowledgeScout
 * 
 * Zeigt das Logo als runden Avatar an. Unterstützt verschiedene Größen
 * und hat einen optionalen Fallback.
 */
export function AppLogo({ size = 32, className, fallback }: AppLogoProps) {
  const [imageError, setImageError] = useState(false)
  // Bildgröße: Container-Größe plus 8px (damit es um 4px auf jeder Seite beschnitten wird)
  const imageSize = size + 8

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-background border border-border flex items-center justify-center flex-shrink-0 relative',
        className
      )}
      style={{ width: size, height: size }}
    >
      {!imageError ? (
        <Image
          src={LOGO_URL}
          alt="CommonKnowledgeScout Logo"
          width={imageSize}
          height={imageSize}
          className="object-cover"
          style={{
            width: `${imageSize}px`,
            height: `${imageSize}px`,
            margin: '-4px',
          }}
          unoptimized
          onError={() => setImageError(true)}
        />
      ) : (
        fallback || (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">CKS</span>
          </div>
        )
      )}
    </div>
  )
}

