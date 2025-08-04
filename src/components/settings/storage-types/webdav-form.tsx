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
import { webdavStorageSchema, type StorageFormProps } from "./types"
import { SettingsLogger } from "@/lib/debug/logger"

type WebDAVFormData = {
  type: "webdav"
  path: string
  url: string
  username: string
  password: string
  basePath?: string
}

export function WebDAVForm({ defaultValues, onSubmit, onTest, isLoading, isTestLoading }: StorageFormProps) {
  const form = useForm<WebDAVFormData>({
    resolver: zodResolver(webdavStorageSchema),
    defaultValues: {
      type: "webdav",
      path: "",
      url: "",
      username: "",
      password: "",
      basePath: "",
      ...defaultValues,
    }
  })

  // Form mit Defaults befüllen, wenn verfügbar
  useEffect(() => {
    if (defaultValues) {
      SettingsLogger.info('WebDAVForm', 'Befülle Form mit Default-Werten', defaultValues)
      form.reset({
        type: "webdav",
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
                Der lokale Bezeichner für diese WebDAV-Verbindung.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WebDAV URL</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || ""} 
                  placeholder="https://your-nextcloud.com/remote.php/dav/files/username/" 
                />
              </FormControl>
              <FormDescription>
                Die WebDAV-URL Ihrer Nextcloud-Instanz. Format: https://your-nextcloud.com/remote.php/dav/files/username/
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Benutzername</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} />
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="password" 
                  value={field.value || ""} 
                  placeholder="WebDAV-Passwort"
                />
              </FormControl>
              <FormDescription>
                Ihr Nextcloud-Passwort oder App-Passwort.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="basePath"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Basis-Pfad (optional)</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} placeholder="/" />
              </FormControl>
              <FormDescription>
                Der Basis-Pfad innerhalb Ihrer Nextcloud-Instanz. Lassen Sie leer für das Root-Verzeichnis.
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