import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { SettingsClient } from "./settings-client"

export const metadata: Metadata = {
  title: "Bibliothek - Allgemeine Einstellungen",
  description: "Verwalten Sie die allgemeinen Einstellungen Ihrer Bibliothek.",
}

// Fallback-Komponente für die Suspense-Boundary
function SettingsFallback() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
      <Separator />
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
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
      <Suspense fallback={<SettingsFallback />}>
        <SettingsClient />
      </Suspense>
    </div>
  )
} 