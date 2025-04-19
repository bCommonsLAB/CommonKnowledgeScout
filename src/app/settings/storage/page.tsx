import { Separator } from "@/components/ui/separator"
import { StorageForm } from "@/components/settings/storage-form"

export default function OwnerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Storage Provider</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihren Speicherort, in dem ihre Bibliothek physisch gespeichert wird. 
        </p>
      </div>
      <Separator />
      <StorageForm />
    </div>
  )
} 