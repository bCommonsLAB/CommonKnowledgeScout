import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TopNavWrapper } from "@/components/top-nav-wrapper"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'
import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"

export const metadata = {
  title: "Knowledge Scout",
  description: "Wissen entdecken und organisieren",
}

// Prüfen, ob wir im Build-Prozess sind
// Während des Builds ist NEXT_RUNTIME="build" oder es gibt keine/dummy Clerk Keys
const isBuildTime = process.env.NEXT_RUNTIME === 'build' || 
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === 'dummy_pk_test_placeholder' ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === '';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Während des Builds ein minimales Layout ohne Clerk rendern
  if (isBuildTime) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className={GeistSans.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <div className="h-screen overflow-auto">
              {children}
            </div>
            <Toaster richColors />
          </ThemeProvider>
        </body>
      </html>
    );
  }

  // Wrapper-Komponente für Clerk
  const ClerkWrapper = ({ children }: { children: React.ReactNode }) => {
    // Wenn kein Clerk-Key vorhanden ist, ohne Clerk rendern
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      return <>{children}</>;
    }
    
    return (
      <ClerkProvider>
        {children}
      </ClerkProvider>
    );
  };

  // Prüfen, ob Clerk verfügbar ist
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkWrapper>
      <html lang="en" suppressHydrationWarning>
        <body className={GeistSans.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <StorageContextProvider>
              <TooltipProvider>
                <div className="relative h-screen overflow-hidden">
                  <TopNavWrapper />
                  <div className={hasClerk ? "h-[calc(100vh-4rem)] overflow-auto" : "h-screen overflow-auto"}>
                    {children}
                  </div>
                  <DebugFooterWrapper />
                </div>
                <Toaster richColors />
              </TooltipProvider>
            </StorageContextProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkWrapper>
  )
}