'use client'

import React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Share2, Twitter, Linkedin, Facebook, Copy, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface DocumentShareButtonProps {
  /** Das Dokument, das geteilt werden soll */
  doc: DocCardMeta
  /** Optional: Titel des Dokuments (falls abweichend von doc.title) */
  title?: string
}

/**
 * Button-Komponente zum Teilen eines Dokuments auf Social Media
 * 
 * Bietet Optionen zum Teilen auf:
 * - Twitter/X
 * - LinkedIn
 * - Facebook
 * - Kopieren des Links
 * - Native Web Share API (falls verfügbar)
 */
export function DocumentShareButton({
  doc,
  title,
}: DocumentShareButtonProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [copied, setCopied] = React.useState(false)

  // Erstelle die Dokument-URL
  const getDocumentUrl = React.useCallback(() => {
    if (typeof window === 'undefined') return ''
    
    const baseUrl = window.location.origin
    const currentPath = pathname || ''
    const params = new URLSearchParams(searchParams?.toString() || '')
    
    // Stelle sicher, dass doc-Parameter vorhanden ist
    if (doc.slug) {
      params.set('doc', doc.slug)
    }
    
    return `${baseUrl}${currentPath}?${params.toString()}`
  }, [pathname, searchParams, doc])

  // Erstelle den Share-Text
  const getShareText = React.useCallback(() => {
    const docTitle = title || doc.shortTitle || doc.title || doc.fileName || 'Dokument'
    return `${docTitle} - ${t('gallery.shareText', { defaultValue: 'Schau dir dieses Dokument an' })}`
  }, [doc, title, t])

  // Native Web Share API (falls verfügbar)
  const handleNativeShare = React.useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      return false
    }

    try {
      const url = getDocumentUrl()
      const text = getShareText()
      
      await navigator.share({
        title: title || doc.shortTitle || doc.title || doc.fileName || 'Dokument',
        text,
        url,
      })
      return true
    } catch {
      // User cancelled oder Fehler
      return false
    }
  }, [getDocumentUrl, getShareText, doc, title])

  // Kopiere Link in Zwischenablage
  const handleCopyLink = React.useCallback(async () => {
    try {
      const url = getDocumentUrl()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback für ältere Browser
      try {
        const textArea = document.createElement('textarea')
        textArea.value = getDocumentUrl()
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fehler beim Kopieren - ignorieren
      }
    }
  }, [getDocumentUrl])

  // Social Media Share-Links
  const shareToTwitter = React.useCallback(() => {
    const url = getDocumentUrl()
    const text = getShareText()
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
  }, [getDocumentUrl, getShareText])

  const shareToLinkedIn = React.useCallback(() => {
    const url = getDocumentUrl()
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    window.open(linkedInUrl, '_blank', 'noopener,noreferrer')
  }, [getDocumentUrl])

  const shareToFacebook = React.useCallback(() => {
    const url = getDocumentUrl()
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(facebookUrl, '_blank', 'noopener,noreferrer')
  }, [getDocumentUrl])

  // Prüfe, ob native Share API verfügbar ist
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">{t('gallery.share', { defaultValue: 'Teilen' })}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="!z-[70] w-48" 
        sideOffset={5}
      >
        {/* Native Share (falls verfügbar) */}
        {hasNativeShare && (
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault()
              void handleNativeShare()
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t('gallery.shareNative', { defaultValue: 'Teilen...' })}
          </DropdownMenuItem>
        )}
        
        {/* Twitter/X */}
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault()
            shareToTwitter()
          }}
        >
          <Twitter className="h-4 w-4 mr-2" />
          {t('gallery.shareTwitter', { defaultValue: 'Auf X (Twitter) teilen' })}
        </DropdownMenuItem>
        
        {/* LinkedIn */}
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault()
            shareToLinkedIn()
          }}
        >
          <Linkedin className="h-4 w-4 mr-2" />
          {t('gallery.shareLinkedIn', { defaultValue: 'Auf LinkedIn teilen' })}
        </DropdownMenuItem>
        
        {/* Facebook */}
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault()
            shareToFacebook()
          }}
        >
          <Facebook className="h-4 w-4 mr-2" />
          {t('gallery.shareFacebook', { defaultValue: 'Auf Facebook teilen' })}
        </DropdownMenuItem>
        
        {/* Link kopieren */}
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault()
            void handleCopyLink()
          }}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              {t('gallery.linkCopied', { defaultValue: 'Link kopiert!' })}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              {t('gallery.copyLink', { defaultValue: 'Link kopieren' })}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

