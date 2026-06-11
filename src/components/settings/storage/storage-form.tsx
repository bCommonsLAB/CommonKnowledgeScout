"use client"

/**
 * StorageForm — Formular für Storage-Einstellungen einer Library.
 *
 * Nutzt useStorageForm() für den gesamten State + Handler.
 * Render-Verantwortung: Typ-Auswahl, Pfad, Typ-spezifische Sections,
 * Test-Dialog und Speichern-Button.
 *
 * Sections-Split in Welle 3-IV-Settings-Sections:
 * - OneDriveSection  (Tenant ID, Client ID, Secret, OAuth-Flow)
 * - NextcloudSection (WebDAV-URL, Benutzername, App-Passwort)
 *
 * Refactored aus storage-form.tsx (Monolith, 1412z → ~250z Render-Datei).
 */

import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { StorageProviderType } from "@/types/library"
import { useStorageForm } from "./hooks/use-storage-form"
import type { TestLogEntry } from "./hooks/use-storage-form"
import { OneDriveSection } from "./onedrive-section"
import { NextcloudSection } from "./nextcloud-section"

// --------------------------------------------------------------------------
// Test-Ergebnisse rendern
// --------------------------------------------------------------------------

function TestResultTable({ testResults }: { testResults: TestLogEntry[] }) {
  if (testResults.length === 0) {
    return <p className="text-muted-foreground">Testergebnisse werden geladen...</p>;
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      <table className="w-full border-collapse table-fixed">
        <thead className="bg-muted/50">
          <tr className="text-xs border-b">
            <th className="text-left p-2 font-medium w-[90px]">Datum/Zeit</th>
            <th className="text-left p-2 font-medium w-[120px]">Funktion</th>
            <th className="text-left p-2 font-medium">Beschreibung</th>
            <th className="text-left p-2 font-medium w-[80px]">Status</th>
            <th className="text-left p-2 font-medium w-[60px]">Details</th>
          </tr>
        </thead>
        <tbody>
          {testResults
            .filter(result => result.step !== "API-Aufruf")
            .map((result, index) => (
              <tr
                key={index}
                className={`text-xs border-b hover:bg-muted/20 ${
                  result.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                  result.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' : ''
                }`}
              >
                <td className="p-2">
                  {result.timestamp && !isNaN(Date.parse(result.timestamp))
                    ? new Date(result.timestamp).toLocaleTimeString()
                    : ''}
                </td>
                <td className="p-2">{result.step}</td>
                <td className="p-2 overflow-hidden text-ellipsis whitespace-nowrap" title={result.message}>
                  {result.message}
                </td>
                <td className="p-2">
                  <Badge
                    variant={
                      result.status === 'error' ? 'destructive' :
                      result.status === 'success' ? 'default' : 'secondary'
                    }
                  >
                    {result.status}
                  </Badge>
                </td>
                <td className="p-2">
                  {result.details && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        toast.info("Details", {
                          description: typeof result.details === 'string'
                            ? result.details
                            : JSON.stringify(result.details),
                        });
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------
// Haupt-Formular-Inhalt (ohne useSearchParams, da Suspense-Wrapper nötig)
// --------------------------------------------------------------------------

function StorageFormContent() {
  const {
    form,
    activeLibrary,
    currentType,
    isLoading,
    isTesting,
    testDialogOpen,
    setTestDialogOpen,
    testResults,
    tokenStatus,
    onSubmit,
    handleOneDriveAuth,
    handleOneDriveLogout,
    handleTest,
  } = useStorageForm()

  // Hinweis: URL-Parameter (authSuccess/authError) werden im useStorageForm Hook
  // direkt über window.location.search verarbeitet (kein useSearchParams nötig).

  if (!activeLibrary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          {/* Speichertyp-Auswahl */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => {
              const currentValue = field.value || (activeLibrary?.type as StorageProviderType) || 'local';
              return (
                <FormItem>
                  <FormLabel>Speichertyp</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value === 'local' || value === 'onedrive' || value === 'nextcloud') {
                        field.onChange(value);
                      }
                    }}
                    value={currentValue}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie einen Speichertyp" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">Lokales Dateisystem</SelectItem>
                      <SelectItem value="onedrive">Microsoft OneDrive</SelectItem>
                      <SelectItem value="nextcloud">Nextcloud (WebDAV)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wählen Sie den Typ des Speichers, den Sie verwenden möchten.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* Speicherpfad */}
          <FormField
            control={form.control}
            name="path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Speicherpfad</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? (activeLibrary?.path || "")} />
                </FormControl>
                <FormDescription>
                  Der Pfad, unter dem die Dateien gespeichert werden sollen.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Typ-spezifische Felder via Section-Komponenten */}
          {currentType === 'onedrive' && (
            <OneDriveSection
              form={form}
              activeLibrary={activeLibrary}
              tokenStatus={tokenStatus}
              handleOneDriveAuth={handleOneDriveAuth}
              handleOneDriveLogout={handleOneDriveLogout}
            />
          )}
          {currentType === 'nextcloud' && (
            <NextcloudSection form={form} activeLibrary={activeLibrary} />
          )}

          {/* Test- und Speichern-Buttons */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !activeLibrary}
            >
              {isTesting ? "Teste..." : "Storage testen"}
            </Button>

            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Storage-Provider Test</DialogTitle>
                  <DialogDescription>
                    Test des Storage-Providers für die Bibliothek &quot;{activeLibrary.label}&quot;
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <TestResultTable testResults={testResults} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setTestDialogOpen(false)} variant="secondary">
                    Schließen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !form.formState.isDirty}
          >
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// --------------------------------------------------------------------------
// Exportierte Komponente mit Suspense (für useSearchParams)
// --------------------------------------------------------------------------

export function StorageForm() {
  return (
    <Suspense fallback={<div>Lade Storage-Einstellungen...</div>}>
      <StorageFormContent />
    </Suspense>
  );
}
