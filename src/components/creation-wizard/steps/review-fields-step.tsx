"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"

interface ReviewFieldsStepProps {
  fields: string[]
  metadata: Record<string, unknown>
  templateMetadata: TemplateMetadataSchema
  onReview: (reviewed: Record<string, unknown>) => void
  reviewedFields?: Record<string, unknown>
}

export function ReviewFieldsStep({
  fields,
  metadata,
  templateMetadata,
  onReview,
  reviewedFields,
}: ReviewFieldsStepProps) {
  const [localFields, setLocalFields] = useState<Record<string, unknown>>(
    reviewedFields || metadata
  )

  useEffect(() => {
    // Initialisiere mit vorhandenen Metadaten
    const initial: Record<string, unknown> = {}
    for (const fieldName of fields) {
      initial[fieldName] = metadata[fieldName] ?? ""
    }
    setLocalFields(prev => ({ ...prev, ...initial }))
  }, [fields, metadata])

  const handleFieldChange = (fieldName: string, value: unknown) => {
    const updated = { ...localFields, [fieldName]: value }
    setLocalFields(updated)
    onReview(updated)
  }

  const getFieldDescription = (fieldName: string): string => {
    const field = templateMetadata.fields.find(f => f.key === fieldName || f.variable === fieldName)
    return field?.description || ""
  }

  const renderField = (fieldName: string) => {
    const value = localFields[fieldName]
    const description = getFieldDescription(fieldName)

    // Bestimme Feldtyp basierend auf Wert
    const isArray = Array.isArray(value)
    const isLongText = typeof value === "string" && value.length > 100

    if (isArray) {
      return (
        <div key={fieldName} className="space-y-2">
          <Label>{fieldName}</Label>
          <Textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleFieldChange(fieldName, parsed)
              } catch {
                // Bei Parse-Fehler als String behandeln
                handleFieldChange(fieldName, e.target.value)
              }
            }}
            rows={4}
            className="font-mono text-sm"
          />
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )
    }

    if (isLongText) {
      return (
        <div key={fieldName} className="space-y-2">
          <Label>{fieldName}</Label>
          <Textarea
            value={String(value || "")}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            rows={6}
          />
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )
    }

    return (
      <div key={fieldName} className="space-y-2">
        <Label>{fieldName}</Label>
        <Input
          type="text"
          value={String(value || "")}
          onChange={(e) => handleFieldChange(fieldName, e.target.value)}
        />
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    )
  }

  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            Keine Felder zum Überprüfen definiert.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Felder überprüfen</CardTitle>
        <CardDescription>
          Überprüfen und korrigieren Sie die wichtigsten Felder. Sie können diese später auch noch bearbeiten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map(fieldName => renderField(fieldName))}
      </CardContent>
    </Card>
  )
}








