"use client"

/**
 * OneDriveSection — Microsoft OneDrive Konfigurationsfelder.
 *
 * Extrahiert aus storage-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält Tenant ID, Client ID, Client Secret sowie den OAuth-Flow
 * (Anmelden/Abmelden) und den Token-Status-Anzeige.
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
import { Button } from "@/components/ui/button"
import { Cloud, CheckCircle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { UseFormReturn } from "react-hook-form"
import type { z } from "zod"
import type { storageFormSchema } from "./hooks/use-storage-form"
// ClientLibrary ist der maskierte UI-Typ aus librariesAtom.
// Provider-spezifische Felder (tenantId/clientId/clientSecret) sind in
// ClientLibrary.config nicht typisiert. Wir lesen sie via lokalem Cast,
// analog zum Pattern in use-storage-form.ts. Ein sauberer Typ-Vertrag
// gehoert in eine separate Architektur-Welle (ClientLibrary.config-Erweiterung).
import type { ClientLibrary } from "@/types/library"

/** Provider-spezifische OneDrive-Felder im Library-Config (nicht in ClientLibrary typisiert) */
interface OneDriveLibraryConfig {
  tenantId?: string
  clientId?: string
  clientSecret?: string
}

/** Token-Status für OneDrive-Authentifizierung */
interface TokenStatus {
  isAuthenticated: boolean
  isExpired: boolean
  loading: boolean
}

interface OneDriveSectionProps {
  /** React-Hook-Form Instanz */
  form: UseFormReturn<z.infer<typeof storageFormSchema>>
  /** Aktive Library für Konfigurations-Anzeige */
  activeLibrary: ClientLibrary
  /** Aktueller OAuth-Token-Status */
  tokenStatus: TokenStatus
  /** Startet den OneDrive-OAuth-Flow */
  handleOneDriveAuth: () => Promise<void>
  /** Meldet von OneDrive ab */
  handleOneDriveLogout: () => Promise<void>
}

/**
 * Section-Komponente für OneDrive-Konfiguration im Storage-Formular.
 */
export function OneDriveSection({
  form,
  activeLibrary,
  tokenStatus,
  handleOneDriveAuth,
  handleOneDriveLogout,
}: OneDriveSectionProps) {
  // Provider-spezifische Felder einmalig per Cast extrahieren — analog zu
  // use-storage-form.ts. ClientLibrary.config typisiert OneDrive-Felder
  // nicht; das ist der dokumentierte Drift, der in einer separaten
  // Architektur-Welle aufgeloest wird (Erweiterung von ClientLibrary.config).
  const onedriveCfg = activeLibrary.config as OneDriveLibraryConfig | undefined
  return (
    <>
      <FormField
        control={form.control}
        name="tenantId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tenant ID</FormLabel>
            <FormControl>
              <Input {...field} value={String((field.value ?? onedriveCfg?.tenantId) ?? '')} />
            </FormControl>
            <FormDescription>
              Die Tenant ID Ihres Microsoft Azure AD-Verzeichnisses. Lassen Sie dieses Feld leer für persönliche Microsoft-Konten.
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
              <Input {...field} value={String((field.value ?? onedriveCfg?.clientId) ?? '')} />
            </FormControl>
            <FormDescription>
              Die Client ID Ihrer Microsoft Azure AD-Anwendung.
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
              <Input
                {...field}
                type="password"
                value={field.value ?? ""}
                placeholder={
                  onedriveCfg?.clientSecret === '********'
                    ? "Client Secret ist gespeichert (zum Ändern neuen Wert eingeben)"
                    : "Client Secret eingeben"
                }
              />
            </FormControl>
            <FormDescription>
              Das Client Secret Ihrer Microsoft Azure AD-Anwendung.
              {onedriveCfg?.clientSecret === '********' && (
                <span className="block mt-1 text-green-600 dark:text-green-400">
                  ✓ Ein Client Secret ist bereits gespeichert. Lassen Sie das Feld leer, um es beizubehalten.
                </span>
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="mt-4">
        <Button
          type="button"
          variant={tokenStatus.isAuthenticated ? "destructive" : "secondary"}
          onClick={tokenStatus.isAuthenticated ? handleOneDriveLogout : handleOneDriveAuth}
          className="w-full"
        >
          <Cloud className="h-4 w-4 mr-2" />
          {tokenStatus.isAuthenticated ? "Von OneDrive abmelden" : "Bei OneDrive anmelden"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {tokenStatus.isAuthenticated
            ? "Klicken Sie auf den Button, um sich von OneDrive abzumelden und den Zugriff zu widerrufen."
            : "Klicken Sie auf den Button, um sich bei OneDrive anzumelden und Zugriff auf Ihre Dateien zu erteilen."
          }
        </p>

        {/* Token-Status anzeigen */}
        {tokenStatus.loading ? (
          <div className="mt-3 text-sm text-muted-foreground">
            Lade Authentifizierungsstatus...
          </div>
        ) : tokenStatus.isAuthenticated ? (
          <Alert className="mt-3">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Authentifiziert</AlertTitle>
            <AlertDescription>
              Sie sind bei OneDrive angemeldet.
              {tokenStatus.isExpired && (
                <span className="text-yellow-600 dark:text-yellow-400 block mt-1">
                  ⚠️ Die Authentifizierung ist abgelaufen. Bitte melden Sie sich erneut an.
                </span>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mt-3" variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Nicht authentifiziert</AlertTitle>
            <AlertDescription>
              Sie müssen sich bei OneDrive anmelden, um auf Ihre Dateien zugreifen zu können.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  )
}
