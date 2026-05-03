"use client"

/**
 * GdriveSection — Google Drive Konfigurationsfelder.
 *
 * Extrahiert aus storage-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält Client ID und Client Secret für Google Drive OAuth.
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

interface GdriveSectionProps {
  /** React-Hook-Form Instanz */
  form: UseFormReturn<z.infer<typeof storageFormSchema>>
}

/**
 * Section-Komponente für Google Drive-Konfiguration im Storage-Formular.
 */
export function GdriveSection({ form }: GdriveSectionProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="clientId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client ID</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ""} />
            </FormControl>
            <FormDescription>
              Die Client ID Ihrer Google Drive-Anwendung.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="clientSecret"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client Secret</FormLabel>
            <FormControl>
              <Input {...field} type="password" value={field.value || ""} />
            </FormControl>
            <FormDescription>
              Das Client Secret Ihrer Google Drive-Anwendung.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
