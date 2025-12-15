import { Metadata } from "next"
import { TemplateManagement } from "@/components/templates/template-management"

export const metadata: Metadata = {
  title: "Vorlagen",
  description: "Verwaltung und Design von Vorlagen für den Secretary Service",
}

export default function TemplatesPage() {
  return (
    <div className="p-6">
      <TemplateManagement />
    </div>
  )
} 