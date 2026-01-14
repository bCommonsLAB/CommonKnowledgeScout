/**
 * @fileoverview Root Layout Component - Application Shell
 * 
 * @description
 * The root layout component for the Next.js application. Provides the application shell
 * with authentication (Clerk), theming, storage context, and layout components.
 * Handles build-time rendering without Clerk and runtime rendering with full providers.
 * 
 * @module core
 * 
 * @exports
 * - default: RootLayout component
 * - metadata: Page metadata for SEO
 * 
 * @usedIn
 * - Next.js framework: Automatically wraps all pages
 * - All pages: Inherit layout structure and providers
 * 
 * @dependencies
 * - @clerk/nextjs: Clerk authentication provider
 * - @/components/theme-provider: Theme management
 * - @/contexts/storage-context: Storage context provider
 * - @/components/layouts/app-layout: Main application layout
 * - @/components/layouts/home-layout: Home page layout
 */

import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'
import { JotaiLocaleProvider } from '@/components/providers/jotai-locale-provider'
import { LocaleGate } from '@/components/providers/locale-gate'
import { AppLayout } from "@/components/layouts/app-layout"
import { HomeLayout } from "@/components/layouts/home-layout"
import { ConditionalFooter } from "@/components/home/conditional-footer"
import { AutoAcceptInvites } from "@/components/auth/auto-accept-invites"
import { headers, cookies } from 'next/headers'
import { getLocale, type Locale } from '@/lib/i18n'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ermittele Server-Locale bevorzugt aus Middleware-Header, sonst Cookie/Accept-Language
  const headersList = await headers()
  const cookieStore = await cookies()
  const headerLocale = headersList.get('x-locale') || undefined
  const cookieValue = cookieStore.get('locale')?.value
  const acceptLanguage = headersList.get('accept-language') || undefined
  const serverLocale = (headerLocale as Locale) || getLocale(undefined, cookieValue, acceptLanguage)
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
      <html lang={serverLocale} suppressHydrationWarning>
        <body className={GeistSans.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <JotaiLocaleProvider serverLocale={serverLocale}>
              <LocaleGate>
                <StorageContextProvider>
                  <TooltipProvider>
                    <NuqsAdapter>
                      <HomeLayout>
                        {children}
                      </HomeLayout>
                    </NuqsAdapter>
                    <ConditionalFooter />
                    <Toaster richColors />
                  </TooltipProvider>
                </StorageContextProvider>
              </LocaleGate>
            </JotaiLocaleProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkWrapper>
      <html lang={serverLocale} suppressHydrationWarning>
        <body className={GeistSans.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <JotaiLocaleProvider serverLocale={serverLocale}>
              <LocaleGate>
                <StorageContextProvider>
                  <AutoAcceptInvites />
                  <TooltipProvider>
                    <div className="relative min-h-screen flex flex-col">
                      <NuqsAdapter>
                        <AppLayout>
                          {children}
                        </AppLayout>
                      </NuqsAdapter>
                      <ConditionalFooter />
                    </div>
                    <Toaster richColors />
                  </TooltipProvider>
                </StorageContextProvider>
              </LocaleGate>
            </JotaiLocaleProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkWrapper>
  )
}