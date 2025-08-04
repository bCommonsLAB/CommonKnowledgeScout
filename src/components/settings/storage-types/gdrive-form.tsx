"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { gdriveStorageSchema, type StorageFormProps } from "./types"
import { SettingsLogger } from "@/lib/debug/logger"

type GDriveFormData = {
  type: "gdrive"
  path: string
  clientId?: string
  clientSecret?: string
}

export function GDriveForm({ defaultValues, onSubmit, onTest, isLoading, isTestLoading }: StorageFormProps) {
  const form = useForm<GDriveFormData>({
    resolver: zodResolver(gdriveStorageSchema),
    defaultValues: {
      type: "gdrive",
      path: "",
      clientId: "",
      clientSecret: "",
      ...defaultValues,
    }
  })

  // Form mit Defaults befüllen, wenn verfügbar
  useEffect(() => {
    if (defaultValues) {
      SettingsLogger.info('GDriveForm', 'Befülle Form mit Default-Werten', defaultValues)
      form.reset({
        type: "gdrive",
        ...defaultValues,
      })
    }
  }, [defaultValues, form])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        <FormField
          control={form.control}
          name="path"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Speicherpfad</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                Der Pfad in Google Drive, unter dem die Dateien gespeichert werden sollen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <div className="flex items-center justify-between">
          {onTest && (
            <Button 
              type="button" 
              variant="outline"
              onClick={onTest}
              disabled={isTestLoading}
            >
              {isTestLoading ? "Teste..." : "Verbindung testen"}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}