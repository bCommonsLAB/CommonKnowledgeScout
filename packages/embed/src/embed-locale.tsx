'use client'

/**
 * Die Sprache der Oberflaeche aus der Prop, vor dem ersten Zeichnen.
 *
 * In der App ermittelt `LocaleProvider` die Sprache aus URL, Cookie und
 * Browser. Im Embed gehoeren URL und Cookies der fremden Seite — die Sprache
 * kommt deshalb ausdruecklich als Prop und wird nur in den eigenen Speicher
 * gespiegelt (`useApplyLocale`, kein Cookie, kein Neuladen).
 */

import { useLayoutEffect } from 'react'
import type { Locale } from '@ks/i18n'
import { useApplyLocale } from '@ks/i18n/react'

export function EmbedLocale({ locale }: { locale: Locale }) {
  const anwenden = useApplyLocale()
  useLayoutEffect(() => {
    anwenden(locale)
  }, [anwenden, locale])
  return null
}
