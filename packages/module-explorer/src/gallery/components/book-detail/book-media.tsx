"use client"

/**
 * Optionaler Medien-Block der Buch-Ansicht: eingebettetes Video (`video_url`) und/oder
 * Audio-Player (`audio_url`). Rendert nichts, wenn beide Felder fehlen oder keine
 * sichere Embed-Form haben — dieselben Guards wie die Ereignis-Ansicht der App.
 *
 * Anlass (Owner 15.09.): Karten und Methoden der Commoning-Mustersprache bleiben
 * `book` (Galerie-Karten im Hochformat), sollen aber Audio und Video direkt in der
 * Detailansicht abspielen — auch im Embed.
 */

import * as React from "react"
import { isSafeVideoIframeSrc, isSafeAudioIframeSrc, isDirectAudioFileUrl } from "@ks/util"

interface BookMediaProps {
  videoUrl?: string
  audioUrl?: string
}

export function BookMedia({ videoUrl, audioUrl }: BookMediaProps) {
  const video = videoUrl && isSafeVideoIframeSrc(videoUrl) ? videoUrl : undefined
  const audioIframe = audioUrl && isSafeAudioIframeSrc(audioUrl) ? audioUrl : undefined
  const audioFile = !audioIframe && audioUrl && isDirectAudioFileUrl(audioUrl) ? audioUrl : undefined
  if (!video && !audioIframe && !audioFile) return null

  return (
    <div className="mb-6 space-y-4">
      {video && (
        <div className="aspect-video rounded-lg overflow-hidden bg-muted w-full max-w-full relative border border-border">
          <iframe
            src={video}
            className="absolute inset-0 w-full h-full max-w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            title="Video"
          />
        </div>
      )}
      {audioIframe && (
        <div className="rounded-lg overflow-hidden bg-muted w-full max-w-full border border-border">
          <iframe
            src={audioIframe}
            className="w-full max-w-full block"
            style={{ height: 120 }}
            allow="autoplay"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
            title="Audio"
          />
        </div>
      )}
      {audioFile && (
        <div className="w-full max-w-full">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="none" src={audioFile} className="w-full" />
        </div>
      )}
    </div>
  )
}
