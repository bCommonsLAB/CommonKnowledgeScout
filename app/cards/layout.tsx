"use client"

import * as React from "react"

interface CardsLayoutProps {
  children: React.ReactNode
}

/**
 * Cards Layout
 * 
 * Provides consistent layout structure for the cards section.
 * Includes responsive grid layout and proper spacing.
 */
export default function CardsLayout({ children }: CardsLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 