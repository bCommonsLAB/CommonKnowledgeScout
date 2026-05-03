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
import type { Library } from "@/types/library"

interface NextcloudSectionProps {
  /** React-Hook-Form Instanz */
  form: UseFormReturn<z.infer<typeof storageFormSchema>>
  /** Aktive Library für Konfigurations-Anzeige */
  activeLibrary: Library
}

/**
 * Section-Komponente für Nextcloud/WebDAV-Konfiguration im Storage-Formular.
 */
export function NextcloudSection({ form, activeLibrary }: NextcloudSectionProps) {
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
                  activeLibrary?.config?.nextcloud?.appPassword === '********'
                    ? "App-Passwort ist gespeichert (zum Ändern neuen Wert eingeben)"
                    : "Nextcloud App-Passwort eingeben"
                }
              />
            </FormControl>
            <FormDescription>
              Ein App-Passwort aus Ihrer Nextcloud-Instanz (Einstellungen → Sicherheit → Geräte & Sitzungen).
              {activeLibrary?.config?.nextcloud?.appPassword === '********' && (
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
