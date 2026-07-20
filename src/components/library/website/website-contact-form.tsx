"use client"

/**
 * Kontakt-Formular-Sektion (Phase C3, Sektions-Layout `contact-form`).
 *
 * Felder wie die Webflow-Vorlage: Name*, Nachname, Email*, Nachricht,
 * Newsletter-Checkbox, Privacy-Checkbox* + Honeypot. Versand ueber die
 * oeffentliche Contact-API (`POST /api/public/libraries/[slug]/contact`);
 * die Empfaenger-Adresse liest die API serverseitig aus dem Kontakt-Doc
 * (`contact_email`). Fehlt `contact_email` oder der Library-Slug, ist das
 * Formular deaktiviert mit klarem Hinweis (kein stiller Fallback).
 */

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { renderMarkdownText } from "@/components/library/website/website-landing-blocks"
import type { WebsiteSection } from "@/lib/website/types"

const contactFormSchema = z.object({
  name: z.string().min(1, "Bitte geben Sie Ihren Namen ein."),
  lastName: z.string().optional(),
  email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  message: z.string().optional(),
  newsletter: z.boolean().default(false),
  privacy: z.literal(true, {
    errorMap: () => ({ message: "Bitte stimmen Sie der Datenschutzerklärung zu." }),
  }),
  // Honeypot: bleibt bei Menschen leer (Feld ist unsichtbar).
  website: z.string().optional(),
})

type ContactFormValues = z.infer<typeof contactFormSchema>

interface WebsiteContactFormSectionProps {
  section: WebsiteSection
  /** Slug der Library fuer die Contact-API (null = unbekannt -> deaktiviert). */
  librarySlug: string | null
  /** fileId des Docs, aus dem die API `contact_email` liest. */
  fileId?: string
  /** `contact_email` aus dem Frontmatter (nur fuer die Aktiv/Inaktiv-Anzeige). */
  contactEmail?: string
}

const INPUT_CLASS =
  "w-full rounded-md border border-black/20 bg-white/90 px-3 py-2 text-sm text-black placeholder:text-black/50 focus:outline-none focus:ring-2 focus:ring-emerald-600"

export function WebsiteContactFormSection({
  section,
  librarySlug,
  fileId,
  contactEmail,
}: WebsiteContactFormSectionProps): React.ReactElement {
  const [status, setStatus] = React.useState<"idle" | "sending" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", lastName: "", email: "", message: "", newsletter: false, website: "" },
  })

  const isConfigured = Boolean(contactEmail) && Boolean(librarySlug) && Boolean(fileId)

  async function onSubmit(values: ContactFormValues): Promise<void> {
    if (!isConfigured || !librarySlug || !fileId) return
    setStatus("sending")
    setErrorMessage(null)
    try {
      const res = await fetch(
        `/api/public/libraries/${encodeURIComponent(librarySlug)}/contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, fileId }),
        },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Senden fehlgeschlagen")
      }
      setStatus("success")
      form.reset()
    } catch (e) {
      setStatus("error")
      setErrorMessage(e instanceof Error ? e.message : "Senden fehlgeschlagen")
    }
  }

  const { errors } = form.formState

  return (
    <section className="bg-[#6fc5ae] px-6 py-14 text-[#0b3a30]">
      <div className="mx-auto max-w-2xl">
        {section.markdown && (
          <div className="mb-8">{renderMarkdownText(section.markdown, "mint")}</div>
        )}

        {!isConfigured ? (
          <p className="rounded-md border border-black/20 bg-white/70 p-4 text-sm">
            Das Kontaktformular ist nicht konfiguriert (Frontmatter-Feld{" "}
            <code>contact_email</code> fehlt oder Seite ohne Library-Kontext).
          </p>
        ) : status === "success" ? (
          <p className="rounded-md bg-white/80 p-4 text-sm font-medium">
            Vielen Dank! Deine Nachricht wurde gesendet.
          </p>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="mb-1 block text-sm font-medium">Name *</label>
                <input id="contact-name" className={INPUT_CLASS} {...form.register("name")} />
                {errors.name && <p className="mt-1 text-xs text-red-800">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="contact-lastname" className="mb-1 block text-sm font-medium">Nachname</label>
                <input id="contact-lastname" className={INPUT_CLASS} {...form.register("lastName")} />
              </div>
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1 block text-sm font-medium">Email *</label>
              <input id="contact-email" type="email" className={INPUT_CLASS} {...form.register("email")} />
              {errors.email && <p className="mt-1 text-xs text-red-800">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-1 block text-sm font-medium">Nachricht</label>
              <textarea id="contact-message" rows={5} className={INPUT_CLASS} {...form.register("message")} />
            </div>
            {/* Honeypot: fuer Menschen unsichtbar, Bots fuellen es aus. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...form.register("newsletter")} />
              <span>Ich möchte den Newsletter erhalten.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...form.register("privacy")} />
              <span>Ich stimme der Datenschutzerklärung zu. *</span>
            </label>
            {errors.privacy && <p className="text-xs text-red-800">{errors.privacy.message}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-full bg-emerald-700 px-8 py-3 font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {status === "sending" ? "wird gesendet …" : "senden"}
            </button>
            {status === "error" && (
              <p className="text-sm font-medium text-red-800">
                {errorMessage ?? "Beim Senden ist ein Fehler aufgetreten. Bitte später erneut versuchen."}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
