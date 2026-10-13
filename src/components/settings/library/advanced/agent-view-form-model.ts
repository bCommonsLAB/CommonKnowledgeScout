/**
 * Formular-Modell der Seite Erweitert · Agentensicht (reine Funktionen).
 *
 * Besitzt genau einen Config-Schluessel: `agentView`. Schema, Lesen aus der
 * Library-Config und Schreiben in die Config liegen beisammen, damit die
 * fuenf Stellen aus library-config-field.md fuer dieses Teil-Formular an
 * EINEM Ort stehen. Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles).
 */

import { z } from "zod"
import type { LibraryConfigPatch } from "./use-library-config-patch"

/** Optionale Schwelle als Formular-String: leer = Regel aus, sonst ganze Zahl >= 1 mit hoechstens `stellen` Ziffern. */
function schwellenFeld(stellen: number) {
  return z
    .string()
    .refine((wert) => wert.trim() === "" || (/^[1-9][0-9]*$/.test(wert.trim()) && wert.trim().length <= stellen), {
      message: "Ganze Zahl ab 1 oder leer (Regel aus)",
    })
    .default("")
}

export const agentViewFormSchema = z.object({
  agentViewEnabled: z.boolean().default(false),
  // Das Muster wird clientseitig als Regex validiert — sonst wirft erst der Scan (laut, aber spaet).
  agentViewVorhabenPattern: z
    .string()
    .default("")
    .refine((value) => {
      if (value.trim() === "") return true
      try {
        new RegExp(value)
        return true
      } catch {
        return false
      }
    }, "Kein gueltiger regulaerer Ausdruck."),
  // Tiefe als String (leer = Regel inaktiv); nur ganze Zahlen >= 0.
  agentViewIndexDepth: z
    .string()
    .default("")
    .refine((value) => value.trim() === "" || /^\d+$/.test(value.trim()), "Ganze Zahl (0, 1, 2, ...) oder leer."),
  agentViewBerichtFreshness: z.boolean().default(true),
  // A7b: leer = Regel aus; als String, damit „leer" und „0" unterscheidbar bleiben.
  agentViewPostfachMaxWochen: z
    .string()
    .refine(
      (wert) => wert.trim() === "" || (/^\d{1,2}$/.test(wert.trim()) && Number(wert.trim()) <= 52),
      { message: "Ganze Zahl 0–52 oder leer (Regel aus)" },
    )
    .default(""),
  // Wunschliste 5, C1: leer = Regel aus; Tage als String.
  agentViewRepoMaxTage: z
    .string()
    .refine(
      (wert) => wert.trim() === "" || (/^\d{1,3}$/.test(wert.trim()) && Number(wert.trim()) <= 365),
      { message: "Ganze Zahl 0–365 oder leer (Regel aus)" },
    )
    .default(""),
  // Wunschliste 6, A1–A3: leer = Regel aus.
  agentViewBerichtMaxBytesAnwendung: schwellenFeld(7),
  agentViewBerichtMaxBytesPlattform: schwellenFeld(7),
  agentViewStatusMaxZeilen: schwellenFeld(3),
  agentViewUeberholtNachTagen: schwellenFeld(3),
  agentViewLocalRootPath: z.string().default(""),
  // A6: Themen-Vokabular — eine Zeile pro Thema (Persistenz als Array).
  agentViewThemen: z
    .string()
    .default("")
    .refine((value) => !/[,\[\]]/.test(value), "Ein Thema darf kein Komma und keine eckigen Klammern enthalten."),
})

export type AgentViewFormValues = z.infer<typeof agentViewFormSchema>

type AgentViewConfig = NonNullable<LibraryConfigPatch["agentView"]>

const zahlText = (wert: unknown): string =>
  typeof wert === "number" && Number.isFinite(wert) ? String(wert) : ""

