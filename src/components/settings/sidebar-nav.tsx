"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

interface SidebarNavItem {
  href: string
  title: string
}

/** Raum-Gruppe (meSpace/weSpace/usSpace) mit Erklärtext für Anwender */
export interface SidebarNavGroup {
  id: string
  title: string
  description: string
  items: SidebarNavItem[]
}

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Einzelne Links oberhalb der Gruppen (z.B. Übersicht) */
  items?: SidebarNavItem[]
  /** Gruppierte Navigation nach Räumen */
  groups?: SidebarNavGroup[]
}

function NavLink({ item, isActive }: { item: SidebarNavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline",
        "justify-start whitespace-nowrap flex-shrink-0 h-8"
      )}
    >
      {item.title}
    </Link>
  )
}

export function SidebarNav({ className, items = [], groups = [], ...props }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "flex space-x-2 overflow-x-auto pb-2 -mx-2 px-2 lg:flex-col lg:space-x-0 lg:space-y-1 lg:overflow-x-visible lg:pb-0 lg:-mx-0 lg:px-0",
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <NavLink key={item.href} item={item} isActive={pathname === item.href} />
      ))}
      {groups.map((group) => (
        <div key={group.id} className="flex shrink-0 items-center gap-2 lg:block lg:pt-4">
          <div className="px-3 lg:px-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80 whitespace-nowrap">
              {group.title}
            </div>
            {/* Erklärtext nur in der vertikalen Ansicht — mobil zu eng */}
            <p className="hidden lg:block text-xs text-muted-foreground mt-0.5 mb-1">
              {group.description}
            </p>
          </div>
          <div className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} isActive={pathname === item.href} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
