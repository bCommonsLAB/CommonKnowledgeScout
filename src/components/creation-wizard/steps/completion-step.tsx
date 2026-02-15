"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"

/**
 * Abschluss-Step nach erfolgreichem Speichern.
 * Zeigt eine kompakte Erfolgsmeldung; der "Weiter zur Library"-Button
 * wird von der Wizard-Navigation bereitgestellt.
 */
export function CompletionStep() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" />
          Erfolgreich gespeichert. Klicke auf „Weiter zur Library“, um zum Explorer zu wechseln.
        </div>
      </CardContent>
    </Card>
  )
}
