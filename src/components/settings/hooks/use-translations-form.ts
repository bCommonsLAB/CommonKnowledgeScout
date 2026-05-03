/**
 * @fileoverview Hook für TranslationsForm-State und Aktionen
 *
 * @description
 * Extrahiert State-Verwaltung und API-Aktionen aus translations-form.tsx.
 * Der Hook kapselt:
 * - Initialisierung aus der aktiven Library-Config
 * - toggleLocale: Ziel-Locales umschalten
 * - onSave: Translations-Konfig per PATCH speichern + optimistisches Update
 *
 * @module settings/hooks
 */

import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { toast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'
import { SUPPORTED_LOCALES, type Locale, DEFAULT_LOCALE } from '@/lib/i18n'
import type { TranslationsConfig } from '@/types/library'

interface UseTranslationsFormReturn {
  /** Aktuell ausgewaehlte Ziel-Locales */
  targetLocales: Locale[]
  /** Aktuell ausgewaehlte Fallback-Locale */
  fallbackLocale: Locale
  /** Flag: Auto-Translate beim Publish */
  autoTranslate: boolean
  /** Setzt fallbackLocale */
  setFallbackLocale: (locale: Locale) => void
  /** Setzt autoTranslate */
  setAutoTranslate: (value: boolean) => void
  /** Schaltet eine Ziel-Locale ein oder aus */
  toggleLocale: (loc: Locale, on: boolean) => void
  /** Speichert die Konfig per API */
  onSave: () => Promise<void>
  /** Lade-Zustand waehrend Speichern */
  isLoading: boolean
  /** true wenn noch keine Library ausgewaehlt */
  noLibrarySelected: boolean
}

/**
 * Hook fuer den TranslationsForm-State.
 * Kein libraryId-Parameter noetig — nutzt activeLibraryIdAtom direkt.
 */
export function useTranslationsForm(): UseTranslationsFormReturn {
  const { t } = useTranslation()
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)

  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)

  // Formular-State
  const [targetLocales, setTargetLocales] = useState<Locale[]>([])
  const [fallbackLocale, setFallbackLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [autoTranslate, setAutoTranslate] = useState<boolean>(true)

  // Initialisierung aus Library-Config bei Wechsel der aktiven Library
  useEffect(() => {
    const cfg: TranslationsConfig | undefined = activeLibrary?.config?.translations
    setTargetLocales(Array.isArray(cfg?.targetLocales) ? cfg!.targetLocales! : [])
    setFallbackLocale(cfg?.fallbackLocale ?? DEFAULT_LOCALE)
    setAutoTranslate(cfg?.autoTranslateOnPublish ?? true)
  }, [activeLibraryId, activeLibrary?.config?.translations])

  /** Schaltet eine Ziel-Locale ein (on=true) oder aus (on=false).
   *  Reihenfolge folgt SUPPORTED_LOCALES fuer stabile Anzeige. */
  function toggleLocale(loc: Locale, on: boolean) {
    setTargetLocales((prev) => {
      const set = new Set(prev)
      if (on) set.add(loc)
      else set.delete(loc)
      return SUPPORTED_LOCALES.filter((l) => set.has(l))
    })
  }

  /** Speichert Translations-Konfig per PATCH und aktualisiert lokalen State */
  async function onSave() {
    if (!activeLibrary) return
    setIsLoading(true)

    try {
      const next: TranslationsConfig = {
        targetLocales,
        fallbackLocale,
        autoTranslateOnPublish: autoTranslate,
      }
      const res = await fetch(
        `/api/libraries/${encodeURIComponent(activeLibrary.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeLibrary.id,
            config: { translations: next },
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)

      // Optimistisches Update: andere Views sehen neue Defaults sofort
      setLibraries(
        libraries.map((lib) =>
          lib.id === activeLibrary.id
            ? { ...lib, config: { ...lib.config, translations: next } }
            : lib,
        ),
      )

      toast({
        title: t('settings.translations.saved', { defaultValue: 'Sprach-Einstellungen gespeichert' }),
      })
    } catch (err) {
      toast({
        title: t('settings.translations.error', { defaultValue: 'Fehler beim Speichern' }),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    targetLocales,
    fallbackLocale,
    autoTranslate,
    setFallbackLocale,
    setAutoTranslate,
    toggleLocale,
    onSave,
    isLoading,
    noLibrarySelected: !activeLibrary,
  }
}
