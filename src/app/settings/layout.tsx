"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarNav, type SidebarNavGroup } from "@/components/settings/sidebar-nav"
import { useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { Info } from "lucide-react"

// Übersichts-Link oberhalb der Raum-Gruppe
const overviewItems = [{ title: "← Übersicht", href: "/settings" }]

// Die drei Räume (Konzept: docs/settings-ux/README.md §2 und §5).
// Jede Gruppe traegt einen Erklaertext fuer Anwender ohne Technik-Wissen.
const sidebarGroups: SidebarNavGroup[] = [
  {
    id: "mespace",
    title: "meSpace · Meine Bibliothek",
    description: "Aufbauen & gestalten — gegliedert wie die App: Archiv, Explore, Story.",
    items: [
      { title: "Library", href: "/settings/general" },
      { title: "Archive", href: "/settings/archive" },
      { title: "Explore", href: "/settings/explore" },
      { title: "Story", href: "/settings/story" },
      { title: "Erweitert", href: "/settings/advanced" },
    ],
  },
  {
    id: "wespace",
    title: "weSpace · Gemeinsam arbeiten",
    description: "Die Bibliothek mit vertrauten Personen teilen und Rollen vergeben.",
    items: [{ title: "Personen", href: "/settings/public/members" }],
  },
  {
    id: "usspace",
    title: "usSpace · Veröffentlichen",
    description: "Die Bibliothek öffentlich machen und den Zugang steuern.",
    items: [
      { title: "Öffentlicher Auftritt", href: "/settings/public" },
      { title: "Zugriffsanfragen", href: "/settings/public/access-requests" },
    ],
  },
]

// E7 (Welle 3-IV-UX-4): Moderatoren einer fremden Bibliothek sehen statt
// ALLER Owner-Tabs nur ihren Verwaltungsbereich (Anfragen + Leser einladen).
// Die Personen-Seite bleibt Owner-only (members-API liefert Moderatoren 403).
const moderatorGroup: SidebarNavGroup = {
  id: "moderation",
  title: "Moderation",
  description: "Zugriffsanfragen dieser Bibliothek verwalten und Leser einladen.",
  items: [{ title: "Zugriffsanfragen", href: "/settings/public/access-requests" }],
}

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const pathname = usePathname()

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  const isCoCreator = activeLibrary?.accessRole === 'co-creator'
  const isModerator = activeLibrary?.accessRole === 'moderator'

  // Sidebar zeigt NUR den Raum, fuer den sich der User entschieden hat —
  // auf der Uebersicht (/settings) uebernehmen die Karten die Navigation.
  // Co-Creators sehen keine Settings-Tabs (Einstellungen liegen beim Owner).
  const activeGroup = useMemo(() => {
    if (isCoCreator || !pathname || pathname === "/settings") return undefined
    // Moderatoren haben genau einen Verwaltungsbereich (E7)
    if (isModerator) return moderatorGroup
    const exact = sidebarGroups.find(g => g.items.some(i => i.href === pathname))
    if (exact) return exact
    // Fallback fuer kuenftige Unterrouten: laengster Pfad-Prefix gewinnt
    let best: { group: SidebarNavGroup; len: number } | undefined
    for (const group of sidebarGroups) {
      for (const item of group.items) {
        if (pathname.startsWith(item.href + "/") && (!best || item.href.length > best.len)) {
          best = { group, len: item.href.length }
        }
      }
    }
    return best?.group
  }, [isCoCreator, isModerator, pathname])

  const hasNav = activeGroup !== undefined

  return (
    <div className="flex flex-col h-full">
      {/* Hinweis fuer Co-Creators */}
      {isCoCreator && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 px-6 py-4">
          <div className="flex items-start gap-3 max-w-3xl">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Geteilte Bibliothek
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Diese Bibliothek wird von einem anderen Benutzer verwaltet.
                Die Einstellungen koennen nur vom Owner geaendert werden.
                Sie koennen im Archiv, Explore- und Story-Modus arbeiten.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Version */}
      <div className="md:hidden flex-1 overflow-y-auto">
        <div className="p-6 pb-16 space-y-6">
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold tracking-tight">Bibliothek verwalten</h2>
            <p className="text-sm text-muted-foreground">
              Drei Räume: meSpace (aufbauen), weSpace (teilen), usSpace (veröffentlichen).
            </p>
          </div>
          <Separator className="my-4" />
          {hasNav && activeGroup && (
            <SidebarNav items={overviewItems} groups={[activeGroup]} />
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>

      {/* Desktop Version */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-10 pb-16">
            <div className="space-y-0.5">
              <h2 className="text-2xl font-bold tracking-tight">Bibliothek verwalten</h2>
              <p className="text-muted-foreground">
                Drei Räume: meSpace (Bibliothek aufbauen), weSpace (mit vertrauten
                Personen teilen), usSpace (veröffentlichen).
              </p>
            </div>
            <Separator className="my-6" />

            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
              {hasNav && activeGroup && (
                <aside className="-mx-4 lg:w-1/5">
                  <SidebarNav items={overviewItems} groups={[activeGroup]} />
                </aside>
              )}
              <div className="flex-1 min-w-0">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
