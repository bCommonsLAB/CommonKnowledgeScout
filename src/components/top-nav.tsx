"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { Moon, Sun, Settings, Plus } from "lucide-react"
import { useTheme } from "next-themes"
import { useAtom } from "jotai"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { libraryAtom } from "@/atoms/library-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"


// Öffentliche Navigationselemente (immer sichtbar)
const publicNavItems = [
  {
    name: "Home",
    href: "/",
  },
];

// Geschützte Navigationselemente (nur für angemeldete Benutzer)
const protectedNavItems = [
  {
    name: "Bibliothek",
    href: "/library",
  },
  {
    name: "Templates",
    href: "/templates",
  },
  {
    name: "Event-Monitor",
    href: "/event-monitor",
  },
  {
    name: "Session-Manager",
    href: "/session-manager",
  },
];

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
  // Statt Events verwenden wir Jotai
  const [libraryContext] = useAtom(libraryAtom)
  const { libraries } = libraryContext
  


  return (
    <>
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <ScrollArea className="max-w-[600px] lg:max-w-none">
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
              </SignedIn>
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
          <div className="ml-auto flex items-center space-x-4">
            {/* Bibliotheks-Switcher - nur für angemeldete Benutzer */}
            <SignedIn>
              {libraries.length > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-[200px]">
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
                            pathname.startsWith('/settings') && "bg-muted"
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
                            pathname.startsWith('/settings') && "bg-muted"
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
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
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