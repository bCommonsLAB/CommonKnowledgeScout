interface PlaygroundLayoutProps {
  children: React.ReactNode
}

/**
 * Playground Layout
 * 
 * Provides consistent layout structure for the playground section.
 * Includes space for the editor and controls.
 */
export default function PlaygroundLayout({ children }: PlaygroundLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 