"use client"

/**
 * SpaceOverview — die drei Räume (meSpace / weSpace / usSpace) als Karten mit
 * Schnell-Links. Aus settings-client.tsx herausgelöst, damit Settings UND das
 * angemeldete Dashboard (/start) dieselbe Übersicht nutzen.
 *
 * Erklärt die Räume für Anwender ohne Technik-Wissen
 * (Konzept: docs/settings-ux/README.md §2/§5).
 */

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Users, Globe, ChevronRight, Plus } from "lucide-react"

const spaceCards = [
  {
    id: "mespace",
    icon: BookOpen,
    space: "meSpace",
    title: "Meine Bibliothek",
    description:
      "Bauen Sie Ihre eigene Bibliothek auf — gegliedert wie die App: das " +
      "Archiv (wo Dokumente liegen und zu Wissen werden), Explore (wie man " +
      "sie in der Galerie erkundet) und Story (das Gespräch mit den Inhalten).",
    links: [
      { title: "Library", href: "/settings/general" },
      { title: "Archive", href: "/settings/archive" },
      { title: "Explore", href: "/settings/explore" },
      { title: "Story", href: "/settings/story" },
      { title: "Erweitert", href: "/settings/advanced" },
    ],
  },
  {
    id: "wespace",
    icon: Users,
    space: "weSpace",
    title: "Gemeinsam arbeiten",
    description:
      "Teilen Sie Ihre Bibliothek mit Personen, denen Sie vertrauen: Laden " +
      "Sie Mitglieder ein und vergeben Sie Rollen — vom Mitleser bis zum " +
      "Mitgestalter.",
    links: [{ title: "Personen", href: "/settings/public/members" }],
  },
  {
    id: "usspace",
    icon: Globe,
    space: "usSpace",
    title: "Veröffentlichen",
    description:
      "Machen Sie Ihre Bibliothek öffentlich zugänglich: mit eigenem Link " +
      "und Startseite — und behalten Sie die Kontrolle darüber, wer Zugang " +
      "bekommt.",
    links: [
      { title: "Öffentlicher Auftritt", href: "/settings/public" },
      { title: "Zugriffsanfragen", href: "/settings/public/access-requests" },
    ],
  },
]

interface SpaceOverviewProps {
  /** Öffnet den Anlage-Wizard für eine weitere Bibliothek */
  onCreateNew: () => void
}

export function SpaceOverview({ onCreateNew }: SpaceOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {spaceCards.map((card) => (
          <Card key={card.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <card.icon className="w-4 h-4" />
                {card.space}
              </div>
              <CardTitle className="text-lg">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <nav className="flex flex-col gap-1">
                {card.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    {link.title}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
        <p className="text-sm text-muted-foreground">
          Sie möchten eine weitere Bibliothek aufbauen?
        </p>
        <Button variant="outline" onClick={onCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Bibliothek erstellen
        </Button>
      </div>
    </div>
  )
}
