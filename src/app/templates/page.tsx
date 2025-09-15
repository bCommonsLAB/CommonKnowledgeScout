import { Metadata } from "next"
import { TemplateManagement } from "@/components/templates/template-management"

export const metadata: Metadata = {
  title: "Prompts",
  description: "Verwaltung und Design von Prompts für den Secretary Service",
}

export default function TemplatesPage() {
  return (
    <div className="p-6">
      <TemplateManagement />
    </div>
  )
} 