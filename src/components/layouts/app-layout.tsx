"use client"

import { usePathname } from "next/navigation"
import { TopNavWrapper } from "@/components/top-nav-wrapper"
import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"
import { JobMonitorPanel } from "@/components/shared/job-monitor-panel"
import { ChatSidePanel } from "@/components/shared/chat-panel"

interface AppLayoutProps {
  children: React.ReactNode
}

/**
 * Layout-Wrapper der zwischen Homepage-Layout (scrollbar) 
 * und App-Layout (fixed height) unterscheidet
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  
  // Homepage, Explore-Seiten, Docs und Info-Seiten bekommen scrollbares Layout
  const isScrollablePage = pathname === '/' || 
    pathname?.startsWith('/explore') ||
    pathname?.startsWith('/docs') ||
    pathname === '/info'
  
  if (isScrollablePage) {
    // Scrollbares Layout für Homepage und rechtliche Seiten
    return (
      <>
        <TopNavWrapper />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        <DebugFooterWrapper />
      </>
    )
  }
  
  // Fixed-height Layout für App-Seiten
  return (
    <>
      <div className="relative h-screen overflow-hidden flex flex-col">
        <TopNavWrapper />
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
        <JobMonitorPanel />
        <ChatSidePanel />
        <DebugFooterWrapper />
      </div>
    </>
  )
}








