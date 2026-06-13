"use client"

/**
 * CreateLibraryWizard — geführte Library-Anlage ("Petra-Flow") als Dialog.
 *
 * Schritt 1: Name + Inhaltstyp. Mehr braucht es nicht — Quelle, Vorlage und
 * Darstellung haben sinnvolle Standardwerte. Nach dem Erstellen leitet der
 * zugrunde liegende Hook automatisch ins Archiv weiter (Quelle einrichten =
 * nächster Petra-Schritt).
 *
 * Wiederverwendbar: wird vom Dashboard (/start), vom Top-Nav-Button "Neue
 * Bibliothek" und aus der Settings-Übersicht aufgerufen — statt drei
 * getrennter Anlage-Pfade. Die Anlage-Logik selbst liegt in useLibraryForm.
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { CORE_CONTENT_TYPES } from "@/components/settings/chat/content-type-section"
import { useLibraryForm } from "@/components/settings/library/hooks/use-library-form"

interface CreateLibraryWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Innerer Form-Teil: nutzt useLibraryForm(true). Bewusst nur gerendert, wenn
 * der Dialog offen ist — so läuft die "neue Bibliothek"-Initialisierung des
 * Hooks (setzt activeLibraryId auf "") erst beim Öffnen, nicht schon beim
 * Mounten des Aufrufers.
 */
function CreateLibraryWizardForm() {
  const { form, onSubmit, isLoading } = useLibraryForm(true)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} autoFocus placeholder="z. B. Mein Archiv" />
              </FormControl>
              <FormDescription>Geben Sie Ihrer Bibliothek einen treffenden Namen.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
                Mehr braucht es nicht — Quelle, Vorlage und Darstellung haben sinnvolle
                Standardwerte und lassen sich danach im Archiv anpassen.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Wird erstellt…" : "Bibliothek erstellen"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/**
 * Dialog-Hülle des Anlage-Wizards. Nach erfolgreicher Anlage navigiert der
 * Hook ins Archiv; der Dialog wird durch den Routenwechsel ohnehin verlassen.
 */
export function CreateLibraryWizard({ open, onOpenChange }: CreateLibraryWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Neue Bibliothek erstellen</DialogTitle>
          <DialogDescription>
            Name und Inhaltstyp genügen — danach richten Sie im Archiv die Quelle ein.
          </DialogDescription>
        </DialogHeader>
        {open && <CreateLibraryWizardForm />}
      </DialogContent>
    </Dialog>
  )
}
