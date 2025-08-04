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
import { localStorageSchema, type StorageFormProps } from "./types"
import { SettingsLogger } from "@/lib/debug/logger"

type LocalFormData = {
  type: "local"
  path: string
}

export function LocalForm({ defaultValues, onSubmit, onTest, isLoading, isTestLoading }: StorageFormProps) {
  const form = useForm<LocalFormData>({
    resolver: zodResolver(localStorageSchema),
    defaultValues: {
      type: "local",
      path: "",
      ...defaultValues,
    }
  })

  // Form mit Defaults befüllen, wenn verfügbar
  useEffect(() => {
    if (defaultValues) {
      SettingsLogger.info('LocalForm', 'Befülle Form mit Default-Werten', defaultValues)
      form.reset({
        type: "local",
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
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="C:\Pfad\zu\Ihren\Dateien oder /pfad/zu/ihren/dateien"
                />
              </FormControl>
              <FormDescription>
                Der absolute Pfad auf Ihrem lokalen Dateisystem, wo die Dateien gespeichert werden sollen.
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
              {isTestLoading ? "Teste..." : "Pfad prüfen"}
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