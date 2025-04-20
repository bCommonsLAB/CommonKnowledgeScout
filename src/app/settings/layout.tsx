import Image from "next/image"
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
    title: "Secretary Service",
    href: "/settings/secretary-service",
  },
  // Weitere bibliotheksbezogene Einstellungen können hier hinzugefügt werden
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <div className="md:hidden">
        <Image
          src="/examples/forms-light.png"
          width={1280}
          height={791}
          alt="Forms"
          className="block dark:hidden"
        />
        <Image
          src="/examples/forms-dark.png"
          width={1280}
          height={791}
          alt="Forms"
          className="hidden dark:block"
        />
      </div>
      <div className="hidden space-y-6 p-10 pb-16 md:block">
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
          <div className="flex-1 lg:max-w-2xl">{children}</div>
        </div>
      </div>
    </>
  )
} 