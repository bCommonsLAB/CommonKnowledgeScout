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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { libraryAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LanguageSwitcher } from "@/components/shared/language-switcher"
import { useTranslation } from "@/lib/i18n/hooks"


export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  
  // Statt Events verwenden wir Jotai
  const [libraryContext] = useAtom(libraryAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const { libraries } = libraryContext
  
  // Prüfe ob Story-Modus aktiv ist
  const isStoryMode = searchParams?.get('mode') === 'story'

  const [open, setOpen] = React.useState(false)
  
  // Navigationselemente mit Übersetzungen
  const publicNavItems = [
    {
      name: t('navigation.home'),
      href: "/",
    },
    {
      name: t('navigation.docs'),
      href: "/docs/index.html",
    },
  ];
  
  const protectedNavItems = [
    {
      name: t('navigation.library'),
      href: "/library",
    },
    {
      name: t('navigation.gallery'),
      href: "/library/gallery",
    },
    {
      name: t('navigation.templates'),
      href: "/templates",
    },
    {
      name: t('navigation.eventMonitor'),
      href: "/event-monitor",
    },
    {
      name: t('navigation.sessionManager'),
      href: "/session-manager",
    },
  ];

  return (
    <>
      <div className="border-b">
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
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      pathname === item.href ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Geschützte Navigationselemente - nur für angemeldete Benutzer */}
                <SignedIn>
                  {protectedNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm",
                        pathname === item.href ? "bg-muted text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                  {/* Dynamischer Chat-Link (abhängig von aktiver Bibliothek) */}
                  <Link
                    href={activeLibraryId ? `/library/${activeLibraryId}/chat` : "/library"}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      pathname?.includes('/library/') && pathname?.includes('/chat')
                        ? "bg-muted text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    Chat
                  </Link>
                  {/* Dynamischer Story-Link (abhängig von aktiver Bibliothek) */}
                  <Link
                    href="/library/gallery?mode=story"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm",
                      pathname?.includes('/library/') && pathname?.includes('/gallery') && isStoryMode
                        ? "bg-muted text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    Story
                  </Link>
                </SignedIn>
                
                <div className="pt-3 border-t" />
                {/* Settings + Dark Mode im Menü */}
                <SignedIn>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => { setOpen(false); router.push('/settings') }}
                    >
                      <Settings className="h-4 w-4 mr-2" /> Einstellungen
                    </Button>
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
                {protectedNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
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
                {/* Dynamischer Chat-Link */}
                <Link
                  key="/library/[id]/chat"
                  href={activeLibraryId ? `/library/${activeLibraryId}/chat` : "/library"}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                    pathname?.includes('/library/') && pathname?.includes('/chat')
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  Chat
                </Link>
                {/* Dynamischer Story-Link */}
                <Link
                  key="/library/[id]/gallery?mode=story"
                  href="/library/gallery?mode=story"
                  className={cn(
                    "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
                    pathname?.includes('/library/') && pathname?.includes('/gallery') && isStoryMode
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  Story
                </Link>
              </SignedIn>
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
          <div className="ml-auto flex items-center space-x-2">
            {/* Bibliotheks-Switcher - immer sichtbar, rechtsbündig */}
            <SignedIn>
              {libraries.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-[160px] sm:w-[180px] md:w-[200px]">
                    <LibrarySwitcher />
                  </div>
                  
                  {/* Zahnrad-Symbol für Einstellungen */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push('/settings')}
                          className={cn(
                            "rounded-full",
                            pathname?.startsWith('/settings') && "bg-muted"
                          )}
                        >
                          <Settings className="h-[1.2rem] w-[1.2rem]" />
                          <span className="sr-only">Bibliothekseinstellungen</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bibliothekseinstellungen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                /* Neue Bibliothek Button für Benutzer ohne Bibliotheken */
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
                  
                  {/* Zahnrad-Symbol für Einstellungen */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push('/settings')}
                          className={cn(
                            "rounded-full",
                            pathname?.startsWith('/settings') && "bg-muted"
                          )}
                        >
                          <Settings className="h-[1.2rem] w-[1.2rem]" />
                          <span className="sr-only">Bibliothekseinstellungen</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bibliothekseinstellungen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </SignedIn>
            
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
                <Button variant="default" size="sm">
                  Anmelden
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