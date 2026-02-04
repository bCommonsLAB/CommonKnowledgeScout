import { Separator } from "@/components/ui/separator"
import { SidebarNav } from "@/components/settings/sidebar-nav"

// Einstellungen für Bibliotheksverwaltung
const librarySidebarItems = [
  {
    title: "Allgemeine Einstellungen",
    href: "/settings",
  },
  {
    title: "Storage",
    href: "/settings/storage",
  },
  {
    title: "Transformation",
    href: "/settings/secretary-service",
  },
  {
    title: "Story",
    href: "/settings/chat",
  },
  {
    title: "Veröffentlichen",
    href: "/settings/public",
  },
  {
    title: "Zugriffsanfragen",
    href: "/settings/public/access-requests",
  },
  {
    title: "Moderatoren",
    href: "/settings/public/members",
  },
  // Weitere bibliotheksbezogene Einstellungen können hier hinzugefügt werden
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-full">
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
          <SidebarNav items={librarySidebarItems} />
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
              <aside className="-mx-4 lg:w-1/5">
                <SidebarNav items={librarySidebarItems} />
              </aside>
              <div className="flex-1 min-w-0">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 