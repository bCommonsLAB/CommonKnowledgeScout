/**
 * @fileoverview Library-Settings: Doc-Translations
 *
 * @description
 * Konfiguriert pro Library:
 *  - `targetLocales`: Sprachen, in die Dokumente bei Publish uebersetzt werden.
 *  - `fallbackLocale`: Anzeige-Sprache, wenn die UI-Locale nicht uebersetzt ist.
 *  - `autoTranslateOnPublish`: Steuert, ob Publish automatisch Translation-Jobs anstoesst.
 *
 * Die Konfiguration wird nach `library.config.translations` geschrieben.
 *
 * @module components/settings
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'
import { SUPPORTED_LOCALES, type Locale, DEFAULT_LOCALE } from '@/lib/i18n'
import type { TranslationsConfig } from '@/types/library'

/** Menschenlesbare Locale-Labels (kein zusaetzlicher i18n-Roundtrip noetig) */
const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
  fr: 'Français',
  es: 'Español',
}

export function TranslationsForm() {
  const { t } = useTranslation()
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)

  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)

  // Initial-Werte aus der Library-Config
  const [targetLocales, setTargetLocales] = useState<Locale[]>([])
  const [fallbackLocale, setFallbackLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [autoTranslate, setAutoTranslate] = useState<boolean>(true)

  useEffect(() => {
    const cfg: TranslationsConfig | undefined = activeLibrary?.config?.translations
    setTargetLocales(Array.isArray(cfg?.targetLocales) ? cfg!.targetLocales! : [])
    setFallbackLocale(cfg?.fallbackLocale ?? DEFAULT_LOCALE)
    setAutoTranslate(cfg?.autoTranslateOnPublish ?? true)
  }, [activeLibraryId, activeLibrary?.config?.translations])

  if (!activeLibrary) {
    return (
      <div className='text-sm text-muted-foreground'>
        {t('settings.translations.selectLibrary', {
          defaultValue: 'Bitte zuerst eine Library auswählen.',
        })}
      </div>
    )
  }

  function toggleLocale(loc: Locale, on: boolean) {
    setTargetLocales((prev) => {
      const set = new Set(prev)
      if (on) set.add(loc)
      else set.delete(loc)
      // Reihenfolge wie SUPPORTED_LOCALES, fuer stabile Anzeige.
      return SUPPORTED_LOCALES.filter((l) => set.has(l))
    })
  }

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
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      // Optimistisches Update des lokalen Library-State, damit andere Views (z.B. Galerie)
      // sofort die neuen Defaults sehen.
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

  return (
    <div className='space-y-6'>
      <div className='border-b pb-2'>
        <h3 className='text-lg font-semibold'>
          {t('settings.translations.title', { defaultValue: 'Dokumenten-Übersetzungen' })}
        </h3>
        <p className='text-sm text-muted-foreground'>
          {t('settings.translations.subtitle', {
            defaultValue:
              'Lege fest, in welche Sprachen Dokumente beim Publish automatisch übersetzt werden.',
          })}
        </p>
      </div>

      {/* Ziel-Locales: Multi-Select via Checkboxes (uebersichtlich bei wenigen Sprachen) */}
      <div className='space-y-2'>
        <Label className='text-sm font-medium'>
          {t('settings.translations.targetLocales', { defaultValue: 'Ziel-Sprachen' })}
        </Label>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2'>
          {SUPPORTED_LOCALES.map((loc) => {
            const checked = targetLocales.includes(loc)
            return (
              <label
                key={loc}
                className='flex items-center gap-2 rounded border px-3 py-2 cursor-pointer hover:bg-muted/50'
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleLocale(loc, Boolean(v))}
                />
                <span className='text-sm'>
                  {LOCALE_LABELS[loc]}{' '}
                  <span className='text-muted-foreground uppercase'>({loc})</span>
                </span>
              </label>
            )
          })}
        </div>
        <p className='text-xs text-muted-foreground'>
          {t('settings.translations.targetLocalesHint', {
            defaultValue:
              'Beim Publish eines Dokuments wird pro ausgewählter Sprache ein Übersetzungs-Job gestartet.',
          })}
        </p>
      </div>

      {/* Fallback-Locale: Single-Select */}
      <div className='space-y-2 max-w-xs'>
        <Label className='text-sm font-medium'>
          {t('settings.translations.fallbackLocale', { defaultValue: 'Fallback-Sprache' })}
        </Label>
        <Select
          value={fallbackLocale}
          onValueChange={(v) => setFallbackLocale(v as Locale)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {LOCALE_LABELS[loc]} ({loc})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className='text-xs text-muted-foreground'>
          {t('settings.translations.fallbackLocaleHint', {
            defaultValue:
              'Wird verwendet, wenn die globale UI-Sprache nicht in den Ziel-Sprachen enthalten ist.',
          })}
        </p>
      </div>

      {/* Auto-Translate-Switch */}
      <div className='flex items-center gap-3'>
        <Switch
          id='auto-translate'
          checked={autoTranslate}
          onCheckedChange={setAutoTranslate}
        />
        <Label htmlFor='auto-translate' className='text-sm'>
          {t('settings.translations.autoTranslate', {
            defaultValue: 'Beim Publish automatisch Übersetzungs-Jobs starten',
          })}
        </Label>
      </div>

      <div className='pt-2'>
        <Button onClick={onSave} disabled={isLoading}>
          {isLoading
            ? t('common.saving', { defaultValue: 'Speichere…' })
            : t('common.save', { defaultValue: 'Speichern' })}
        </Button>
      </div>
    </div>
  )
}
