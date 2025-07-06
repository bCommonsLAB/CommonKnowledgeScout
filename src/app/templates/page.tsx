import { Metadata } from "next"
import { TemplateManagement } from "@/components/templates/template-management"

export const metadata: Metadata = {
  title: "Templates - Secretary Service Templates",
  description: "Verwalten Sie die Templates für den Secretary Service.",
}

export default function TemplatesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
        </div>
        <div className="text-muted-foreground">
          Verwalten Sie die Templates für den Secretary Service. Templates werden im Library-Storage im Verzeichnis &quot;/templates&quot; gespeichert und können YAML Frontmatter, Markdown Body und System Prompts enthalten.
        </div>
      </div>
      <div className="flex-1 p-8 pt-0">
        <TemplateManagement />
      </div>
    </div>
  )
} 