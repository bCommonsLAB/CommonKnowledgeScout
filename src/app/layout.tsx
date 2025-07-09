import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TopNavWrapper } from "@/components/top-nav-wrapper"
import { Toaster } from "sonner"
import { AuthProvider } from "@/lib/auth/client";
import { StorageContextProvider } from '@/contexts/storage-context'
import { DebugFooterWrapper } from "@/components/debug/debug-footer-wrapper"
import { DynamicAuthProvider } from "../components/dynamic-auth-provider"

export const metadata = {
  title: "Knowledge Scout",
  description: "Wissen entdecken und organisieren",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={GeistSans.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <DynamicAuthProvider>
            <AuthProvider>
              <StorageContextProvider>
                <TooltipProvider>
                  <div className="relative h-screen overflow-hidden">
                    <TopNavWrapper />
                    <div className="h-[calc(100vh-4rem)] overflow-auto">
                      {children}
                    </div>
                    <DebugFooterWrapper />
                  </div>
                  <Toaster richColors />
                </TooltipProvider>
              </StorageContextProvider>
            </AuthProvider>
          </DynamicAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}