"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Step = "form" | "preview"
type AssistantMode = "none" | "dictate" | "scrape"

export default function CreateEventPage({ params }: { params: { slug: string } }) {
  const [step, setStep] = useState<Step>("form")
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("none")
  const [isDictating, setIsDictating] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState("")
  const [eventData, setEventData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    organizer: "",
    description: "",
    purpose: "",
    agenda: "",
    background: "",
    participants: "",
    resources: "",
  })

  const handleFieldChange = (field: string, value: string) => {
    setEventData((prev) => ({ ...prev, [field]: value }))
  }

  const handleStartDictation = () => {
    setIsDictating(true)
    // Simulate dictation for 3 seconds
    setTimeout(() => {
      // Simulate AI understanding which fields were mentioned
      const mockData = {
        title: "SFSCon 2024 - South Tyrol Free Software Conference",
        date: "2024-11-08",
        time: "09:00 - 18:00",
        location: "NOI Techpark, Bozen",
        organizer: "Free Software Foundation Europe",
        description: "Die jährliche Konferenz für Open Source Software in Südtirol",
        purpose: "Förderung von Open Source Software und Community Building",
      }
      setEventData((prev) => ({ ...prev, ...mockData }))
      setIsDictating(false)
      setAssistantMode("none")
    }, 3000)
  }

  const handleScrapeWebsite = () => {
    if (!scrapeUrl) return
    setIsScraping(true)
    setTimeout(() => {
      const mockData = {
        title: "SFSCon 2024 - South Tyrol Free Software Conference",
        date: "2024-11-08",
        time: "09:00 - 18:00",
        location: "NOI Techpark, Bozen",
        organizer: "Free Software Foundation Europe",
        description: "Die jährliche Konferenz für Open Source Software in Südtirol",
        purpose: "Förderung von Open Source Software und Community Building",
      }
      setEventData((prev) => ({ ...prev, ...mockData }))
      setIsScraping(false)
      setAssistantMode("none")
      setScrapeUrl("")
    }, 2000)
  }

  const handlePreview = () => {
    setStep("preview")
  }

  const handleSave = () => {
    console.log("[v0] Saving event:", eventData)
    alert("Event wurde erfolgreich gespeichert!")
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
          <h1 className="text-3xl font-bold mb-2">Event erfassen</h1>
          <p className="text-muted-foreground">Fülle die Felder aus oder nutze die Assistenten, um Zeit zu sparen</p>
        </div>

        {/* Form */}
        {step === "form" && (
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
                Eingaben diktieren
              </Button>
              <Button
                variant={assistantMode === "scrape" ? "default" : "outline"}
                onClick={() => setAssistantMode(assistantMode === "scrape" ? "none" : "scrape")}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                Von Webseite übernehmen
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
                    <h3 className="font-semibold mb-2">Eingaben diktieren</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Sprich einfach frei und erwähne die Felder: "Der Titel ist..., die Beschreibung ist..., der Ort
                      ist..." Die Felder werden automatisch befüllt.
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

            {assistantMode === "scrape" && (
              <div className="p-6 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">Von Webseite übernehmen</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Gib die URL einer Event-Seite ein. Die Informationen werden automatisch extrahiert und in die
                      Felder eingetragen.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://example.com/event"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleScrapeWebsite()
                        }}
                      />
                      <Button onClick={handleScrapeWebsite} disabled={!scrapeUrl || isScraping}>
                        {isScraping ? "Lädt..." : "Übernehmen"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6 border rounded-lg p-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={eventData.title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  placeholder="Name des Events"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organizer">Organisator</Label>
                  <Input
                    id="organizer"
                    value={eventData.organizer}
                    onChange={(e) => handleFieldChange("organizer", e.target.value)}
                    placeholder="Wer organisiert den Event?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Ort</Label>
                  <Input
                    id="location"
                    value={eventData.location}
                    onChange={(e) => handleFieldChange("location", e.target.value)}
                    placeholder="Veranstaltungsort"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Datum</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventData.date}
                    onChange={(e) => handleFieldChange("date", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Uhrzeit</Label>
                  <Input
                    id="time"
                    value={eventData.time}
                    onChange={(e) => handleFieldChange("time", e.target.value)}
                    placeholder="z.B. 09:00 - 18:00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Kurzbeschreibung</Label>
                <Textarea
                  id="description"
                  value={eventData.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  rows={3}
                  placeholder="Worum geht es bei diesem Event?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Ziel / Zweck</Label>
                <Textarea
                  id="purpose"
                  value={eventData.purpose}
                  onChange={(e) => handleFieldChange("purpose", e.target.value)}
                  rows={2}
                  placeholder="Welches Ziel verfolgt der Event?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agenda">Ablauf / Agenda</Label>
                <Textarea
                  id="agenda"
                  value={eventData.agenda}
                  onChange={(e) => handleFieldChange("agenda", e.target.value)}
                  rows={3}
                  placeholder="Wie ist der Event strukturiert?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="background">Hintergrundinformationen</Label>
                <Textarea
                  id="background"
                  value={eventData.background}
                  onChange={(e) => handleFieldChange("background", e.target.value)}
                  rows={2}
                  placeholder="Kontext und Geschichte des Events"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="participants">Beteiligte Personen</Label>
                <Input
                  id="participants"
                  value={eventData.participants}
                  onChange={(e) => handleFieldChange("participants", e.target.value)}
                  placeholder="Speaker, Organisatoren, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resources">Ressourcen (Links, PDFs)</Label>
                <Textarea
                  id="resources"
                  placeholder="URLs oder Dateinamen, eine pro Zeile"
                  value={eventData.resources}
                  onChange={(e) => handleFieldChange("resources", e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => (window.location.href = `/library/${params.slug}/create`)}>
                Abbrechen
              </Button>
              <Button onClick={handlePreview} disabled={!eventData.title} className="flex-1">
                Vorschau anzeigen
              </Button>
            </div>
          </div>
        )}

        {/* Assistant Modal */}
        {/* Dictation Modal */}
        {/* Scraping Modal */}

        {/* Preview */}
        {step === "preview" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Vorschau</h2>
              <p className="text-muted-foreground">So wird der Event in der Library dargestellt</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-8">
                <div className="space-y-2">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Event</div>
                  <h1 className="text-3xl font-bold">{eventData.title}</h1>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {eventData.date && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(eventData.date).toLocaleDateString("de-DE")}
                      </div>
                    )}
                    {eventData.time && <div>{eventData.time}</div>}
                    {eventData.location && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {eventData.location}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {eventData.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Beschreibung</h3>
                    <p className="text-muted-foreground">{eventData.description}</p>
                  </div>
                )}

                {eventData.purpose && (
                  <div>
                    <h3 className="font-semibold mb-2">Ziel</h3>
                    <p className="text-muted-foreground">{eventData.purpose}</p>
                  </div>
                )}

                {eventData.agenda && (
                  <div>
                    <h3 className="font-semibold mb-2">Agenda</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{eventData.agenda}</p>
                  </div>
                )}

                {eventData.organizer && (
                  <div>
                    <h3 className="font-semibold mb-2">Organisator</h3>
                    <p className="text-muted-foreground">{eventData.organizer}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("form")}>
                Bearbeiten
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Event speichern
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
