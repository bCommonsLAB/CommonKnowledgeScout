import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { SettingsClient } from "./settings-client"

export const metadata: Metadata = {
  title: "Bibliothek verwalten - Übersicht",
  description: "Übersicht der drei Räume: meSpace, weSpace und usSpace.",
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
        <h3 className="text-lg font-medium">Übersicht</h3>
        <p className="text-sm text-muted-foreground">
          Wählen Sie einen Raum: meSpace (Bibliothek aufbauen), weSpace (mit
          vertrauten Personen teilen) oder usSpace (veröffentlichen).
        </p>
      </div>
      <Separator />
      <Suspense fallback={<SettingsFallback />}>
        <SettingsClient />
      </Suspense>
    </div>
  )
} 