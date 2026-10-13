"use client"

/**
 * Dialog zum Anlegen und Aendern einer Speicher-Verbindung. Der Typ wird nur
 * beim Anlegen gewaehlt; Knopfzeile bricht nie um.
 */

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@ks/ui'
import type { StorageConnectionInput, StorageConnectionSummary } from "@/types/storage-connection"
import { connectionFormSchema, fehlendePflichtfelder, readConnectionForm, toConnectionInput, type ConnectionFormValues } from "./connection-form-schema"
import { ConnectionTypeFields } from "./connection-type-fields"

interface ConnectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = anlegen */
  existing: StorageConnectionSummary | null
  onSubmit: (input: StorageConnectionInput) => Promise<void>
}

const FELD_NAMEN: Record<string, string> = {
  webdavUrl: "WebDAV-URL", username: "Benutzername", appPassword: "App-Passwort",
  tenantId: "Tenant-ID", clientId: "Client-ID", clientSecret: "Client-Secret",
}

export function ConnectionFormDialog({ open, onOpenChange, existing, onSubmit }: ConnectionFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const form = useForm<ConnectionFormValues>({ resolver: zodResolver(connectionFormSchema), defaultValues: readConnectionForm(existing) })

  useEffect(() => {
    if (open) {
      form.reset(readConnectionForm(existing))
      setServerError(null)
    }
  }, [open, existing, form])

  const type = form.watch("type")
  const secretStored = existing?.type === "nextcloud" ? existing.nextcloud?.appPasswordSet === true : existing?.onedrive?.clientSecretSet === true

  const handleSubmit = async (values: ConnectionFormValues) => {
    const fehlend = fehlendePflichtfelder(values, existing === null)
    if (fehlend.length > 0) {
      for (const feld of fehlend) form.setError(feld, { message: `${FELD_NAMEN[feld] ?? feld} fehlt.` })
      return
    }
    setIsSaving(true)
    setServerError(null)
    try {
      await onSubmit(toConnectionInput(values))
      onOpenChange(false)
    } catch (error) {
      console.error("[ConnectionFormDialog] Speichern fehlgeschlagen:", error)
      setServerError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Verbindung „${existing.label}" bearbeiten` : "Neue Speicher-Verbindung"}</DialogTitle>
          <DialogDescription>
            Zugangsdaten gehören zu Ihrem Konto und gelten für alle Bibliotheken auf dieser Verbindung.
            Geheimnisse werden verschlüsselt gespeichert und nie wieder angezeigt.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="label" render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl><Input {...field} placeholder="z. B. Nextcloud Verein" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {existing === null && (
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="nextcloud">Nextcloud (WebDAV)</SelectItem>
                      <SelectItem value="onedrive">OneDrive (Microsoft 365)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <ConnectionTypeFields form={form} type={type} secretStored={secretStored} />
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
              <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Abbrechen
              </Button>
              <Button type="submit" className="whitespace-nowrap" disabled={isSaving}>
                {isSaving ? "Wird gespeichert..." : existing ? "Speichern" : "Anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
