"use client"

/**
 * @fileoverview Programm-Kopf der Session-Ansicht: Datum, Uhrzeit, Raum, Track.
 *
 * @description
 * Owner 06.11.2026: Wer einen Vortrag in der Galerie aufruft, will sich
 * orientieren, wann und wo er stattfindet. Die Felder lagen bisher nur in
 * einem nirgends eingebundenen Aufklapper (`event-details-accordion.tsx`).
 * Hier stehen sie direkt unter dem Teaser, noch vor Anhaengen und Sprechern:
 * flach in einer Zeile, nur Symbol und Wert (Owner 06.11.2026, zweite Runde:
 * keine sichtbaren Beschriftungen, Uhrzeit als „12:20 · 40 min", kleinere
 * Schrift, damit vier Eintraege nebeneinander Platz haben). Die Beschriftung
 * bleibt fuer Screenreader und als Tooltip. Fehlende Werte lassen den Eintrag
 * weg; gibt es keinen einzigen Wert, rendert die Leiste nichts.
 *
 * @module library
 */

import * as React from "react"
import { Calendar, Clock, MapPin, Tag } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"

export interface SessionProgrammeData {
  date?: string
  starttime?: string
  endtime?: string
  duration?: string | number
  room?: string
  location?: string
  track?: string
}

interface SessionProgrammeBarProps {
  data: SessionProgrammeData
}

/** ISO-Datum (JJJJ-MM-TT) mit Wochentag in der Sprache der Oberflaeche; sonst der Rohwert. */
export function formatProgrammeDate(raw: string | undefined, language: string): string | undefined {
  if (!raw || raw.trim().length === 0) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return raw.trim()
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return raw.trim()
  try {
    return new Intl.DateTimeFormat(language, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d)
  } catch {
    return raw.trim()
  }
}

/** Uhrzeit als „10:30 – 11:00 · 30 min" aus Start, Ende und Dauer; was fehlt, bleibt weg. */
export function formatProgrammeTime(
  starttime: string | undefined,
  endtime: string | undefined,
  duration: string | number | undefined,
  minutesLabel: string,
): string | undefined {
  const start = starttime?.trim()
  const end = endtime?.trim()
  const dur = typeof duration === "number" ? String(duration) : duration?.trim()
  const span = start && end ? `${start} – ${end}` : start || end
  const durText = dur && dur.length > 0 ? `${dur} ${minutesLabel}` : undefined
  if (span && durText) return `${span} · ${durText}`
  return span || durText
}

export function SessionProgrammeBar({ data }: SessionProgrammeBarProps) {
  const { t, locale } = useTranslation()
  const items: Array<{ key: string; icon: React.ReactNode; label: string; value: string }> = []

  const date = formatProgrammeDate(data.date, locale)
  if (date) items.push({ key: "date", icon: <Calendar className="h-4 w-4" />, label: t("event.date"), value: date })

  const time = formatProgrammeTime(data.starttime, data.endtime, data.duration, t("event.minutesShort"))
  if (time) items.push({ key: "time", icon: <Clock className="h-4 w-4" />, label: t("event.time"), value: time })

  // Raum vor Veranstaltungsort: der Raum ist die Orientierung im Haus, der Ort steht
  // sonst (z. B. Rueckblicke ohne Raumangabe).
  const place = data.room?.trim() || data.location?.trim()
  if (place) items.push({ key: "room", icon: <MapPin className="h-4 w-4" />, label: data.room?.trim() ? t("event.room") : t("event.location"), value: place })

  const track = data.track?.trim()
  if (track) items.push({ key: "track", icon: <Tag className="h-4 w-4" />, label: t("event.track"), value: track })

  if (items.length === 0) return null

  return (
    <dl data-testid="session-programme-bar" className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap" title={item.label}>
          <span className="text-muted-foreground" aria-hidden="true">{item.icon}</span>
          <dt className="sr-only">{item.label}</dt>
          <dd className="font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
