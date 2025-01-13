"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SignInButton, UserButton, SignedIn, SignedOut } from "@clerk/nextjs"
import { LibrarySwitcher } from "@/components/library/library-switcher"
import { LibraryContextProps } from "@/components/library/library"

const navItems = [
  {
    name: "Bibliothek",
    href: "/library",
  },
  {
    name: "Aufgaben",
    href: "/tasks",
  },
  {
    name: "Dashboard",
    href: "/dashboard",
  },
  {
    name: "Playground",
    href: "/playground",
  },
]

export function TopNav() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const isLibraryPage = pathname.startsWith('/library')
  const [libraryContext, setLibraryContext] = React.useState<LibraryContextProps | null>(null)

  // Empfange die Library-Props über Events
  React.useEffect(() => {
    const handleLibraryContextChange = (event: CustomEvent<LibraryContextProps | null>) => {
      setLibraryContext(event.detail)
    }

    window.addEventListener('libraryContextChange', handleLibraryContextChange as EventListener)

    return () => {
      window.removeEventListener('libraryContextChange', handleLibraryContextChange as EventListener)
    }
  }, [])

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <ScrollArea className="max-w-[600px] lg:max-w-none">
          <div className="flex items-center space-x-4">
            {navItems.map((item) => (
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
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
        <div className="ml-auto flex items-center space-x-4">
          {isLibraryPage && libraryContext && (
            <div className="w-[200px]">
              <LibrarySwitcher 
                libraries={libraryContext.libraries}
                activeLibraryId={libraryContext.activeLibraryId}
                onLibraryChange={libraryContext.onLibraryChange}
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>
    </div>
  )
} 