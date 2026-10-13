"use client"

/**
 * Typ-spezifische Felder des Verbindungs-Formulars: Nextcloud (WebDAV-URL,
 * Benutzer, App-Passwort) oder OneDrive (Tenant-ID, Client-ID, Client-Secret).
 * Ein gespeichertes Geheimnis bleibt erhalten, wenn das Feld leer bleibt.
 */

import type { UseFormReturn } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input } from '@ks/ui'
import type { ConnectionFormValues } from "./connection-form-schema"
import type { StorageConnectionType } from "@/types/storage-connection"

interface FeldProps {
  form: UseFormReturn<ConnectionFormValues>
  name: keyof ConnectionFormValues
  label: string
  description: string
  placeholder?: string
  secret?: boolean
  secretStored?: boolean
}

function Feld({ form, name, label, description, placeholder, secret = false, secretStored = false }: FeldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={secret ? "password" : "text"}
              autoComplete={secret ? "new-password" : "off"}
              placeholder={secret && secretStored ? "gespeichert — leer lassen zum Beibehalten" : placeholder}
            />
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

interface ConnectionTypeFieldsProps {
  form: UseFormReturn<ConnectionFormValues>
  type: StorageConnectionType
  /** Beim Aendern: ein Geheimnis ist schon gespeichert. */
  secretStored: boolean
}

export function ConnectionTypeFields({ form, type, secretStored }: ConnectionTypeFieldsProps) {
  if (type === "nextcloud") {
    return (
      <>
        <Feld form={form} name="webdavUrl" label="WebDAV-URL" placeholder="https://cloud.example.com/remote.php/dav/files/loginname"
          description="Die vollständige WebDAV-URL Ihrer Nextcloud: https://[domain]/remote.php/dav/files/[loginname]" />
        <Feld form={form} name="username" label="Benutzername" placeholder="Nextcloud-Loginname"
          description="Ihr Nextcloud-Loginname (nicht der Anzeigename)." />
        <Feld form={form} name="appPassword" label="App-Passwort" secret secretStored={secretStored}
          description="Ein App-Passwort aus Nextcloud (Einstellungen → Sicherheit → Geräte & Sitzungen). Wird verschlüsselt gespeichert." />
      </>
    )
  }
  return (
    <>
      <Feld form={form} name="tenantId" label="Tenant-ID" placeholder="z. B. common oder die Verzeichnis-ID"
        description="Mandant der Azure-App-Registrierung." />
      <Feld form={form} name="clientId" label="Client-ID" placeholder="Anwendungs-ID (GUID)"
        description="Anwendungs-ID der Azure-App-Registrierung." />
      <Feld form={form} name="clientSecret" label="Client-Secret" secret secretStored={secretStored}
        description="Der Client-Secret-VALUE (der lange String beim Erzeugen), nicht die Secret-ID. Wird verschlüsselt gespeichert." />
    </>
  )
}
