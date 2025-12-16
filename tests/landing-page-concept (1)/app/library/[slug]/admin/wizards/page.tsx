"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ImprovedCreationFlowEditor } from "@/components/improved-creation-flow-editor"

interface InputSource {
  id: string
  type: "spoken" | "url" | "text" | "file"
  label: string
  helpText: string
}

interface FlowStep {
  id: string
  preset: string
  fields?: string[]
}

export default function WizardAdminPage({ params }: { params: { slug: string } }) {
  const [supportedSources, setSupportedSources] = useState<InputSource[]>([
    {
      id: "spoken",
      type: "spoken",
      label: "Eingaben diktieren",
      helpText: "Beschreibe frei, worum es in der Session geht",
    },
    {
      id: "url",
      type: "url",
      label: "Von Webseite übernehmen",
      helpText: "Füge einen Link zur Event-Seite oder Session-Seite ein",
    },
  ])

  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([
    {
      id: "chooseSource",
      preset: "chooseSource",
    },
    {
      id: "collectSource",
      preset: "collectSource",
    },
    {
      id: "generateDraft",
      preset: "generateDraft",
    },
    {
      id: "reviewFields",
      preset: "reviewFields",
      fields: ["title", "summary", "date", "starttime", "endtime", "location", "track"],
    },
  ])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/library/${params.slug}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück zur Library
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Wizard-Konfiguration</h1>
                <p className="text-sm text-muted-foreground">Erstelle und bearbeite Creation Flow Wizards</p>
              </div>
            </div>
            <Button
              onClick={() => {
                console.log("[v0] Saving wizard config:", { supportedSources, flowSteps })
                // TODO: Save to backend/localStorage
                alert("Wizard-Konfiguration gespeichert!")
              }}
            >
              Speichern
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <ImprovedCreationFlowEditor
          supportedSources={supportedSources}
          flowSteps={flowSteps}
          onSourcesChange={setSupportedSources}
          onStepsChange={setFlowSteps}
        />
      </div>
    </div>
  )
}
