import { Metadata } from "next"
import PlaygroundPage from "@/components/playground/page"

export const metadata: Metadata = {
  title: "Playground",
  description: "The OpenAI Playground built using the components.",
}

/**
 * Playground Route
 * 
 * This page displays the AI playground interface.
 * It serves as the main playground interface for model interaction.
 */
export default function Page() {
  return <PlaygroundPage />
} 