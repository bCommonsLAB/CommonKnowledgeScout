"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { SettingsLogger } from "@/lib/debug/logger"

export type StorageType = "local" | "onedrive" | "gdrive" | "webdav"

interface StorageTypeSelectorProps {
  value?: StorageType
  onChange: (type: StorageType) => void
  disabled?: boolean
}

const storageTypeOptions = [
  {
    value: "local" as const,
    label: "Lokales Dateisystem",
    description: "Speichern Sie Dateien direkt auf Ihrem Computer"
  },
  {
    value: "onedrive" as const,
    label: "Microsoft OneDrive",
    description: "Synchronisierung mit Microsoft OneDrive"
  },
  {
    value: "gdrive" as const,
    label: "Google Drive",
    description: "Synchronisierung mit Google Drive"
  },
  {
    value: "webdav" as const,
    label: "Nextcloud WebDAV",
    description: "Verbindung zu Nextcloud über WebDAV-Protokoll"
  }
]

export function StorageTypeSelector({ value, onChange, disabled }: StorageTypeSelectorProps) {
  const handleValueChange = (newValue: string) => {
    const storageType = newValue as StorageType
    SettingsLogger.info('StorageTypeSelector', 'Storage-Typ geändert', {
      from: value,
      to: storageType
    })
    onChange(storageType)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Speichertyp
      </label>
      <Select
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Wählen Sie einen Speichertyp" />
        </SelectTrigger>
        <SelectContent>
          {storageTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Wählen Sie den Typ des Speichers, den Sie verwenden möchten.
      </p>
    </div>
  )
}

// Hook-Form-Version für Integration in bestehende Forms
interface StorageTypeSelectorFieldProps {
  control: any
  name: string
  disabled?: boolean
}

export function StorageTypeSelectorField({ control, name, disabled }: StorageTypeSelectorFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Speichertyp</FormLabel>
          <Select
            onValueChange={field.onChange}
            value={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie einen Speichertyp" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {storageTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            Wählen Sie den Typ des Speichers, den Sie verwenden möchten.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}