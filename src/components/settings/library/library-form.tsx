"use client"

/**
 * @fileoverview Library-Settings-Formular — Grundlagen (meSpace).
 *
 * @description
 * Seit Welle 3-IV-UX-3a enthaelt diese Form nur noch die
 * Einsteiger-Grundlagen: Name, Aktiv-Status, Neue Bibliothek,
 * Speichern/Zuruecksetzen und die Gefahrenzone (Loeschen).
 * Die Experten-Teile (Shadow-Twin/Cache, Migration, Sprach-
 * Bereinigung, DIVA, Auto-Klassifikation, Import/Export) liegen in
 * library-advanced-form.tsx (Bereich "Erweitert").
 *
 * Nutzt den vollen useLibraryForm-Hook: react-hook-form haelt alle
 * Werte im State, Submit sendet die vollstaendige Struktur wie bisher.
 */

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
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { CreateLibraryDialog } from "@/components/library/create-library-dialog"
import { CORE_CONTENT_TYPES } from "@/components/settings/chat/content-type-section"

import { useLibraryForm } from "./hooks/use-library-form"

interface LibraryFormProps {
  createNew?: boolean;
}

/**
 * Grundlagen-Formular der Bibliothek.
 */
export function LibraryForm({ createNew = false }: LibraryFormProps) {
  const {
    form,
    onSubmit,
    isLoading,
    isNew,
    setIsNew,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    activeLibrary,
    handleCancelNew,
    handleDeleteLibrary,
  } = useLibraryForm(createNew);

  /** Formular-Reset auf aktuelle Library zurücksetzen */
  const handleReset = () => {
    if (activeLibrary) {
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: Bibliothek-Auswahl + Neue Bibliothek */}
      <div className="flex justify-between items-center">
        <div>
          {isNew ? (
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="font-medium">Neue Bibliothek erstellen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">
                {activeLibrary
                  ? `Bibliothek bearbeiten: ${activeLibrary.label}`
                  : "Bibliothek auswählen"}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isNew ? (
            <Button onClick={handleCancelNew} variant="outline" size="sm">
              Abbrechen
            </Button>
          ) : (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Bibliothek erstellen
            </Button>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Name */}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Geben Sie Ihrer Bibliothek einen treffenden Namen.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Onboarding: Inhaltstyp direkt bei der Erstellung waehlen —
                  Name + Inhaltstyp reichen, alles Weitere hat Standardwerte
                  (Petra-Review Punkt 2). */}
              {isNew && (
                <FormField
                  control={form.control}
                  name="detailViewType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Was wird Ihre Bibliothek enthalten?</FormLabel>
                      <FormControl>
                        <div className="grid gap-3 md:grid-cols-3">
                          {CORE_CONTENT_TYPES.map(option => (
                            <Card
                              key={option.value}
                              role="button"
                              onClick={() => field.onChange(option.value)}
                              className={`cursor-pointer transition-colors ${
                                field.value === option.value
                                  ? "border-primary ring-1 ring-primary"
                                  : "hover:border-muted-foreground/40"
                              }`}
                            >
                              <CardContent className="p-4">
                                <p className="text-sm font-medium">{option.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </FormControl>
                      <FormDescription>
                        Mehr braucht es nicht — Quelle, Vorlage und Darstellung
                        haben sinnvolle Standardwerte und lassen sich danach im
                        Archiv anpassen.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Bibliothek aktivieren */}
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Bibliothek aktivieren</FormLabel>
                      <FormDescription>
                        Wenn deaktiviert, wird die Bibliothek in der Anwendung nicht angezeigt.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Formular-Aktionen */}
          <div className="flex justify-between">
            {!isNew && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
              >
                Zurücksetzen
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || (!isNew && !form.formState.isDirty)}
            >
              {isLoading
                ? "Wird gespeichert..."
                : isNew
                ? "Bibliothek erstellen"
                : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Gefahrenzone: Bibliothek löschen */}
      {!isNew && activeLibrary && (
        <div className="mt-10">
          <h3 className="text-lg font-medium text-destructive">Gefahrenzone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Hier können Sie die aktuelle Bibliothek unwiderruflich löschen.
          </p>
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">
                    Bibliothek &quot;{activeLibrary.label}&quot; löschen
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen einer Bibliothek ist permanent und kann nicht rückgängig gemacht
                    werden. Alle Einstellungen und Verweise auf diese Bibliothek gehen verloren.
                  </p>
                </div>
                <Dialog
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Bibliothek &quot;{activeLibrary.label}&quot; löschen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bibliothek löschen</DialogTitle>
                      <DialogDescription>
                        Sind Sie sicher, dass Sie die Bibliothek &quot;{activeLibrary.label}&quot;
                        löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDeleteLibrary()}
                        disabled={isLoading}
                      >
                        {isLoading
                          ? "Wird gelöscht..."
                          : "Bibliothek unwiderruflich löschen"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: Neue Bibliothek erstellen */}
      <CreateLibraryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={() => {
          setIsNew(false);
        }}
      />
    </div>
  );
}
