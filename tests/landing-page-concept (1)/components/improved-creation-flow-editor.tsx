"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import {
  Plus,
  Trash2,
  GripVertical,
  Mic,
  Link,
  FileText,
  Upload,
  ChevronRight,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react"

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

interface CreationFlowEditorProps {
  supportedSources: InputSource[]
  flowSteps: FlowStep[]
  onSourcesChange: (sources: InputSource[]) => void
  onStepsChange: (steps: FlowStep[]) => void
}

const SOURCE_TYPE_ICONS = {
  spoken: Mic,
  url: Link,
  text: FileText,
  file: Upload,
}

const SOURCE_TYPE_COLORS = {
  spoken: "text-blue-600 bg-blue-50",
  url: "text-green-600 bg-green-50",
  text: "text-purple-600 bg-purple-50",
  file: "text-orange-600 bg-orange-50",
}

export function ImprovedCreationFlowEditor({
  supportedSources,
  flowSteps,
  onSourcesChange,
  onStepsChange,
}: CreationFlowEditorProps) {
  const sources = supportedSources || []
  const steps = flowSteps || []

  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [showSourceDetails, setShowSourceDetails] = useState(true)
  const [showStepDetails, setShowStepDetails] = useState(true)

  const selectedSourceData = sources.find((s) => s.id === selectedSource)
  const selectedStepData = steps.find((s) => s.id === selectedStep)

  return (
    <div className="space-y-8">
      {/* Input-Quellen Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Input-Quellen</h3>
            <p className="text-sm text-muted-foreground">Wie können Nutzer Daten eingeben?</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSourceDetails(!showSourceDetails)}>
              {showSourceDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newSource: InputSource = {
                  id: `source_${Date.now()}`,
                  type: "text",
                  label: "Neue Quelle",
                  helpText: "Beschreibung...",
                }
                onSourcesChange([...sources, newSource])
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Quelle hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: showSourceDetails ? "1fr 400px" : "1fr" }}>
          {/* Kompakte Liste */}
          <div className="space-y-2">
            {sources.map((source, index) => {
              const Icon = SOURCE_TYPE_ICONS[source.type]
              const colorClass = SOURCE_TYPE_COLORS[source.type]
              const isSelected = selectedSource === source.id

              return (
                <div
                  key={source.id}
                  onClick={() => setSelectedSource(source.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <div className={`p-2 rounded ${colorClass} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{source.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{source.helpText}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">{source.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSourcesChange(sources.filter((s) => s.id !== source.id))
                        if (selectedSource === source.id) setSelectedSource(null)
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}

            {sources.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Noch keine Input-Quellen definiert</p>
              </div>
            )}
          </div>

          {/* Detail-Panel */}
          {showSourceDetails && selectedSourceData && (
            <Card className="p-4 space-y-4 sticky top-4 h-fit">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Details bearbeiten</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSource(null)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ID (technisch)</label>
                  <Input
                    value={selectedSourceData.id}
                    onChange={(e) => {
                      const updated = sources.map((s) => (s.id === selectedSource ? { ...s, id: e.target.value } : s))
                      onSourcesChange(updated)
                      setSelectedSource(e.target.value)
                    }}
                    className="text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Typ</label>
                  <select
                    value={selectedSourceData.type}
                    onChange={(e) => {
                      const updated = sources.map((s) =>
                        s.id === selectedSource ? { ...s, type: e.target.value as InputSource["type"] } : s,
                      )
                      onSourcesChange(updated)
                    }}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  >
                    <option value="spoken">Gesprochen</option>
                    <option value="url">URL</option>
                    <option value="text">Text</option>
                    <option value="file">Datei</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Label (Nutzer sieht dies)
                  </label>
                  <Input
                    value={selectedSourceData.label}
                    onChange={(e) => {
                      const updated = sources.map((s) =>
                        s.id === selectedSource ? { ...s, label: e.target.value } : s,
                      )
                      onSourcesChange(updated)
                    }}
                    placeholder="z.B. Ich erzähle kurz..."
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hilfetext</label>
                  <Textarea
                    value={selectedSourceData.helpText}
                    onChange={(e) => {
                      const updated = sources.map((s) =>
                        s.id === selectedSource ? { ...s, helpText: e.target.value } : s,
                      )
                      onSourcesChange(updated)
                    }}
                    placeholder="Erkläre, wie diese Quelle funktioniert..."
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Flow Steps Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Flow Steps</h3>
            <p className="text-sm text-muted-foreground">Schritte im Creation-Wizard</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowStepDetails(!showStepDetails)}>
              {showStepDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newStep: FlowStep = {
                  id: `step_${Date.now()}`,
                  preset: "chooseSource",
                }
                onStepsChange([...steps, newStep])
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Step hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: showStepDetails ? "1fr 400px" : "1fr" }}>
          {/* Kompakte Liste */}
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isSelected = selectedStep === step.id

              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStep(step.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex-shrink-0">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{step.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Preset: <span className="font-mono">{step.preset}</span>
                      {step.fields && ` • ${step.fields.length} Felder`}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onStepsChange(steps.filter((s) => s.id !== step.id))
                      if (selectedStep === step.id) setSelectedStep(null)
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )
            })}

            {steps.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Noch keine Flow Steps definiert</p>
              </div>
            )}
          </div>

          {/* Detail-Panel */}
          {showStepDetails && selectedStepData && (
            <Card className="p-4 space-y-4 sticky top-4 h-fit">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Step Details</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStep(null)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Step ID</label>
                  <Input
                    value={selectedStepData.id}
                    onChange={(e) => {
                      const updated = steps.map((s) => (s.id === selectedStep ? { ...s, id: e.target.value } : s))
                      onStepsChange(updated)
                      setSelectedStep(e.target.value)
                    }}
                    className="text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preset</label>
                  <select
                    value={selectedStepData.preset}
                    onChange={(e) => {
                      const updated = steps.map((s) => (s.id === selectedStep ? { ...s, preset: e.target.value } : s))
                      onStepsChange(updated)
                    }}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                  >
                    <option value="chooseSource">chooseSource</option>
                    <option value="collectSource">collectSource</option>
                    <option value="generateDraft">generateDraft</option>
                    <option value="reviewFields">reviewFields</option>
                    <option value="reviewEssential">reviewEssential</option>
                  </select>
                </div>

                {selectedStepData.preset === "reviewFields" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Felder (kommasepariert)
                    </label>
                    <Textarea
                      value={selectedStepData.fields?.join(", ") || ""}
                      onChange={(e) => {
                        const fields = e.target.value
                          .split(",")
                          .map((f) => f.trim())
                          .filter(Boolean)
                        const updated = steps.map((s) => (s.id === selectedStep ? { ...s, fields } : s))
                        onStepsChange(updated)
                      }}
                      placeholder="title, summary, date, ..."
                      rows={4}
                      className="text-sm font-mono"
                    />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
