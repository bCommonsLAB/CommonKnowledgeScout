import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TopNav } from "@/components/top-nav"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'
import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"

export const metadata = {
  title: "Knowledge Scout",
  description: "Wissen entdecken und organisieren",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Wrapper-Komponente für Clerk
  const ClerkWrapper = ({ children }: { children: React.ReactNode }) => {
    // Während des Builds oder wenn kein Clerk-Key vorhanden ist, ohne Clerk rendern
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      return <>{children}</>;
    }
    
    return (
      <ClerkProvider>
        {children}
      </ClerkProvider>
    );
  };

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
                  <TopNav />
                  <div className="h-[calc(100vh-4rem)] overflow-auto">
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