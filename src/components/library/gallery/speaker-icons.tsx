'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface DocLike {
  authors?: string[]
  speakers?: string[]
  // speakers_image_url kann ein Array oder ein String sein (z.B. "['url']" aus docMetaJson)
  speakers_image_url?: string[] | string
}

// Hilfsfunktion zum Normalisieren von speakers_image_url (kann String oder Array sein)
function normalizeImageUrls(urls: unknown): string[] | undefined {
  if (Array.isArray(urls)) {
    const arr = urls
      .map(url => typeof url === 'string' ? url.trim() : '')
      .filter(url => url.length > 0)
    return arr.length > 0 ? arr : undefined
  }
  
  if (typeof urls === 'string' && urls.trim().length > 0) {
    const trimmed = urls.trim()
    // Versuche JSON-Array zu parsen: "['url1', 'url2']" oder '["url1", "url2"]'
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
        (trimmed.startsWith("['") && trimmed.endsWith("']"))) {
      try {
        // Ersetze einfache Anführungszeichen durch doppelte für JSON.parse
        const jsonStr = trimmed.replace(/'/g, '"')
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed)) {
          const arr = parsed
            .map((x: unknown) => typeof x === 'string' ? x.trim() : '')
            .filter((x: string) => x.length > 0)
          return arr.length > 0 ? arr : undefined
        }
      } catch {
        // Fehler beim Parsen, versuche manuell zu extrahieren
        const matches = trimmed.match(/(['"])((?:(?!\1).)*)\1/g)
        if (matches && matches.length > 0) {
          const arr = matches.map(m => m.slice(1, -1).trim()).filter(Boolean)
          return arr.length > 0 ? arr : undefined
        }
      }
    }
    
    // Einzelner String → als Array mit einem Element
    return [trimmed]
  }
  
  return undefined
}

export function SpeakerOrAuthorIcons({ doc, compact = false }: { doc: DocLike; compact?: boolean }) {
  const names = doc.speakers && doc.speakers.length > 0 
    ? doc.speakers 
    : (doc.authors && doc.authors.length > 0 ? doc.authors : undefined)
  
  // Normalisiere speakers_image_url (kann String oder Array sein)
  const images = normalizeImageUrls(doc.speakers_image_url)

  // Icons nur anzeigen, wenn wir wirklich Bild-URLs haben
  const hasRealImages = Array.isArray(images) && images.some(url => typeof url === 'string' && url.trim().length > 0)
  
  // Icons nur anzeigen, wenn Namen UND echte Bilder vorhanden sind
  if (!names || names.length === 0 || !hasRealImages) {
    return null
  }

  // compact: kleinere Icons (40px) ohne negative Margins — für SessionCard
  // normal: große Icons (80px) mit -mt-10 — für Standard-Karte
  const iconSize = compact ? 'h-12 w-12' : 'h-20 w-20'
  const wrapperClass = compact
    ? 'flex items-center gap-0 flex-wrap'
    : 'flex items-center gap-0 -mt-10 mb-2 flex-wrap -ml-2'
  
  return (
    <div className={wrapperClass}>
      {names.slice(0, 3).map((name, idx) => {
        const imageUrl = images && images[idx] ? images[idx] : undefined
        return (
          <div 
            key={idx}
            className={idx > 0 ? '-ml-2' : ''}
            style={{ zIndex: names.length - idx }}
          >
            <SpeakerIcon name={name} imageUrl={imageUrl} size={iconSize} compact={compact} />
          </div>
        )
      })}
      {names.length > 3 && (
        <div className='-ml-2' style={{ zIndex: 0 }}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center justify-center ${iconSize} rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0 border-2 border-background shadow-sm`}>
                  +{names.length - 3}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className='space-y-1'>
                  {names.slice(3).map((name, idx) => (
                    <p key={idx}>{name}</p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}

export function SpeakerIcon({ name, imageUrl, size = 'h-20 w-20', compact = false }: { 
  name: string; 
  imageUrl?: string; 
  size?: string;
  compact?: boolean;
}) {
  const [imageError, setImageError] = useState(false)
  const textSize = compact ? 'text-xs' : 'text-base'
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-center ${size} rounded-full bg-primary/10 text-primary ${textSize} font-medium border-2 border-background hover:border-primary/30 transition-colors overflow-hidden shrink-0 shadow-sm relative`}>
            {imageUrl && !imageError ? (
              <Image 
                src={imageUrl} 
                alt={name}
                fill
                className='object-cover'
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}












