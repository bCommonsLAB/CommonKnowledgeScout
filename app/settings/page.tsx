import { Metadata } from "next"
import { Separator } from "@/components/ui/separator"
import { LibraryForm } from "@/components/settings/library-form"

export const metadata: Metadata = {
  title: "Forms",
  description: "Advanced form example with validation.",
}

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Bibliothek</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Bibliothek.
        </p>
      </div>
      <Separator />
      <LibraryForm />
    </div>
  )
} 