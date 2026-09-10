"use client"

import * as React from "react"
import type { ComponentType } from "react"
import { ExternalLink, FileText, Globe, Paperclip } from "lucide-react"
import {
  classifyReferences,
  groupReferencesByFormat,
  type ClassifiedReference,
  type ReferenceFormat,
  type ReferenceInput,
} from "../../lib/reference-format"
import type { GalleryImageProps } from "../../contexts/gallery-host-context"

interface AttachmentListProps {
  /**
   * Verweise/Anhaenge: reine URLs (z.B. data.attachments_url) ODER
   * `{ url, name }` (aufgeloeste Links, Format aus dem Dateinamen).
   */
  references: ReferenceInput[] | undefined
  /** Optionaler Abschnitts-Titel (Default: „Anhänge"). */
  title?: string
  /** Womit die Bild-Vorschauen gerendert werden (App: `next/image`, Embed: `<img>`). */
  Bild: ComponentType<GalleryImageProps>
}

/** Deutsche Gruppen-Labels — exhaustiv ueber ReferenceFormat (kein Default-Loch). */
const FORMAT_LABEL: Record<ReferenceFormat, string> = {
  image: "Bilder",
  video: "Videos",
  audio: "Audio",
  pdf: "Dokumente",
  office: "Dateien",
  markdown: "Texte",
  web: "Links",
}

/**
 * Rendert Story-Verweise je Dokument **formatgerecht** (Plan 1 · A4c):
 * Bild → Vorschau, Video/Audio → Player, PDF/Office/Text → Dokument-Button,
 * Web → Link. Ersetzt die fruehere „PDF vs. Link"-Klassifikation.
 *
 * Storage-agnostisch: arbeitet nur auf URLs/Metadaten, kennt kein Backend.
 *
 * Seit M5 im Paket (vorher `src/components/library/story/reference-list.tsx`,
 * dort als `ReferenceList` weiter fuer die Session-Ansicht): Die Buch-Ansicht
 * des Embeds zeigt damit ihre Anhaenge. Anderer Name, weil die Galerie mit
 * `reference-list.tsx` schon eine Liste hat — die der Chat-Quellen.
 */
export function AttachmentList({ references, title = "Anhänge", Bild }: AttachmentListProps) {
  const groups = React.useMemo(
    () => groupReferencesByFormat(classifyReferences(references)),
    [references],
  )

  if (groups.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-lg p-5 mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
        <Paperclip className="w-4 h-4" />
        {title}
      </h2>
      <div className="space-y-4">
        {groups.map((group) => (
          <ReferenceGroup key={group.format} format={group.format} items={group.items} Bild={Bild} />
        ))}
      </div>
    </section>
  )
}

interface ReferenceGroupProps {
  format: ReferenceFormat
  items: ClassifiedReference[]
  Bild: ComponentType<GalleryImageProps>
}

function ReferenceGroup({ format, items, Bild }: ReferenceGroupProps) {
  return (
    <div data-format={format}>
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
        {FORMAT_LABEL[format]}
      </h3>
      {format === "image" ? (
        <ImageGrid items={items} Bild={Bild} />
      ) : format === "video" ? (
        <MediaPlayers items={items} kind="video" />
      ) : format === "audio" ? (
        <MediaPlayers items={items} kind="audio" />
      ) : (
        <LinkList items={items} format={format} />
      )}
    </div>
  )
}

function ImageGrid({ items, Bild }: { items: ClassifiedReference[]; Bild: ComponentType<GalleryImageProps> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-24 h-24 rounded border border-border overflow-hidden bg-secondary"
        >
          <Bild
            src={item.url}
            alt={item.name}
            width={96}
            height={96}
            unoptimized
            className="w-full h-full object-cover"
          />
        </a>
      ))}
    </div>
  )
}

function MediaPlayers({ items, kind }: { items: ClassifiedReference[]; kind: "video" | "audio" }) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={idx}>
          <div className="text-xs text-muted-foreground mb-1 truncate">{item.name}</div>
          {kind === "video" ? (
            <video controls preload="metadata" src={item.url} className="w-full max-w-md rounded border border-border">
              <track kind="captions" />
            </video>
          ) : (
            <audio controls preload="metadata" src={item.url} className="w-full max-w-md" aria-label={item.name} />
          )}
        </li>
      ))}
    </ul>
  )
}

function LinkList({ items, format }: { items: ClassifiedReference[]; format: ReferenceFormat }) {
  const Icon = format === "web" ? Globe : FileText
  return (
    <ul className="space-y-1.5">
      {items.map((item, idx) => (
        <li key={idx}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{item.name}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  )
}

export default AttachmentList
