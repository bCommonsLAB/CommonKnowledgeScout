"use client"

import { usePathname } from "next/navigation"
import { TopNavWrapper } from "@/components/top-nav-wrapper"
import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"
import { JobMonitorPanel } from "@/components/shared/job-monitor-panel"
import { useScrollVisibility } from "@/hooks/use-scroll-visibility"
import { cn } from "@/lib/utils"

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * Layout-Wrapper der zwischen Homepage-Layout (scrollbar)
 * und App-Layout (fixed height) unterscheidet.
 *
 * Variante 1 (Karten-Dichte/TopNav-Hide):
 * - TopNav ist `position: fixed` (siehe top-nav.tsx).
 * - Damit der Inhalt nicht unter der Bar liegt, wird hier ein `padding-top: 4rem` reserviert,
 *   das beim Hide synchron auf `0` kollabiert (`transition`), sodass der Inhalt 64 px nach oben
 *   nachrückt — kein „leerer Rand“ mehr oberhalb.
 * - Der Sichtbarkeitswert kommt aus dem gemeinsamen Hook `useScrollVisibility`, der nur auf
 *   `window`-Scroll hört. Hook wird hier UND in `TopNav` instanziiert; beide Listener ziehen
 *   dieselbe Quelle (window.scrollY) und bleiben damit konsistent.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()

  // Homepage, Docs, Info-Seiten und bestimmte Tools bekommen scrollbares Layout.
  // Hinweis: `/explore/*` ist BEWUSST kein scrollbares Layout, obwohl die URL danach klingt.
  // Die Explore-Seiten sind strukturell App-Seiten (fixed-height, eigener interner Scroll-
  // Container, `h-screen + overflow-hidden`). Im scrollbaren Zweig würde das Window dort gar
  // nicht scrollen → `useScrollVisibility` würde nicht feuern → die TopNav würde sich nicht
  // ausblenden lassen. Im App-Zweig sorgt `min-height: calc(100vh + 2px)` für die nötige
  // minimale window-Scrollbarkeit, die das Hide auslöst (gleiches Verhalten wie `/library/*`).
  const isScrollablePage = pathname === '/' ||
    pathname?.startsWith('/docs') ||
    pathname === '/info' ||
    pathname?.startsWith('/integration-tests')

  // Effektive Sichtbarkeit der TopNav (gleich wie in der TopNav selbst).
  const isTopNavVisible = useScrollVisibility()

  // Tailwind: arbitrary value, damit die Transition gezielt nur padding-top animiert.
  // 4rem == 64px == h-16 (TopNav-Höhe). Bei Hide → 0 → 64 px Inhalt rückt nach oben.
  const navPadClass = cn(
    "transition-[padding-top] duration-300 ease-in-out",
    isTopNavVisible ? "pt-16" : "pt-0"
  )

  if (isScrollablePage) {
    // Wichtig: KEIN inneres `overflow-y-auto`, sonst scrollt nicht das Window, sondern dieser
    // Container — und `useScrollVisibility` reagiert dann nicht (es hört bewusst nur auf
    // window.scrollY). Folge wäre: TopNav blendet nicht aus oder „zuckt“ durch Overscroll.
    // Mit `flex-1` allein wächst der Inhalt natürlich über den Viewport hinaus und das Window
    // wird scrollbar — exakt das Verhalten, das die Hide-Logik erwartet.
    return (
      <>
        <TopNavWrapper />
        <div className={cn("flex-1", navPadClass)}>
          {children}
        </div>
        <DebugFooterWrapper />
      </>
    )
  }

  // Fixed-height Layout für App-Seiten.
  // Wrapper bleibt minimal größer als Viewport, damit window.scrollY > 0 möglich ist
  // (Voraussetzung für den Hide/Show-Hook).
  return (
    <>
      <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh + 2px)' }}>
        <TopNavWrapper />
        <div className={cn("flex-1 min-h-0", navPadClass)}>
          {children}
        </div>
        <JobMonitorPanel />
        <DebugFooterWrapper />
      </div>
    </>
  )
}








