"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CreateJobPage({ params }: { params: { slug: string } }) {
  const [isDictating, setIsDictating] = useState(false)
  const [isScrapingUrl, setIsScrapingUrl] = useState(false)
  const [scrapingUrl, setScrapingUrl] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    organization: "",
    location: "",
    description: "",
    requirements: "",
    contact: "",
    deadline: "",
    type: "vollzeit",
    applicationUrl: "",
  })

  const handleDictation = () => {
    setIsDictating(true)
    // Simulate dictation processing
    setTimeout(() => {
      setFormData({
        title: "Software Engineer",
        organization: "Tech Innovations GmbH",
        location: "Bozen, Italien",
        description: "Wir suchen einen erfahrenen Software Engineer für unser dynamisches Team...",
        requirements: "- 3+ Jahre Erfahrung mit React und TypeScript\n- Gute Kenntnisse in Node.js\n- Teamfähigkeit",
        contact: "jobs@techinnovations.com",
        deadline: "2025-02-28",
        type: "vollzeit",
        applicationUrl: "https://techinnovations.com/karriere/apply",
      })
      setIsDictating(false)
    }, 2000)
  }

  const handleScrapeUrl = () => {
    if (!scrapingUrl) return
    setIsScrapingUrl(true)
    // Simulate URL scraping
    setTimeout(() => {
      setFormData({
        title: "Frontend Developer",
        organization: "Digital Solutions SA",
        location: "Remote",
        description: "Join our team as a Frontend Developer and help build amazing web applications...",
        requirements: "- Erfahrung mit modernen Frontend-Frameworks\n- CSS und responsive Design\n- Agile Methoden",
        contact: "hr@digitalsolutions.com",
        deadline: "2025-03-15",
        type: "remote",
        applicationUrl: scrapingUrl,
      })
      setIsScrapingUrl(false)
    }, 2000)
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={() => window.history.back()}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zurück
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-2">Job-Angebot erfassen</h1>
          <p className="text-muted-foreground">
            Erfasse Job-Angebote für die Community - durch Sprechen, Text oder von einer Webseite
          </p>
        </div>

        {/* Input Method Buttons */}
        <div className="flex gap-3 mb-8">
          <Button
            variant={isDictating ? "default" : "outline"}
            onClick={handleDictation}
            disabled={isDictating || isScrapingUrl}
            className="gap-2"
          >
            {isDictating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Diktiere...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                Eingaben diktieren
              </>
            )}
          </Button>

          <div className="flex gap-2 flex-1">
            <Input
              placeholder="URL zum Job-Angebot"
              value={scrapingUrl}
              onChange={(e) => setScrapingUrl(e.target.value)}
              disabled={isScrapingUrl || isDictating}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleScrapeUrl} disabled={!scrapingUrl || isScrapingUrl || isDictating}>
              {isScrapingUrl ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Scrape...
                </>
              ) : (
                "Von Webseite übernehmen"
              )}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6 border rounded-lg p-6">
          <div className="space-y-2">
            <Label htmlFor="title">Jobtitel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="z.B. Software Engineer, Marketing Manager"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organization">Organisation/Firma *</Label>
              <Input
                id="organization"
                value={formData.organization}
                onChange={(e) => updateField("organization", e.target.value)}
                placeholder="Firmenname"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Standort *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Stadt, Land oder Remote"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Art der Stelle *</Label>
            <Select value={formData.type} onValueChange={(value) => updateField("type", value)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vollzeit">Vollzeit</SelectItem>
                <SelectItem value="teilzeit">Teilzeit</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Beschreibe die Position, Aufgaben und was das Team besonders macht..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Anforderungen & Qualifikationen</Label>
            <Textarea
              id="requirements"
              value={formData.requirements}
              onChange={(e) => updateField("requirements", e.target.value)}
              placeholder="Erforderliche Skills, Erfahrung, Ausbildung..."
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact">Kontakt/Ansprechperson</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                placeholder="E-Mail oder Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Bewerbungsfrist</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => updateField("deadline", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="applicationUrl">Link zur Bewerbung</Label>
            <Input
              id="applicationUrl"
              type="url"
              value={formData.applicationUrl}
              onChange={(e) => updateField("applicationUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <Button size="lg" className="flex-1">
            Job-Angebot speichern
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.history.back()}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  )
}
