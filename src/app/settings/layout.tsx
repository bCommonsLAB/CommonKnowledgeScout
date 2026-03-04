"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarNav } from "@/components/settings/sidebar-nav"
import { useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { useMemo } from "react"
import { Info } from "lucide-react"

// Alle verfuegbaren Settings-Tabs
const allSidebarItems = [
  { title: "Allgemeine Einstellungen", href: "/settings" },
  { title: "Storage", href: "/settings/storage" },
  { title: "Transformation", href: "/settings/secretary-service" },
  { title: "Story", href: "/settings/chat" },
  { title: "Veröffentlichen", href: "/settings/public" },
  { title: "Zugriffsanfragen", href: "/settings/public/access-requests" },
  { title: "Mitglieder", href: "/settings/public/members" },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  const isCoCreator = activeLibrary?.accessRole === 'co-creator'
  
  // Co-Creators sehen keine Settings-Tabs (Einstellungen liegen beim Owner)
  const sidebarItems = useMemo(() => {
    if (isCoCreator) return []
    return allSidebarItems
  }, [isCoCreator])

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
              Verwalten Sie Ihre Bibliotheken und deren Einstellungen.
            </p>
          </div>
          <Separator className="my-4" />
          {sidebarItems.length > 0 && <SidebarNav items={sidebarItems} />}
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
                Verwalten Sie Ihre Bibliotheken und deren Einstellungen.
              </p>
            </div>
            <Separator className="my-6" />
            
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
              {sidebarItems.length > 0 && (
                <aside className="-mx-4 lg:w-1/5">
                  <SidebarNav items={sidebarItems} />
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