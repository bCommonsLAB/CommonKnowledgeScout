"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Moon, Sun, Settings, Plus, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { useAtom } from "jotai"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { libraryAtom } from "@/atoms/library-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { useTranslation } from "@/lib/i18n/hooks"
import { useScrollVisibility } from "@/hooks/use-scroll-visibility"
import { useUserRole } from "@/hooks/use-user-role"
import { buildTopNavConfig } from "@/components/top-nav-config"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const { isCreator } = useUserRole()
  
  // Statt Events verwenden wir Jotai
  const [libraryContext] = useAtom(libraryAtom)
  const { libraries, activeLibraryId } = libraryContext
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)
  const webViewEnabled = activeLibrary?.config?.publicPublishing?.siteEnabled === true
  const activeLibrarySlug =
    activeLibrary?.config?.publicPublishing?.slugName ||
    activeLibrary?.slug ||
    ''
  const webViewTestHref = activeLibrarySlug
    ? `/explore/${encodeURIComponent(activeLibrarySlug)}?view=site`
    : ''
  
  // Prüfe ob Story-Modus aktiv ist
  const isStoryMode = searchParams?.get('mode') === 'story'

  const [open, setOpen] = React.useState(false)
  
  // Hilfsfunktion um zu prüfen, ob ein Nav-Item aktiv ist
  const isActiveNavItem = (href: string) => {
    if (href === '/docs/') {
      return pathname?.startsWith('/docs') ?? false
    }
    if (href === '/templates') {
      return pathname?.startsWith('/templates') ?? false
    }
    if (href === '/event-monitor') {
      return pathname?.startsWith('/event-monitor') ?? false
    }
    if (href === '/session-manager') {
      return pathname?.startsWith('/session-manager') ?? false
    }
    if (href.includes('?mode=story')) {
      return pathname === '/library/gallery' && isStoryMode
    }
    if (href === '/library/gallery') {
      return pathname === '/library/gallery' && !isStoryMode
    }
    return pathname === href
  }
  
  // Auto-Hide beim Scrollen - verwendet gemeinsamen Hook
  const isVisible = useScrollVisibility()
  
  const {
    publicNavItems,
    primaryProtectedNavItems,
    secondaryNavItems,
    showMoreMenu,
  } = buildTopNavConfig({
    isCreator,
    webViewEnabled,
    webViewTestHref,
    t,
  })

  const hasSecondaryActive =
    pathname?.startsWith('/settings') === true ||
    secondaryNavItems.some((item) => isActiveNavItem(item.href))

  return (
    <>
      {/* Variante 1: Bar liegt fixed über dem Inhalt; der Layout-Wrapper reserviert/kollabiert
         seinerseits per padding-top den 64px-Platz, damit der „Rand“ beim Hide nicht stehen bleibt. */}
      <div 
        className={cn(
          "border-b bg-background transition-transform duration-300 ease-in-out fixed top-0 left-0 right-0 z-50",
          isVisible ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="flex h-16 items-center px-4">
          {/* Hamburger links, bis <lg sichtbar */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden mr-2" aria-label="Menü">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Menü</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {/* Öffentliche Navigationselemente - immer sichtbar */}
                {publicNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noreferrer" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      pathname === item.href ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Geschützte Primärnavigation - nur für angemeldete Creator */}
                <SignedIn>
                  {primaryProtectedNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noreferrer" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm",
                        isActiveNavItem(item.href) ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                </SignedIn>
                
                {secondaryNavItems.length > 0 && (
                  <>
                    <div className="pt-3 border-t" />
                    <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mehr
                    </div>
                    {secondaryNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm",
                          isActiveNavItem(item.href) ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                        )}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </>
                )}

                <div className="pt-3 border-t" />
                {/* Settings + Dark Mode im Menü - nur für Creators */}
                <SignedIn>
                  <div className="space-y-2">
                    {isCreator && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => { setOpen(false); router.push('/settings') }}
                      >
                        <Settings className="h-4 w-4 mr-2" /> Einstellungen
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    >
                      <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span className="ml-6">Dark Mode</span>
                    </Button>
                  </div>
                </SignedIn>
              </div>
            </SheetContent>
          </Sheet>

          <ScrollArea className="max-w-[600px] lg:max-w-none hidden lg:block">
            <div className="flex items-center space-x-4">
              {/* Öffentliche Navigationselemente - immer sichtbar */}
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.newTab ? "_blank" : undefined}
                  rel={item.newTab ? "noreferrer" : undefined}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Geschützte Navigationselemente - nur für angemeldete Benutzer */}
              <SignedIn>
                {primaryProtectedNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noreferrer" : undefined}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                      isActiveNavItem(item.href)
                        ? "bg-muted text-primary"
                        : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </SignedIn>
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
          <div className="ml-auto flex items-center space-x-2">
            {/* OPTIMIERUNG: Bibliotheks-Switcher nur wenn eingeloggt
                Im anonymen Modus werden Libraries nicht geladen und sind nicht sichtbar */}
            <SignedIn>
              {libraries.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-[160px] sm:w-[180px] md:w-[200px]">
                    <LibrarySwitcher />
                  </div>
                </div>
              ) : (
                /* Neue Bibliothek Button für Creators ohne Bibliotheken */
                isCreator && (
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={() => router.push('/settings?newUser=true')}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Neue Bibliothek
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Erste Bibliothek erstellen</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )
              )}
            </SignedIn>

            {showMoreMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("rounded-full", hasSecondaryActive && "bg-muted")}
                  >
                    <Settings className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Mehr Optionen</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Mehr</DropdownMenuLabel>
                  <SignedIn>
                    {isCreator && (
                      <>
                        <DropdownMenuItem onClick={() => router.push('/settings')}>
                          Einstellungen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                  </SignedIn>
                  {secondaryNavItems.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={isActiveNavItem(item.href) ? "bg-muted font-medium" : ""}
                    >
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Sprachumschalter - immer sichtbar */}
            <LanguageSwitcher />
            
            {/* Theme Toggle nur Desktop */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="secondary" size="sm">
                  {t('common.signIn')}
                </Button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>


    </>
  )
} 