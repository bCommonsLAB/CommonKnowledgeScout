/**
 * Schema des Verbindungs-Formulars (reine Funktionen, testbar ohne React).
 * Pflichtfelder haengen am Typ; ein Geheimnis ist nur beim Anlegen Pflicht,
 * beim Aendern heisst leer „beibehalten".
 */

import { z } from "zod"
import type { StorageConnectionInput, StorageConnectionSummary } from "@/types/storage-connection"

export const connectionFormSchema = z.object({
  label: z.string().trim().min(1, "Bezeichnung fehlt."),
  type: z.enum(["nextcloud", "onedrive"]),
  webdavUrl: z.string().optional(),
  username: z.string().optional(),
  appPassword: z.string().optional(),
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
})

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>

type Feld = keyof ConnectionFormValues

/** Pflichtfelder je Typ; `secretRequired` nur beim Anlegen. */
function pflichtfelder(type: ConnectionFormValues["type"], secretRequired: boolean): Feld[] {
  if (type === "nextcloud") return ["webdavUrl", "username", ...(secretRequired ? (["appPassword"] as Feld[]) : [])]
  return ["tenantId", "clientId", ...(secretRequired ? (["clientSecret"] as Feld[]) : [])]
}

/** Fehlende Pflichtfelder als Liste (leer = alles da). */
export function fehlendePflichtfelder(values: ConnectionFormValues, secretRequired: boolean): Feld[] {
  return pflichtfelder(values.type, secretRequired).filter((feld) => (values[feld] ?? "").trim() === "")
}

/** Formularwerte einer bestehenden Verbindung (Geheimnisse bleiben leer). */
export function readConnectionForm(existing: StorageConnectionSummary | null): ConnectionFormValues {
  return {
    label: existing?.label ?? "",
    type: existing?.type ?? "nextcloud",
    webdavUrl: existing?.nextcloud?.webdavUrl ?? "",
    username: existing?.nextcloud?.username ?? "",
    appPassword: "",
    tenantId: existing?.onedrive?.tenantId ?? "",
    clientId: existing?.onedrive?.clientId ?? "",
    clientSecret: "",
  }
}

/** Eingabe fuer die API; nur die Felder des gewaehlten Typs, leere Geheimnisse weggelassen. */
export function toConnectionInput(values: ConnectionFormValues): StorageConnectionInput {
  const secret = (wert: string | undefined) => (wert && wert.trim() !== "" ? { [values.type === "nextcloud" ? "appPassword" : "clientSecret"]: wert.trim() } : {})
  if (values.type === "nextcloud") {
    return {
      label: values.label.trim(),
      type: "nextcloud",
      nextcloud: { webdavUrl: (values.webdavUrl ?? "").trim(), username: (values.username ?? "").trim(), ...secret(values.appPassword) },
    }
  }
  return {
    label: values.label.trim(),
    type: "onedrive",
    onedrive: { tenantId: (values.tenantId ?? "").trim(), clientId: (values.clientId ?? "").trim(), ...secret(values.clientSecret) },
  }
}
