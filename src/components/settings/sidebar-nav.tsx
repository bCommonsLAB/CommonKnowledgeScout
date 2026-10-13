"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from '@ks/ui'

export interface SidebarNavItem {
  href: string
  title: string
  /** Zweite Ebene (Plan Teil B): aufgeklappt, sobald der Pfad mit `href` beginnt. */
  children?: SidebarNavItem[]
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

/** Ein Eintrag mit Kindern ist offen, sobald der Pfad mit seinem href beginnt. */
export function isNavItemOpen(pathname: string | null | undefined, item: SidebarNavItem): boolean {
  if (!item.children?.length || !pathname) return false
  return pathname === item.href || pathname.startsWith(item.href + "/")
}

/** Alle Einträge flach (Eltern und Kinder), z.B. für die Gruppen-Auflösung im Layout. */
export function flattenNavItems(items: SidebarNavItem[]): SidebarNavItem[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])])
}

interface NavLinkProps {
  item: SidebarNavItem
  isActive: boolean
  /** Kind-Eintrag: eingerückt in der vertikalen Ansicht, Chip in der horizontalen. */
  nested?: boolean
  trailing?: React.ReactNode
}

function NavLink({ item, isActive, nested = false, trailing }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        isActive ? "bg-muted hover:bg-muted" : "hover:bg-transparent hover:underline",
        "justify-start whitespace-nowrap flex-shrink-0 h-8",
        nested && "lg:ml-4"
      )}
    >
      {item.title}
      {trailing}
    </Link>
  )
}

/** Eintrag mit optionaler zweiter Ebene; Kinder erscheinen in derselben Zeile bzw. Spalte, ohne Umbruch. */
function NavEntry({ item, pathname }: { item: SidebarNavItem; pathname: string | null }) {
  if (!item.children?.length) {
    return <NavLink item={item} isActive={pathname === item.href} />
  }
  const open = isNavItemOpen(pathname, item)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <>
      <NavLink
        item={item}
        isActive={pathname === item.href}
        trailing={<Chevron className="ml-1 h-4 w-4 shrink-0" aria-hidden="true" />}
      />
      {open &&
        item.children.map((child) => (
          <NavLink key={child.href} item={child} isActive={pathname === child.href} nested />
        ))}
    </>
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
        <NavEntry key={item.href} item={item} pathname={pathname} />
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
              <NavEntry key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
