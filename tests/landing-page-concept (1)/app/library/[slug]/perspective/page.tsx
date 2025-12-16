"use client"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Sparkles, Globe, Target, Users } from 'lucide-react'
import Link from "next/link"

export default function PerspectivePage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const [language, setLanguage] = useState("de")
  const [interests, setInterests] = useState<string[]>([])
  const [context, setContext] = useState("")

  const interestOptions = [
    { value: "tech", label: "Technologie" },
    { value: "culture", label: "Kultur & Gesellschaft" },
    { value: "ecology", label: "Ökologie" },
    { value: "economy", label: "Wirtschaft" },
    { value: "education", label: "Bildung" },
    { value: "policy", label: "Politikverständnis" },
    { value: "everyday", label: "Alltagsrelevanz" },
  ]

  const contextOptions = [
    { value: "student", label: "Student:in" },
    { value: "researcher", label: "Forscher:in" },
    { value: "practitioner", label: "Praktiker:in" },
    { value: "citizen", label: "Bürger:in" },
    { value: "ngo", label: "NGO" },
    { value: "administration", label: "Verwaltung" },
    { value: "business", label: "Unternehmen" },
    { value: "journalist", label: "Journalist:in" },
    { value: "none", label: "Ohne speziellen Kontext" },
  ]

  const toggleInterest = (value: string) => {
    if (interests.includes(value)) {
      setInterests(interests.filter((i) => i !== value))
    } else if (interests.length < 3) {
      setInterests([...interests, value])
    }
  }

  const handleStart = () => {
    // Store perspective in localStorage or pass as query params
    localStorage.setItem(
      "knowledgeScoutPerspective",
      JSON.stringify({
        language,
        interests,
        context,
      }),
    )
    router.push(`/library/${params.slug}?tab=story`)
  }

  const canProceed = language && interests.length > 0 && context

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <Link
            href={`/library/${params.slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Optional Info Banner */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">Warum diese Seite?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Jede Person bringt einen anderen Zugang mit. Deine Auswahl sorgt dafür, dass Antworten zu deinem
                    Hintergrund und deinen Interessen passen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hero Section */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">Wähle deine Perspektive</h1>
            <p className="text-lg text-muted-foreground">
              Damit Antworten zu deinem Zugang, deinen Interessen und deinem Umfeld passen.
            </p>
            <p className="text-sm text-muted-foreground">
              Wähle einfach aus, was zu dir passt – du kannst es jederzeit ändern.
            </p>
          </div>

          {/* Perspective Selection */}
          <div className="space-y-8">
            {/* 1. Language */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">Sprache</h2>
                      <p className="text-sm text-muted-foreground">In welcher Sprache möchtest du die Antworten lesen?</p>
                    </div>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">Englisch</SelectItem>
                        <SelectItem value="it">Italienisch</SelectItem>
                        <SelectItem value="fr">Französisch</SelectItem>
                        <SelectItem value="es">Spanisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Interests */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">Interessenprofil</h2>
                      <p className="text-sm text-muted-foreground">
                        Welche Aspekte sind dir besonders wichtig? (Wähle 1–3)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((option) => {
                        const isSelected = interests.includes(option.value)
                        const isDisabled = !isSelected && interests.length >= 3
                        return (
                          <Badge
                            key={option.value}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                              isSelected ? "bg-primary text-primary-foreground" : ""
                            } ${
                              isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/10"
                            }`}
                            onClick={() => !isDisabled && toggleInterest(option.value)}
                          >
                            {option.label}
                          </Badge>
                        )
                      })}
                    </div>
                    {interests.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {interests.length} von 3 ausgewählt
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Context */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold">Kontext</h2>
                      <p className="text-sm text-muted-foreground">
                        Aus welchem Umfeld oder aus welcher Rolle schaust du aufs Thema?
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {contextOptions.map((option) => {
                        const isSelected = context === option.value
                        return (
                          <Badge
                            key={option.value}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                              isSelected ? "bg-primary text-primary-foreground" : "hover:bg-primary/10"
                            }`}
                            onClick={() => setContext(option.value)}
                          >
                            {option.label}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-4">
            <Button
              size="lg"
              className="w-full gap-2 text-base"
              onClick={handleStart}
              disabled={!canProceed}
            >
              Mit dieser Perspektive starten
              <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Du kannst deine Perspektive später jederzeit ändern.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
