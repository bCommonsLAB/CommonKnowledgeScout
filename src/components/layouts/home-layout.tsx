"use client"

import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"

interface HomeLayoutProps {
  children: React.ReactNode
}

/**
 * Minimales Layout für Build-Zeit ohne Routing
 */
export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <>
      <div className="min-h-screen">
        {children}
      </div>
      <DebugFooterWrapper />
    </>
  )
}
























