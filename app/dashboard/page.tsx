import { Metadata } from "next"
import DashboardPage from "@/components/dashboard/page"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard overview of your application.",
}

/**
 * Dashboard Route
 * 
 * This is the main dashboard route that renders the dashboard component.
 * It serves as the entry point for the /dashboard path.
 */
export default function Page() {
  return <DashboardPage />
} 