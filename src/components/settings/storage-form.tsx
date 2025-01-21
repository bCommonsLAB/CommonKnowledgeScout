"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"

// Provider-spezifische Schemas
const filesystemConfigSchema = z.object({
  basePath: z.string().min(1, "Bitte geben Sie einen Basispfad an."),
})

const oneDriveConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID ist erforderlich"),
  clientSecret: z.string().min(1, "Client Secret ist erforderlich"),
  redirectUri: z.string().url("Bitte geben Sie eine gültige URL ein"),
})

const googleDriveConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID ist erforderlich"),
  clientSecret: z.string().min(1, "Client Secret ist erforderlich"),
  redirectUri: z.string().url("Bitte geben Sie eine gültige URL ein"),
})

const nextCloudConfigSchema = z.object({
  serverUrl: z.string().url("Bitte geben Sie eine gültige NextCloud-URL ein"),
  username: z.string().min(1, "Benutzername ist erforderlich"),
  password: z.string().min(1, "Passwort ist erforderlich"),
})

// Hauptschema für das Formular
const storageFormSchema = z.object({
  provider: z.enum(["filesystem", "onedrive", "googledrive", "nextcloud"], {
    required_error: "Bitte wählen Sie einen Storage-Provider aus.",
  }),
  config: z.union([
    filesystemConfigSchema,
    oneDriveConfigSchema,
    googleDriveConfigSchema,
    nextCloudConfigSchema,
  ]),
})

type StorageFormValues = z.infer<typeof storageFormSchema>

const defaultValues: Partial<StorageFormValues> = {
  provider: "filesystem",
  config: {
    basePath: "/data/storage",
  },
}

export function StorageForm() {
  const [selectedProvider, setSelectedProvider] = useState<string>("filesystem")

  const form = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues,
  })

  function onSubmit(data: StorageFormValues) {
    toast({
      title: "Storage-Einstellungen gespeichert",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  // Provider-spezifische Konfigurationsfelder
  const ConfigFields = () => {
    switch (selectedProvider) {
      case "filesystem":
        return (
          <FormField
            control={form.control}
            name="config.basePath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Basispfad</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="/data/storage" />
                </FormControl>
                <FormDescription>
                  Der Basispfad für die Dateispeicherung auf dem lokalen System.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case "onedrive":
        return (
          <>
            <FormField
              control={form.control}
              name="config.clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Die Client ID Ihrer OneDrive-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Secret</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer OneDrive-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.redirectUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Redirect URI</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://ihre-domain.de/auth/callback" />
                  </FormControl>
                  <FormDescription>
                    Die Redirect URI für die OAuth2-Authentifizierung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )

      case "googledrive":
        return (
          <>
            <FormField
              control={form.control}
              name="config.clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
              name="config.clientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Secret</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Das Client Secret Ihrer Google Drive-Anwendung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.redirectUri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Redirect URI</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://ihre-domain.de/auth/callback" />
                  </FormControl>
                  <FormDescription>
                    Die Redirect URI für die OAuth2-Authentifizierung.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )

      case "nextcloud":
        return (
          <>
            <FormField
              control={form.control}
              name="config.serverUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://nextcloud.ihre-domain.de" />
                  </FormControl>
                  <FormDescription>
                    Die URL Ihres NextCloud-Servers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Benutzername</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Ihr NextCloud-Benutzername.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="config.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormDescription>
                    Ihr NextCloud-Passwort.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )

      default:
        return null
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Storage Provider</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value)
                  setSelectedProvider(value)
                  // Reset form when provider changes
                  form.reset({
                    provider: value as "filesystem" | "onedrive" | "googledrive" | "nextcloud",
                    config: defaultValues.config,
                  })
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen Sie einen Storage Provider" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="filesystem">Lokales Dateisystem</SelectItem>
                  <SelectItem value="onedrive">OneDrive</SelectItem>
                  <SelectItem value="googledrive">Google Drive</SelectItem>
                  <SelectItem value="nextcloud">NextCloud</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Wählen Sie den Storage Provider für Ihre Bibliothek.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardContent className="pt-6 space-y-4">
            <ConfigFields />
          </CardContent>
        </Card>

        <Button type="submit">Einstellungen speichern</Button>
      </form>
    </Form>
  )
} 