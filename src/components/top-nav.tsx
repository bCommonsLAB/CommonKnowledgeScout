"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

const navItems = [
  {
    name: "Examples",
    href: "/cards",
  },
  {
    name: "Mail",
    href: "/mail",
  },
  {
    name: "Tasks",
    href: "/tasks",
  },
  {
    name: "Dashboard",
    href: "/dashboard",
  },
  {
    name: "Forms",
    href: "/forms",
  },
  {
    name: "Music",
    href: "/music",
  },
  {
    name: "Playground",
    href: "/playground",
  },
]

interface TopNavProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TopNav({ className, ...props }: TopNavProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <ScrollArea className="max-w-[600px] lg:max-w-none">
          <div className={cn("flex items-center", className)} {...props}>
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname?.startsWith(item.href) ?? false}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
        <div className="ml-auto flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Avatar>
            <AvatarFallback>PA</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  )
}

function NavLink({
  item,
  isActive,
}: {
  item: (typeof navItems)[number]
  isActive: boolean
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-7 items-center justify-center rounded-full px-4 text-center text-sm font-medium transition-colors hover:text-primary",
        isActive
          ? "bg-muted text-primary"
          : "text-muted-foreground hover:text-primary"
      )}
    >
      {item.name}
    </Link>
  )
} 