import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { LibraryForm } from "@/components/settings/library-form"
import { SettingsClient } from "./settings-client"

export const metadata: Metadata = {
  title: "Bibliothek - Allgemeine Einstellungen",
  description: "Verwalten Sie die allgemeinen Einstellungen Ihrer Bibliothek.",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Allgemeine Einstellungen</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie die grundlegenden Einstellungen Ihrer Bibliothek.
        </p>
      </div>
      <Separator />
      <SettingsClient />
    </div>
  )
} 