/**
 * Liest die Agentensicht-Konventionen einer Library in die Formularwerte.
 * EINE Stelle fuer alle reset-Sites — fehlende Werte fallen sichtbar auf die
 * dokumentierten Defaults (Agentensicht ist Opt-in, Pilot-Entscheid 2026-08-21).
 */
export function readAgentViewForm(config: LibraryConfigPatch | undefined): AgentViewFormValues {
  const agentView: AgentViewConfig | undefined = config?.agentView
  return {
    agentViewEnabled: agentView?.enabled === true,
    agentViewVorhabenPattern: typeof agentView?.vorhabenFolderPattern === "string" ? agentView.vorhabenFolderPattern : "",
    agentViewIndexDepth: zahlText(agentView?.indexRequiredMaxDepth),
    agentViewBerichtFreshness: agentView?.berichtFreshness !== false,
    agentViewPostfachMaxWochen: zahlText(agentView?.postfachMaxRueckstandWochen),
    agentViewRepoMaxTage: zahlText(agentView?.repoMaxRueckstandTage),
    agentViewBerichtMaxBytesAnwendung: zahlText(agentView?.berichtMaxBytes?.anwendung),
    agentViewBerichtMaxBytesPlattform: zahlText(agentView?.berichtMaxBytes?.plattform),
    agentViewStatusMaxZeilen: zahlText(agentView?.statusMaxZeilen),
    agentViewUeberholtNachTagen: zahlText(agentView?.ueberholtNachTagen),
    agentViewLocalRootPath: typeof agentView?.localRootPath === "string" ? agentView.localRootPath : "",
    agentViewThemen: Array.isArray(agentView?.themen)
      ? agentView.themen.filter((thema): thema is string => typeof thema === "string").join("\n")
      : "",
  }
}

const zahlOderNichts = (wert: string): number | undefined =>
  wert.trim() === "" ? undefined : Number(wert.trim())

/** Schreibt die Formularwerte als vollstaendiges `agentView`-Objekt (Config-Schluessel dieser Seite). */
export function toAgentViewConfig(data: AgentViewFormValues): Pick<LibraryConfigPatch, "agentView"> {
  const indexDepth = zahlOderNichts(data.agentViewIndexDepth)
  const postfach = zahlOderNichts(data.agentViewPostfachMaxWochen)
  const repo = zahlOderNichts(data.agentViewRepoMaxTage)
  const statusZeilen = zahlOderNichts(data.agentViewStatusMaxZeilen)
  const ueberholt = zahlOderNichts(data.agentViewUeberholtNachTagen)
  const localRoot = data.agentViewLocalRootPath.trim()
  const pattern = data.agentViewVorhabenPattern.trim()
  return {
    agentView: {
      enabled: data.agentViewEnabled,
      ...(pattern !== "" ? { vorhabenFolderPattern: pattern } : {}),
      ...(indexDepth !== undefined ? { indexRequiredMaxDepth: indexDepth } : {}),
      berichtFreshness: data.agentViewBerichtFreshness,
      ...(postfach !== undefined ? { postfachMaxRueckstandWochen: postfach } : {}),
      ...(repo !== undefined ? { repoMaxRueckstandTage: repo } : {}),
      // Wunschliste 6, A1: je Rolle; leer = null = Regel fuer diese Rolle aus.
      berichtMaxBytes: {
        anwendung: zahlOderNichts(data.agentViewBerichtMaxBytesAnwendung) ?? null,
        plattform: zahlOderNichts(data.agentViewBerichtMaxBytesPlattform) ?? null,
      },
      ...(statusZeilen !== undefined ? { statusMaxZeilen: statusZeilen } : {}),
      ...(ueberholt !== undefined ? { ueberholtNachTagen: ueberholt } : {}),
      ...(localRoot !== "" ? { localRootPath: localRoot } : {}),
      themen: data.agentViewThemen.split(/\r?\n/).map((thema) => thema.trim()).filter(Boolean),
    },
  }
}
