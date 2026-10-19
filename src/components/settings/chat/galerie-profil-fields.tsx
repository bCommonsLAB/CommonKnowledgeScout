"use client"

/**
 * Zwei Auswahlfelder im Abschnitt Wissensgalerie (Plan galerie-buergeransicht, G3):
 * Ansicht beim Oeffnen (`gallery.standardProfil`) und Start ohne Filter
 * (`gallery.startAnsicht`). Unbekannte Werte aus dem Select werden gemeldet
 * und nicht uebernommen (no-silent-fallbacks).
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import type { chatFormSchema } from './hooks/use-chat-form'
import { GALERIE_PROFILE, START_ANSICHTEN } from './galerie-profil-werte'

interface GalerieProfilFieldsProps {
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

export function GalerieProfilFields({ form }: GalerieProfilFieldsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-galerie-profil-felder>
      <FormField
        control={form.control}
        name="gallery.standardProfil"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settings.chatForm.galerieProfil', { defaultValue: 'Galerie: Ansicht beim Öffnen' })}</FormLabel>
            <Select
              value={field.value || 'experte'}
              onValueChange={(value) => {
                if (!(GALERIE_PROFILE as readonly string[]).includes(value)) {
                  console.error('[GalerieProfilFields] Unbekanntes Profil ignoriert:', value)
                  return
                }
                field.onChange(value)
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="experte">{t('settings.chatForm.galerieProfilExperte', { defaultValue: 'Experte (alle Werkzeuge)' })}</SelectItem>
                <SelectItem value="gefuehrt">{t('settings.chatForm.galerieProfilGefuehrt', { defaultValue: 'Einfach (Bürgeransicht)' })}</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>{t('settings.chatForm.galerieProfilDescription', { defaultValue: 'Welche Ansicht Besucher zuerst sehen; jeder kann in der Galerie umschalten.' })}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="gallery.startAnsicht"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settings.chatForm.galerieStart', { defaultValue: 'Galerie: Start ohne Filter' })}</FormLabel>
            <Select
              value={field.value || 'alle'}
              onValueChange={(value) => {
                if (!(START_ANSICHTEN as readonly string[]).includes(value)) {
                  console.error('[GalerieProfilFields] Unbekannte Start-Ansicht ignoriert:', value)
                  return
                }
                field.onChange(value)
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="alle">{t('settings.chatForm.galerieStartAlle', { defaultValue: 'Alle Einträge' })}</SelectItem>
                <SelectItem value="fokus">{t('settings.chatForm.galerieStartFokus', { defaultValue: 'Im Fokus (Rangliste der Sterne)' })}</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>{t('settings.chatForm.galerieStartDescription', { defaultValue: 'Was die Galerie ohne Adress-Parameter zeigt.' })}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
