'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText } from 'lucide-react'

export interface DocLike {
  authors?: string[]
  speakers?: string[]
  speakers_image_url?: string[]
}

export function SpeakerOrAuthorIcons({ doc }: { doc: DocLike }) {
  const names = doc.speakers && doc.speakers.length > 0 
    ? doc.speakers 
    : (doc.authors && doc.authors.length > 0 ? doc.authors : undefined)
  
  if (!names || names.length === 0) {
    return <FileText className='h-8 w-8 text-primary mb-2' />
  }
  
  const images = doc.speakers_image_url && doc.speakers_image_url.length > 0 
    ? doc.speakers_image_url 
    : undefined
  
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


