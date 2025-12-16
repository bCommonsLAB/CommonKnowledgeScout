"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Step = "questions" | "metadata" | "preview"
type AssistantMode = "none" | "dictate"

const DEFAULT_QUESTIONS = [
  "Wie hast du den Event erlebt?",
  "Was war deine wichtigste Erkenntnis?",
  "Warum ist das wichtig?",
]

export default function CreateTestimonialPage({ params }: { params: { slug: string } }) {
  const [step, setStep] = useState<Step>("questions")
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("none")
  const [isDictating, setIsDictating] = useState(false)
  const [answers, setAnswers] = useState<string[]>(["", "", ""])
  const [metadata, setMetadata] = useState({
    name: "",
    role: "",
    nickname: "",
    showPublicly: true,
    image: "",
  })

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const handleStartDictation = () => {
    setIsDictating(true)
    setTimeout(() => {
      const mockAnswers = [
        "Der Event war sehr inspirierend und hat mir neue Perspektiven auf Open Source Software eröffnet...",
        "Die wichtigste Erkenntnis war, dass Community Building genauso wichtig ist wie technische Exzellenz...",
        "Das ist wichtig, weil nachhaltige Software-Entwicklung nur mit einer starken Community funktioniert...",
      ]
      setAnswers(mockAnswers)
      setIsDictating(false)
      setAssistantMode("none")
    }, 3000)
  }

  const handleMetadataChange = (field: string, value: string | boolean) => {
    setMetadata((prev) => ({ ...prev, [field]: value }))
  }

  const handlePreview = () => {
    setStep("preview")
  }

  const handleSave = () => {
    console.log("[v0] Saving testimonial:", { answers, metadata })
    alert("Testimonial wurde erfolgreich gespeichert!")
    window.location.href = `/library/${params.slug}`
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <a href={`/library/${params.slug}/create`} className="text-sm text-muted-foreground hover:text-foreground">
              ← Zurück
            </a>
          </div>
          <h1 className="text-3xl font-bold mb-2">Testimonial erfassen</h1>
          <p className="text-muted-foreground">
            Beantworte die Fragen schriftlich oder nutze das Diktieren, um Zeit zu sparen
          </p>
        </div>

        {/* Questions Form */}
        {step === "questions" && (
          <div className="space-y-6">
            <div className="flex gap-3 p-4 bg-muted/50 rounded-lg border">
              <Button
                variant={assistantMode === "dictate" ? "default" : "outline"}
                onClick={() => setAssistantMode(assistantMode === "dictate" ? "none" : "dictate")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                Antworten diktieren
              </Button>
            </div>

            {assistantMode === "dictate" && (
              <div className="p-6 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Antworten diktieren</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sprich frei über deine Erfahrungen. Du kannst die drei Fragen erwähnen: "Wie ich den Event erlebt
                      habe..., meine wichtigste Erkenntnis..., warum das wichtig ist..." Die Antworten werden
                      automatisch zugeordnet.
                    </p>
                    <Button onClick={handleStartDictation} disabled={isDictating}>
                      {isDictating ? (
                        <>
                          <span className="animate-pulse">● Aufnahme läuft...</span>
                        </>
                      ) : (
                        "Aufnahme starten"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6 border rounded-lg p-6">
              {DEFAULT_QUESTIONS.map((question, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`question-${index}`}>
                    {index + 1}. {question}
                  </Label>
                  <Textarea
                    id={`question-${index}`}
                    value={answers[index]}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    rows={4}
                    placeholder="Deine Antwort..."
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => (window.location.href = `/library/${params.slug}/create`)}>
                Abbrechen
              </Button>
              <Button onClick={() => setStep("metadata")} disabled={answers.some((a) => !a.trim())} className="flex-1">
                Weiter zu persönlichen Angaben
              </Button>
            </div>
          </div>
        )}

        {/* Metadata Form */}
        {step === "metadata" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Persönliche Angaben</h2>
              <p className="text-muted-foreground">
                Diese Angaben sind optional, aber helfen anderen, deine Perspektive einzuordnen
              </p>
            </div>

            <div className="space-y-6 border rounded-lg p-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={metadata.name}
                  onChange={(e) => handleMetadataChange("name", e.target.value)}
                  placeholder="Dein vollständiger Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rolle / Organisation (optional)</Label>
                <Input
                  id="role"
                  value={metadata.role}
                  onChange={(e) => handleMetadataChange("role", e.target.value)}
                  placeholder="z.B. Software Developer bei Firma XY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname (für halb-anonyme Veröffentlichung)</Label>
                <Input
                  id="nickname"
                  value={metadata.nickname}
                  onChange={(e) => handleMetadataChange("nickname", e.target.value)}
                  placeholder="z.B. TechEnthusiast42"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showPublicly"
                  checked={metadata.showPublicly}
                  onChange={(e) => handleMetadataChange("showPublicly", e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="showPublicly" className="font-normal cursor-pointer">
                  Ich möchte namentlich auftreten
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Bild oder Selfie (optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Button variant="outline">Bild hochladen</Button>
                  <p className="text-sm text-muted-foreground mt-2">oder Datei hierher ziehen</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("questions")}>
                Zurück
              </Button>
              <Button onClick={handlePreview} className="flex-1">
                Vorschau anzeigen
              </Button>
            </div>
          </div>
        )}

        {/* Preview */}
        {step === "preview" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Vorschau</h2>
              <p className="text-muted-foreground">So wird dein Testimonial dargestellt</p>
            </div>

            <div className="border rounded-lg p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center text-white font-bold text-xl">
                  {metadata.name
                    ? metadata.name.charAt(0).toUpperCase()
                    : metadata.nickname
                      ? metadata.nickname.charAt(0).toUpperCase()
                      : "?"}
                </div>
                <div>
                  <p className="font-semibold">
                    {metadata.showPublicly && metadata.name ? metadata.name : metadata.nickname || "Anonym"}
                  </p>
                  {metadata.role && <p className="text-sm text-muted-foreground">{metadata.role}</p>}
                </div>
              </div>

              <div className="space-y-6">
                {DEFAULT_QUESTIONS.map((question, index) => (
                  <div key={index} className="space-y-2">
                    <p className="font-medium text-sm text-muted-foreground">{question}</p>
                    <p className="text-base leading-relaxed">{answers[index]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("metadata")}>
                Bearbeiten
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Testimonial speichern
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
