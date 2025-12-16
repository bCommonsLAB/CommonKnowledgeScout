"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Filter, Calendar, MessageCircle, ArrowRight, ArrowLeft, Sparkles, Send, Settings2, X, User } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// Mock data for SFSCon talks
const talks = [
  {
    id: 1,
    title: "Spark more Adas in tech",
    description: "Let's spark more Adas in our tech world! workshop",
    speaker: "Ada Lovelace",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Community Building",
    event: "2024 - SFSCON",
  },
  {
    id: 2,
    title: "Voices of Free Software",
    description: "Voices of Free Software: connect, learn, inspire!",
    speaker: "Grace Hopper",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Community track",
    event: "2024 - SFSCON",
  },
  {
    id: 3,
    title: "Optimizing Cloud Compute Resources",
    description: "Optimizing Cloud Compute Resources with Spare Cores",
    speaker: "Alan Turing",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Artificial Intelligence track",
    event: "2024 - SFSCON",
  },
  {
    id: 4,
    title: "Setting up an OSPO",
    description: "How to set up an Open Source Program Office? Get insights and use cases from the OSPO Alliance",
    speaker: "Linus Torvalds",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Community Building",
    event: "2024 - SFSCON",
  },
  {
    id: 5,
    title: "Decentralized Search & Storage",
    description:
      "Decentralized Search Over Decentralized Storage - Coupling an AI-powered search engine with a self-hosted storage",
    speaker: "Tim Berners-Lee",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Cybersecurity",
    event: "2024 - SFSCON",
  },
  {
    id: 6,
    title: "SMART Box of AURA",
    description: "The SMART Box of AURA Project",
    speaker: "Margaret Hamilton",
    speakerImage: "/placeholder.svg?height=80&width=80",
    year: 2024,
    date: "2.11.2025",
    track: "Artificial Intelligence track",
    event: "2024 - SFSCON",
  },
]

const filterCategories = {
  event: [
    { label: "2023 - SFSCON", count: 58 },
    { label: "2024 - SFSCON", count: 81 },
    { label: "Programme 2022", count: 56 },
  ],
  year: [
    { label: "2022", count: 56 },
    { label: "2023", count: 58 },
    { label: "2024", count: 81 },
  ],
  track: [
    { label: "Artificial Intelligence track", count: 4 },
    { label: "Community Building", count: 9 },
    { label: "Community track", count: 21 },
    { label: "Cultural Change & Education", count: 7 },
    { label: "Cybersecurity", count: 3 },
  ],
}

