interface MusicLayoutProps {
  children: React.ReactNode
}

/**
 * Music Layout
 * 
 * Provides consistent layout structure for the music section.
 * Includes sidebar navigation and player controls.
 */
export default function MusicLayout({ children }: MusicLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 