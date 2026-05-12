'use client'

import React from 'react'
import { useSwipeable } from 'react-swipeable'
import { cn } from '@/lib/utils'

export interface TinderSwipeFrameProps {
  /** Inhalt, der "verwischbar" sein soll (Detail-View des aktuellen Docs). */
  children: React.ReactNode
  /** Linker Swipe (nicht wichtig). */
  onSwipeLeft: () => void
  /** Rechter Swipe (favorit). */
  onSwipeRight: () => void
  /** Optional: Tastatur-Shortcuts (Pfeil links/rechts) aktivieren. */
  enableKeyboard?: boolean
  className?: string
}

/**
 * Wrapper-Komponente fuer den Tinder-Mode in der Detail-Overlay.
 *
 * Erkennt horizontale Swipes via `react-swipeable` und animiert den
 * Inhalt waehrend des Wischens leicht in die Richtung. Bei Loslassen
 * wird `onSwipeLeft` (links = nicht wichtig) bzw. `onSwipeRight` (rechts
 * = favorit) aufgerufen. Vertikale Bewegungen werden ignoriert, damit
 * die Detail-Liste weiter gescrollt werden kann.
 */
export function TinderSwipeFrame({
  children,
  onSwipeLeft,
  onSwipeRight,
  enableKeyboard = true,
  className,
}: TinderSwipeFrameProps) {
  const [delta, setDelta] = React.useState(0)
  const [isAnimating, setIsAnimating] = React.useState(false)

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setDelta(e.deltaX)
      }
    },
    onSwipedLeft: () => {
      setIsAnimating(true)
      setDelta(-window.innerWidth)
      window.setTimeout(() => {
        setIsAnimating(false)
        setDelta(0)
        onSwipeLeft()
      }, 180)
    },
    onSwipedRight: () => {
      setIsAnimating(true)
      setDelta(window.innerWidth)
      window.setTimeout(() => {
        setIsAnimating(false)
        setDelta(0)
        onSwipeRight()
      }, 180)
    },
    onTouchEndOrOnMouseUp: () => {
      if (!isAnimating) setDelta(0)
    },
    trackMouse: true,
    delta: 60,
    preventScrollOnSwipe: false,
  })

  React.useEffect(() => {
    if (!enableKeyboard) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') onSwipeLeft()
      else if (e.key === 'ArrowRight') onSwipeRight()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enableKeyboard, onSwipeLeft, onSwipeRight])

  const rotate = Math.max(-12, Math.min(12, delta / 24))

  return (
    <div
      {...handlers}
      className={cn('h-full w-full', className)}
      style={{
        touchAction: 'pan-y',
        transform: `translateX(${delta}px) rotate(${rotate}deg)`,
        transition: isAnimating ? 'transform 180ms ease-out' : 'transform 120ms ease-out',
      }}
    >
      {children}
    </div>
  )
}
