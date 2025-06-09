import "@/styles/globals.css"
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TopNav } from "@/components/top-nav"
import { Toaster } from "sonner"
import { ClerkProvider } from "@clerk/nextjs"
import { StorageContextProvider } from '@/contexts/storage-context'

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
    <ClerkProvider>
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
                <div className="h-screen overflow-hidden">
                  <TopNav />
                  {children}
                </div>
                <Toaster richColors />
              </TooltipProvider>
            </StorageContextProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}