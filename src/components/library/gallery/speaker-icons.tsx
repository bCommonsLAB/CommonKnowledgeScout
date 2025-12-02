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

export function SpeakerOrAuthorIcons({ doc }: { doc: DocLike }) {
  const names = doc.speakers && doc.speakers.length > 0 
    ? doc.speakers 
    : (doc.authors && doc.authors.length > 0 ? doc.authors : undefined)
  
  // URLs sind bereits in den Metadaten vorhanden
  // Die Bilder selbst werden durch Next.js Image lazy-loaded (mit loading="lazy")
  // WICHTIG: speakers_image_url kann auch für authors verwendet werden, wenn keine speakers vorhanden sind
  // Dies ist konsistent mit der Datenstruktur, wo speakers_image_url für beide Fälle verwendet wird
  // Normalisiere speakers_image_url (kann String oder Array sein)
  const images = normalizeImageUrls(doc.speakers_image_url)

  // Icons nur anzeigen, wenn wir wirklich Bild-URLs haben.
  // Wenn keine Bilder vorhanden sind, sollen die großen Kreise komplett entfallen.
  const hasRealImages = Array.isArray(images) && images.some(url => typeof url === 'string' && url.trim().length > 0)
  
  // DEBUG: Logging für Debugging (nur in Entwicklung)
  if (process.env.NODE_ENV === 'development' && names && names.length > 0) {
    console.log('[SpeakerOrAuthorIcons]', {
      hasSpeakers: !!doc.speakers && doc.speakers.length > 0,
      hasAuthors: !!doc.authors && doc.authors.length > 0,
      namesCount: names.length,
      rawSpeakersImageUrl: doc.speakers_image_url,
      rawSpeakersImageUrlType: typeof doc.speakers_image_url,
      hasImages: !!images,
      imagesCount: images?.length || 0,
      hasRealImages,
      imagesPreview: images?.slice(0, 2)
    })
  }
  
  // Icons nur anzeigen, wenn Namen UND echte Bilder vorhanden sind
  if (!names || names.length === 0 || !hasRealImages) {
    // Kein Name oder keine echten Bilder → keine Kreise rendern
    return null
  }
  
  return (
    <div className='flex items-center gap-0 -mt-10 mb-2 flex-wrap -ml-2'>
      {names.slice(0, 3).map((name, idx) => {
        const imageUrl = images && images[idx] ? images[idx] : undefined
        return (
          <div 
            key={idx}
            className={idx > 0 ? '-ml-2' : ''}
            style={{ zIndex: names.length - idx }}
          >
            <SpeakerIcon name={name} imageUrl={imageUrl} />
          </div>
        )
      })}
      {names.length > 3 && (
        <div className='-ml-2' style={{ zIndex: 0 }}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex items-center justify-center h-20 w-20 rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0 border-2 border-background shadow-sm'>
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

export function SpeakerIcon({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [imageError, setImageError] = useState(false)
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 text-primary text-base font-medium border-2 border-background hover:border-primary/30 transition-colors overflow-hidden shrink-0 shadow-sm relative'>
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












