"use client"

/**
 * NextcloudSection — Nextcloud/WebDAV Konfigurationsfelder.
 *
 * Extrahiert aus storage-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält WebDAV-URL, Benutzername und App-Passwort.
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import type { storageFormSchema } from "./hooks/use-storage-form"
// ClientLibrary ist der maskierte UI-Typ aus librariesAtom.
// Nextcloud-spezifische Felder (config.nextcloud.appPassword) sind in
// ClientLibrary.config nicht typisiert. Lokaler Cast analog zu
// use-storage-form.ts; sauberer Vertrag in separater Architektur-Welle.
import type { ClientLibrary } from "@/types/library"

/** Provider-spezifische Nextcloud-Felder im Library-Config (nicht in ClientLibrary typisiert) */
interface NextcloudLibraryConfig {
  nextcloud?: {
    webdavUrl?: string
    username?: string
    appPassword?: string
  }
}

interface NextcloudSectionProps {
  /** React-Hook-Form Instanz */
  form: UseFormReturn<z.infer<typeof storageFormSchema>>
  /** Aktive Library für Konfigurations-Anzeige */
  activeLibrary: ClientLibrary
}

/**
 * Section-Komponente für Nextcloud/WebDAV-Konfiguration im Storage-Formular.
 */
export function NextcloudSection({ form, activeLibrary }: NextcloudSectionProps) {
  // Provider-spezifische Felder einmalig per Cast extrahieren — analog zu
  // use-storage-form.ts. Siehe Begruendungs-Kommentar oben.
  const nextcloudCfg = activeLibrary.config as NextcloudLibraryConfig | undefined
  const appPasswordStored = nextcloudCfg?.nextcloud?.appPassword === '********'
  return (
    <>
      <FormField
        control={form.control}
        name="nextcloudWebdavUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>WebDAV-URL</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="https://cloud.example.com/remote.php/dav/files/username"
              />
            </FormControl>
            <FormDescription>
              Die vollständige WebDAV-URL Ihrer Nextcloud-Instanz.
              Typisches Format: https://[domain]/remote.php/dav/files/[benutzername]
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="nextcloudUsername"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Benutzername</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="Nextcloud-Benutzername"
              />
            </FormControl>
            <FormDescription>
              Ihr Nextcloud-Benutzername.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="nextcloudAppPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>App-Passwort</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                value={field.value ?? ''}
                placeholder={
                  appPasswordStored
                    ? "App-Passwort ist gespeichert (zum Ändern neuen Wert eingeben)"
                    : "Nextcloud App-Passwort eingeben"
                }
              />
            </FormControl>
            <FormDescription>
              Ein App-Passwort aus Ihrer Nextcloud-Instanz (Einstellungen → Sicherheit → Geräte & Sitzungen).
              {appPasswordStored && (
                <span className="block mt-1 text-green-600 dark:text-green-400">
                  ✓ Ein App-Passwort ist bereits gespeichert. Lassen Sie das Feld leer, um es beizubehalten.
                </span>
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
