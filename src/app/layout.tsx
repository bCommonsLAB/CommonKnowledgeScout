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
 * - @ks/shell/providers: Theme- und Query-Provider der Schale
 * - @/contexts/storage-context: Storage context provider
 * - @/components/layouts/app-layout: Main application layout
 * - @/components/layouts/home-layout: Home page layout
 */

import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider, QueryProvider } from "@ks/shell/providers"
import { TooltipProvider, Toaster as HookToaster } from '@ks/ui'
import { Toaster } from "sonner"
// Die App hat ZWEI Meldungssysteme: `sonner` und den shadcn-Hook
// `useToast`. Letzterer wird in 41 Dateien benutzt, seine Anzeige war
// aber nie eingehaengt — jede Meldung daraus (kopiert, gespeichert,
// Fehler) verschwand still (Befund 27.08.2026). Beide bleiben stehen,
// bis eine Zusammenfuehrung ansteht.
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'
import { JotaiLocaleProvider, LocaleGate } from '@ks/i18n/react'
import { AppLayout } from "@/components/layouts/app-layout"
import { HomeLayout } from "@/components/layouts/home-layout"
import { getRootLandingTargetForHost } from "@/lib/root-landing"
import { ConditionalFooter } from "@/components/home/conditional-footer"
import { AutoAcceptInvites } from "@/components/auth/auto-accept-invites"
import { ViewerLoggerBridge } from "@/components/providers/viewer-logger-bridge"
import { LibraryChangeBridge } from "@/components/providers/library-change-bridge"
import { headers, cookies } from 'next/headers'
import { getLocale, type Locale } from '@ks/i18n'
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
                  <QueryProvider>
                    <ViewerLoggerBridge />
                    <LibraryChangeBridge />
                    <TooltipProvider>
                      <NuqsAdapter>
                        <HomeLayout>
                          {children}
                        </HomeLayout>
                      </NuqsAdapter>
                      <ConditionalFooter />
                      <Toaster richColors />
                      <HookToaster />
                    </TooltipProvider>
                  </QueryProvider>
                </StorageContextProvider>
              </LocaleGate>
            </JotaiLocaleProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  // E7 + Variante B: Slug der Root-Landingpage (oder null) fuer den aktuellen
  // Host. Nur im Runtime-Zweig gelesen, damit der Build-Zweig keinen DB-Zugriff
  // ausloest. AppLayout blendet damit die Shell auf `/` serverseitig aus (kein
  // TopNav-Flash). Host-abhaengig, damit eine gemappte Domain (z.B.
  // oldiesforfuture.org) shell-frei rendert, knowledgescout.org aber unveraendert bleibt.
  const rootLandingHost = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const rootLandingSlug = (await getRootLandingTargetForHost(rootLandingHost))?.slug ?? null

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
                  <QueryProvider>
                    <AutoAcceptInvites />
                    <ViewerLoggerBridge />
                    <LibraryChangeBridge />
                    <TooltipProvider>
                      <div className="relative min-h-screen flex flex-col">
                        <NuqsAdapter>
                          <AppLayout rootLandingSlug={rootLandingSlug}>
                            {children}
                          </AppLayout>
                        </NuqsAdapter>
                        {/* Gleiche Host-Entscheidung wie AppLayout: auf der
                            gemappten Domain-Root entfaellt der KS-Footer
                            (die Website rendert ihre eigene Fusszeile). */}
                        <ConditionalFooter rootLandingSlug={rootLandingSlug} />
                      </div>
                      <Toaster richColors />
                      <HookToaster />
                    </TooltipProvider>
                  </QueryProvider>
                </StorageContextProvider>
              </LocaleGate>
            </JotaiLocaleProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkWrapper>
  )
}