const storyTopics = [
  {
    id: 1,
    title: "Open Source & Gesellschaft",
    questions: [
      "Warum Open Source mehr ist als Technologie",
      "Wie Gemeinschaften Innovation tragen",
      "Bildung als Basis für Teilhabe",
      "Verantwortung und Transparenz in Open Source",
      "Nachhaltige Modelle des Teilens",
      "Der Einfluss auf Wirtschaftssysteme",
      "Was kann ich als Einzelner dazu beitragen?",
    ],
  },
  {
    id: 2,
    title: "Künstliche Intelligenz & Ethik",
    questions: [
      "Wie KI unsere Entscheidungen prägt",
      "Vertrauen in automatisierte Systeme",
      "KI als Werkzeug oder Akteur?",
      "Datenethik und Open Data",
      "Wie kann KI Gemeinwohl fördern?",
      "Transparenz in KI-Systemen",
      "Bildung für KI-Kompetenz",
    ],
  },
  {
    id: 3,
    title: "Energie & Nachhaltigkeit",
    questions: [
      "Open Source Energy Solutions",
      "Klimamodelle und Bürgerbeteiligung",
      "Welche Rolle spielt Software für das Klima?",
      "Nachhaltige Infrastruktur durch Open Source",
      "Energieeffizienz in der IT",
      "Circular Economy und Software",
      "Community-getriebene Klimaprojekte",
    ],
  },
  {
    id: 4,
    title: "Cybersecurity & Datenschutz",
    questions: [
      "Wie Open Source Sicherheit erhöht",
      "Transparenz vs. Sicherheit durch Verschleierung",
      "Community-basierte Sicherheitsaudits",
      "Datenschutz als Grundrecht",
      "Verschlüsselung für alle",
      "Sichere Infrastruktur durch Open Source",
      "Verantwortung bei Sicherheitslücken",
    ],
  },
  {
    id: 5,
    title: "Bildung & Wissenstransfer",
    questions: [
      "Open Educational Resources",
      "Wie lernen wir in der digitalen Welt?",
      "Zugang zu Wissen für alle",
      "Peer-to-Peer Learning",
      "Open Source in Schulen und Universitäten",
      "Lebenslanges Lernen durch offene Plattformen",
      "Digitale Kompetenzen vermitteln",
    ],
  },
  {
    id: 6,
    title: "Community Building & Zusammenarbeit",
    questions: [
      "Wie entstehen erfolgreiche Communities?",
      "Governance in Open Source Projekten",
      "Diversität und Inklusion",
      "Motivation und Nachhaltigkeit",
      "Konfliktlösung in verteilten Teams",
      "Von der Idee zum Projekt",
      "Wie kann ich mich einbringen?",
    ],
  },
  {
    id: 7,
    title: "Wirtschaft & Geschäftsmodelle",
    questions: [
      "Wie verdient man mit Open Source Geld?",
      "Dual Licensing und andere Modelle",
      "Open Source in Unternehmen",
      "Der Wert von Gemeinschaftsgütern",
      "Sponsoring und Förderung",
      "Open Source als Wettbewerbsvorteil",
      "Nachhaltige Finanzierung von Projekten",
    ],
  },
]

