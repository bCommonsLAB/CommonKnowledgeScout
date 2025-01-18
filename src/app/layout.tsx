import { DebugProvider } from "@/providers/debug-provider"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DebugProvider>
          {children}
        </DebugProvider>
      </body>
    </html>
  )
} 