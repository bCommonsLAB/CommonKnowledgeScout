'use client'

import { useTranslation, useSetLocale } from '@/lib/i18n/hooks'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'

/**
 * Sprachumschalter-Komponente
 * 
 * Zeigt ein Dropdown-Menü mit allen unterstützten Sprachen
 * und ermöglicht die Sprachauswahl
 */
export function LanguageSwitcher() {
  const { locale } = useTranslation()
  const setLocale = useSetLocale()

  // Sprachnamen für die Anzeige
  const languageNames: Record<Locale, string> = {
    de: 'Deutsch',
    it: 'Italiano',
    en: 'English',
    fr: 'Français',
    es: 'Español',
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="h-4 w-4" />
          <span className="sr-only">Sprache ändern</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLocale(lang)}
            className={locale === lang ? 'bg-muted font-medium' : ''}
          >
            <span className="flex items-center justify-between w-full">
              <span>{languageNames[lang]}</span>
              {locale === lang && <span className="ml-2">✓</span>}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

