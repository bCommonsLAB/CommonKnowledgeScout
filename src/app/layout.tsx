import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'
import { AppLayout } from "@/components/layouts/app-layout"
import { HomeLayout } from "@/components/layouts/home-layout"
import { ConditionalFooter } from "@/components/home/conditional-footer"

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
            <StorageContextProvider>
              <TooltipProvider>
                <HomeLayout>
                  {children}
                </HomeLayout>
                <ConditionalFooter />
                <Toaster richColors />
              </TooltipProvider>
            </StorageContextProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }

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
                <div className="relative min-h-screen flex flex-col">
                  <AppLayout>
                    {children}
                  </AppLayout>
                  <ConditionalFooter />
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