export function KnowledgeGallery({ slug }: { slug: string }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    event: [],
    year: [],
    track: ["Community Building"], // Added default filter for demo
  })
  const [activeTab, setActiveTab] = useState("gallery")
  const [expandedTopics, setExpandedTopics] = useState<number[]>([])
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [customQuestion, setCustomQuestion] = useState("")
  const [language, setLanguage] = useState("de")
  const [character, setCharacter] = useState("business")
  const [socialContext, setSocialContext] = useState("general")
  const [storyAnswer, setStoryAnswer] = useState<{
    text: string
    sources: { id: number; title: string; speaker: string }[]
  } | null>(null)
  const [legendView, setLegendView] = useState<"legend" | "documents">("legend") // Added state for legend/documents toggle
  const storyQuestion = ""
  const [perspectiveOpen, setPerspectiveOpen] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<"searching" | "analyzing" | "generating" | "complete">(
    "searching",
  )
  const [streamingText, setStreamingText] = useState("")
  const [liveSources, setLiveSources] = useState<{ id: number; title: string; speaker: string }[]>([])
  const [messages, setMessages] = useState<
    Array<{
      type: "question" | "answer"
      text: string
      sources?: { id: number; title: string; speaker: string }[]
    }>
  >([])

  const [selectedTalk, setSelectedTalk] = useState<typeof talks[0] | null>(null)
  const [detailLanguage, setDetailLanguage] = useState<"original" | "deutsch">("original")

  const removeFilter = (category: string, value: string) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [category]: prev[category].filter((v) => v !== value),
    }))
  }

  const resetAllFilters = () => {
    setSelectedFilters({
      event: [],
      year: [],
      track: [],
    })
  }

  const getFilteredCount = () => {
    const totalFilters = Object.values(selectedFilters).flat().length
    return totalFilters > 0 ? 9 : 197
  }

  const simulateAnswerGeneration = async (question: string) => {
    setIsGenerating(true)
    setGenerationPhase("searching")
    setStreamingText("")
    setLiveSources([])

    // Add question to messages
    setMessages((prev) => [...prev, { type: "question", text: question }])

    // Phase 1: Searching sources (1.5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Phase 2: Analyzing talks (2 seconds, show sources one by one)
    setGenerationPhase("analyzing")
    const sources = [
      { id: 2, title: "Voices of Free Software", speaker: "Grace Hopper" },
      { id: 4, title: "Setting up an OSPO", speaker: "Linus Torvalds" },
      { id: 1, title: "Spark more Adas in tech", speaker: "Ada Lovelace" },
    ]

    for (let i = 0; i < sources.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600))
      setLiveSources((prev) => [...prev, sources[i]])
    }

    await new Promise((resolve) => setTimeout(resolve, 400))

    // Phase 3: Generating answer with streaming effect (3 seconds)
    setGenerationPhase("generating")
    const fullAnswer =
      "In mehreren Talks der SFSCon wird Open Source als gesellschaftliche Bewegung beschrieben, die Transparenz und Teilhabe fördert. Besonders spannend: die Verbindung zu Bildung und Demokratie. Die Sprecher betonen, dass Open Source nicht nur eine technische Entscheidung ist, sondern eine philosophische Haltung, die Wissen für alle zugänglich macht."

    const words = fullAnswer.split(" ")
    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 80))
      setStreamingText((prev) => prev + (i === 0 ? "" : " ") + words[i])
    }

    // Phase 4: Complete
    setGenerationPhase("complete")
    setMessages((prev) => [
      ...prev,
      {
        type: "answer",
        text: fullAnswer,
        sources: sources,
      },
    ])
    setIsGenerating(false)
  }

  const handleQuestionClick = (question: string) => {
    setSelectedQuestion(question)
    simulateAnswerGeneration(question)
  }

  const handleAskCustomQuestion = () => {
    if (!customQuestion.trim()) return
    setSelectedQuestion(customQuestion)
    simulateAnswerGeneration(customQuestion)
    setCustomQuestion("")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-8 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="story">Story</TabsTrigger>
          </TabsList>
          {activeTab === "gallery" && (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                className="gap-2 bg-transparent hover:bg-primary/5 hover:shadow-md transition-all group"
                onClick={() => window.location.href = `/library/${slug}/perspective`}
              >
                <MessageCircle className="h-4 w-4" />
                In Story Mode wechseln
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <span className="text-xs text-muted-foreground">Starte einen Dialog mit den Talks</span>
            </div>
          )}
        </div>

        <TabsContent value="gallery" className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Entdecke, was Menschen auf der SFSCon gesagt haben</h2>
              <p className="text-sm text-muted-foreground font-medium">Befrage das kollektive Wissen</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
              Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die
              dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die
              Inhalte erzählen zu lassen.
            </p>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Durchsuchen nach Titel, Speaker, Topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Filter Sidebar */}
            <aside className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="h-4 w-4" />
                    Filter
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich
                    interessieren.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Event Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Event</h3>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                        Zurücksetzen
                      </Button>
                    </div>
                    <ScrollArea className="h-[120px]">
                      <div className="space-y-2">
                        {filterCategories.event.map((item) => (
                          <label key={item.label} className="flex items-center justify-between text-sm cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input type="checkbox" className="rounded" />
                              <span>{item.label}</span>
                            </span>
                            <span className="text-muted-foreground">{item.count}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <Separator />

                  {/* Year Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Year</h3>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                        Zurücksetzen
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {filterCategories.year.map((item) => (
                        <label key={item.label} className="flex items-center justify-between text-sm cursor-pointer">
                          <span className="flex items-center gap-2">
                            <input type="checkbox" className="rounded" />
                            <span>{item.label}</span>
                          </span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Track Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Track</h3>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                        Zurücksetzen
                      </Button>
                    </div>
                    <ScrollArea className="h-[160px]">
                      <div className="space-y-2">
                        {filterCategories.track.map((item) => (
                          <label key={item.label} className="flex items-center justify-between text-sm cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input type="checkbox" className="rounded" />
                              <span className="text-xs">{item.label}</span>
                            </span>
                            <span className="text-muted-foreground">{item.count}</span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </aside>

            {/* Gallery Content */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">197 Dokumente</span>
                </div>
              </div>

              {/* Year Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Jahrgang 2024</h3>

                {/* Talks Grid */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {talks.map((talk) => (
                    <Card
                      key={talk.id}
                      onClick={() => setSelectedTalk(talk)}
                      className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer"
                    >
                      <CardHeader className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={talk.speakerImage || "/placeholder.svg"}
                              alt={talk.speaker}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {talk.year}
                          </Badge>
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight mb-2">{talk.title}</CardTitle>
                          <CardDescription className="text-sm line-clamp-2">{talk.description}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{talk.date}</span>
                        </div>
                        <div className="text-xs text-muted-foreground italic">
                          Dieser Talk wurde von {talk.speaker} auf der SFSCon gehalten.
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="story" className="animate-in fade-in duration-500">
          <div className="space-y-6">
            {/* Story Mode Header with Perspective Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Story Mode – Wissen verstehen aus den Talks der SFSCon</h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  Diese Übersicht wurde aus allen ausgewählten Talks generiert. Sie zeigt die zentralen Themen und
                  öffnet den Dialog mit dem Wissen. Du kannst selbst eine Frage stellen oder dich entlang der Themen
                  führen lassen.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setActiveTab("gallery")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zurück zur Gallery
                </Button>

                <Popover open={perspectiveOpen} onOpenChange={setPerspectiveOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                      <Settings2 className="h-4 w-4" />
                      Eigene Perspektive anpassen
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Perspektive anpassen</h4>
                        <p className="text-xs text-muted-foreground">
                          Passe die Sprache, den Charakter und den sozialen Kontext der Antworten an.
                        </p>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Sprache</label>
                          <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="de">Deutsch</SelectItem>
                              <SelectItem value="en">Englisch</SelectItem>
                              <SelectItem value="it">Italienisch</SelectItem>
                              <SelectItem value="fr">Französisch</SelectItem>
                              <SelectItem value="es">Spanisch</SelectItem>
                              <SelectItem value="ar">Arabisch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Charakter</label>
                          <Select value={character} onValueChange={setCharacter}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="developer">Developer-orientiert</SelectItem>
                              <SelectItem value="technical">Technisch-orientiert</SelectItem>
                              <SelectItem value="open-source">Open-Source-spezifisch</SelectItem>
                              <SelectItem value="scientific">Naturwissenschaftlich-orientiert</SelectItem>
                              <SelectItem value="eco-social">Ökosozial-orientiert</SelectItem>
                              <SelectItem value="social">Sozial-orientiert</SelectItem>
                              <SelectItem value="civic">Bürgerschaftlich-orientiert</SelectItem>
                              <SelectItem value="policy">Politikwissenschaftlich-orientiert</SelectItem>
                              <SelectItem value="cultural">Kulturell-orientiert</SelectItem>
                              <SelectItem value="business">Business-orientiert</SelectItem>
                              <SelectItem value="entrepreneurial">Unternehmerisch-orientiert</SelectItem>
                              <SelectItem value="legal">Rechtskundespezifisch</SelectItem>
                              <SelectItem value="educational">Bildungswissenschaftlich-orientiert</SelectItem>
                              <SelectItem value="creative">Kreativ-orientiert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">Soziales Umfeld</label>
                          <Select value={socialContext} onValueChange={setSocialContext}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scientific">Wissenschaftlich</SelectItem>
                              <SelectItem value="general">Allgemeinverständlich</SelectItem>
                              <SelectItem value="youth">Jugendlich</SelectItem>
                              <SelectItem value="senior">Ältere Erwachsene</SelectItem>
                              <SelectItem value="professional">Professionell</SelectItem>
                              <SelectItem value="children">Kindgerecht</SelectItem>
                              <SelectItem value="easy_language">Einfache Sprache</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Main Layout: Story Content (left) + Gallery Legend (right) */}
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Left: Story Content */}
              <div className="space-y-6">
                <div className="prose prose-sm max-w-none space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h2 className="text-2xl font-bold m-0">Themenübersicht</h2>
                    </div>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      Aus den 197 Talks der SFSCon (2022–2024) haben sich sieben zentrale Themenfelder
                      herauskristallisiert. Jedes Thema öffnet einen Dialog mit dem kollektiven Wissen der Community.
                      Klicke auf ein Thema, um vorgeschlagene Fragen zu sehen, oder stelle unten deine eigene Frage.
                    </p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="w-full border rounded-lg">
                  {storyTopics.map((topic, index) => (
                    <AccordionItem
                      key={topic.id}
                      value={`topic-${topic.id}`}
                      className={index !== storyTopics.length - 1 ? "border-b" : ""}
                    >
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 text-base font-medium">
                        {topic.title}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <p className="text-xs text-muted-foreground">Erkunde diese Aspekte:</p>
                        <div className="space-y-1">
                          {topic.questions.map((question, idx) => (
                            <Button
                              key={idx}
                              variant="ghost"
                              className="w-full justify-start text-left h-auto py-2 px-3 hover:bg-primary/5 hover:text-primary transition-colors"
                              onClick={() => handleQuestionClick(question)}
                            >
                              <span className="text-sm">{question}</span>
                            </Button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {messages.length > 0 && (
                  <div className="space-y-6">
                    <Separator />
                    {messages.map((message, idx) => (
                      <div key={idx} className="space-y-4">
                        {message.type === "question" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MessageCircle className="h-4 w-4" />
                              <span>Deine Frage:</span>
                            </div>
                            <p className="text-lg font-medium">{message.text}</p>
                          </div>
                        )}

                        {message.type === "answer" && (
                          <Card className="bg-muted/30">
                            <CardContent className="p-6 space-y-4">
                              <div className="prose prose-sm max-w-none">
                                <p className="text-foreground leading-relaxed">{message.text}</p>
                              </div>

                              <div className="border-t border-muted-foreground/20 pt-3 space-y-2">
                                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                  <div className="space-y-1">
                                    <p className="font-medium">Antwort automatisch formuliert</p>
                                    <p>
                                      Diese Antwort wurde mithilfe von KI-Modellen generiert und basiert auf den
                                      folgenden Quellen. Die KI erfindet keine Inhalte, sondern formuliert Antworten aus
                                      vorhandenen Talks.
                                    </p>
                                  </div>
                                </div>

                                {message.sources && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Quellen:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {message.sources.map((source) => (
                                        <Badge
                                          key={source.id}
                                          variant="secondary"
                                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer text-xs"
                                        >
                                          {source.title} – {source.speaker}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isGenerating && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Separator />

                    {/* Question Display */}
                    {selectedQuestion && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MessageCircle className="h-4 w-4" />
                          <span>Deine Frage:</span>
                        </div>
                        <p className="text-lg font-medium">{selectedQuestion}</p>
                      </div>
                    )}

                    <Card className="bg-muted/30 border-primary/20">
                      <CardContent className="p-6 space-y-4">
                        {/* Phase 1: Searching */}
                        {generationPhase === "searching" && (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <p className="text-sm text-muted-foreground">Durchsuche Quellen...</p>
                          </div>
                        )}

                        {/* Phase 2: Analyzing */}
                        {generationPhase === "analyzing" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              <p className="text-sm text-muted-foreground">Analysiere relevante Talks...</p>
                            </div>
                            {liveSources.length > 0 && (
                              <div className="space-y-2 pl-5">
                                <p className="text-xs font-medium text-muted-foreground">Gefundene Quellen:</p>
                                <div className="flex flex-wrap gap-2">
                                  {liveSources.map((source) => (
                                    <Badge
                                      key={source.id}
                                      variant="secondary"
                                      className="bg-blue-50 text-blue-700 text-xs animate-in fade-in slide-in-from-left duration-300"
                                    >
                                      {source.title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Phase 3: Generating with streaming */}
                        {generationPhase === "generating" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              <p className="text-sm text-muted-foreground">Formuliere Antwort...</p>
                            </div>
                            <div className="prose prose-sm max-w-none pl-5">
                              <p className="text-foreground leading-relaxed">
                                {streamingText}
                                <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                              </p>
                            </div>
                            {liveSources.length > 0 && (
                              <div className="space-y-2 pl-5 pt-2 border-t border-muted-foreground/20">
                                <p className="text-xs font-medium text-muted-foreground">Verwendete Quellen:</p>
                                <div className="flex flex-wrap gap-2">
                                  {liveSources.map((source) => (
                                    <Badge
                                      key={source.id}
                                      variant="secondary"
                                      className="bg-blue-50 text-blue-700 text-xs"
                                    >
                                      {source.title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Custom Question Input */}
                <Card className="border-2">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Oder stelle deine eigene Frage:</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="z.B. Wie wurde Nachhaltigkeit diskutiert?"
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAskCustomQuestion()
                          }}
                          className="text-sm"
                          disabled={isGenerating}
                        />
                        <Button
                          onClick={handleAskCustomQuestion}
                          size="sm"
                          className="gap-2 shrink-0"
                          disabled={isGenerating}
                        >
                          <Send className="h-4 w-4" />
                          Fragen
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Gallery Legend / Sources with Active Filters */}
              <aside className="space-y-4">
                <div className="h-full min-h-[600px] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/10 flex items-center justify-center p-8">
                  <div className="text-center space-y-2">
                    <Filter className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">Filter & Legende</p>
                    <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                      Platzhalter für die bereits programmierte Filter- und Legendenkomponente
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedTalk} onOpenChange={(open) => !open && setSelectedTalk(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 overflow-hidden">
          {selectedTalk && (
            <div className="flex flex-col h-full">
              {/* Header with Close Button */}
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <SheetTitle className="text-base">Dettagli documento</SheetTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTalk(null)}
                    className="h-8 w-8 p-0 -mr-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </SheetHeader>

              {/* Story Mode Button - Prominent placement */}
              <div className="px-6 py-4 bg-primary/5 border-b">
                <Button
                  className="w-full gap-2 bg-black text-white hover:bg-black/90"
                  onClick={() => {
                    setSelectedTalk(null)
                    setActiveTab("story")
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  Fatti spiegare il contenuto dalla tua prospettiva
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Language Tabs */}
              <div className="px-6 py-3 border-b">
                <Tabs value={detailLanguage} onValueChange={(v) => setDetailLanguage(v as "original" | "deutsch")}>
                  <TabsList className="grid w-full max-w-[300px] grid-cols-2">
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="deutsch">Deutsch</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-6 space-y-6">
                  {/* Translation Notice */}
                  {detailLanguage === "deutsch" && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                      Dies ist eine reine Übersetzung. Inhalt und Perspektive bleiben unverändert.
                    </div>
                  )}

                  {/* Talk Badge */}
                  <Badge className="bg-blue-600 hover:bg-blue-700">TALK</Badge>

                  {/* Title */}
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold leading-tight">
                      {detailLanguage === "original"
                        ? selectedTalk.title
                        : "Lassen Sie uns mehr Adas in unserer Technologiewelt entfachen! Workshop"}
                    </h2>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {detailLanguage === "original"
                      ? "Join this workshop to explore how to encourage women* and girls to participate in technology and coding. Using a storybook about Ada, a girl who loves tech, the session discusses promoting diversity and inclusion in the Free Software community."
                      : "Nehmen Sie an diesem Workshop teil, um zu erkunden, wie wir Frauen* und Mädchen ermutigen können, sich mit Technologie und Programmierung zu beschäftigen. Anhand eines Storybooks über Ada, ein Mädchen, das Tech liebt, diskutiert die Session über die Förderung von Diversität und Inklusion in der Free-Software-Community."}
                  </p>

                  {/* Speakers */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      {detailLanguage === "original" ? "Speakers" : "Vortragende"}
                    </h3>
                    <div className="flex items-start gap-3">
                      <img
                        src={selectedTalk.speakerImage || "/placeholder.svg"}
                        alt="Lina Ceballos"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium">Lina Ceballos</p>
                        <p className="text-xs text-muted-foreground">Free Software Foundation Europe</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <img
                        src="/placeholder.svg?height=48&width=48"
                        alt="Ana Galan"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium">Ana Galan</p>
                        <p className="text-xs text-muted-foreground">SheTech</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Brief Summary */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="text-base font-semibold">
                        {detailLanguage === "original" ? "Brief Summary" : "Kurzzusammenfassung"}
                      </h3>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {detailLanguage === "original"
                        ? "This workshop aims to inspire and support women*, especially girls, to become more involved in technology and coding. It uses the FSFE's illustrated book about Ada, a girl who experiments with hardware and software, to spark interest and discussion about diversity and inclusion in tech communities."
                        : "Dieser Workshop zielt darauf ab, Frauen* und besonders Mädchen zu inspirieren und zu unterstützen, sich stärker mit Technologie und Programmierung zu beschäftigen. Er nutzt das illustrierte Buch der FSFE über Ada, ein Mädchen, das mit Hardware und Software experimentiert, um Interesse und Diskussion über Diversität und Inklusion in Tech-Communities zu wecken."}
                    </p>
                  </div>

                  <Separator />

                  {/* Workshop Focus and Story */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">
                      {detailLanguage === "original" ? "Workshop Focus and Story" : "Workshop-Fokus und Geschichte"}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {detailLanguage === "original"
                        ? 'The session centers around the Free Software Foundation Europe\'s illustrated book "Ada & Zangemann – A Tale of Software, Skateboards, and Raspberry Ice Cream." The story features Ada, a girl passionate about experimenting with technology, who understands the importance of controlling technology and challenges the powerful inventor Zangemann. This narrative serves as a tool to engage participants and encourage creative ways to increase the participation of women* and girls in technology.'
                        : 'Die Session dreht sich um das illustrierte Buch der Free Software Foundation Europe "Ada & Zangemann – Eine Geschichte über Software, Skateboards und Himbeereis." Die Geschichte zeigt Ada, ein Mädchen, das leidenschaftlich gerne mit Technologie experimentiert, die Bedeutung der Kontrolle über Technologie versteht und den mächtigen Erfinder Zangemann herausfordert. Diese Erzählung dient als Werkzeug, um Teilnehmende einzubinden und kreative Wege zu fördern, die Beteiligung von Frauen* und Mädchen in der Technologie zu erhöhen.'}
                    </p>
                  </div>

                  <Separator />

                  {/* Promoting Diversity and Inclusion */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">
                      {detailLanguage === "original"
                        ? "Promoting Diversity and Inclusion"
                        : "Förderung von Diversität und Inklusion"}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {detailLanguage === "original"
                        ? "The workshop also explores the challenges women*, including intersectional groups such as women* with migration backgrounds, face in the tech industry. Participants discuss barriers and strategies to create more inclusive tech communities, fostering environments where diverse voices are heard and valued."
                        : "Der Workshop erforscht auch die Herausforderungen, mit denen Frauen*, einschließlich intersektionaler Gruppen wie Frauen* mit Migrationshintergrund, in der Tech-Industrie konfrontiert sind. Teilnehmende diskutieren Barrieren und Strategien, um inklusivere Tech-Communities zu schaffen und Umgebungen zu fördern, in denen diverse Stimmen gehört und geschätzt werden."}
                    </p>
                  </div>

                  <Separator />

                  {/* Metadata */}
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>{selectedTalk.date}</span>
                      <span>•</span>
                      <span>{selectedTalk.event}</span>
                    </div>
                    <div>
                      <strong>{detailLanguage === "original" ? "Track:" : "Track:"}</strong> {selectedTalk.track}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
