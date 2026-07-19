/**
 * Seed-Skript: legt kuratierte `website`-Dokumente in der Library
 * „OldiesForFuture" an, damit der produktive detailViewType-`website`-Renderer
 * (Phase 1) + die Live-Landingpage (Phase 3) getestet werden koennen — ohne
 * Secretary/Import. Aktuell: Startseite (menu_order 1), Impressum
 * (menu_area footer, nur in der Website-Fusszeile verlinkt) und das
 * Footer-Doc (site_role footer-content, Sektionen unter jeder Seite — C1).
 *
 * Bewusst eigenstaendig: nutzt den `mongodb`-Treiber direkt + `.env` (dieselbe
 * DB wie der Dev-Server). Bild-URLs sind absolut (root-relativ, ueber die
 * vorhandene web/-Route der Quell-Library; spaeter Dokument-Medien, E4).
 *
 * Aufruf:  node --import tsx scripts/seed-website-doc.ts
 */

import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

dotenv.config()

// Ziel-Library + Collection sind per Env ueberschreibbar, damit derselbe Seed
// gegen die ECHTE Oldies-Library (5a28b4bd) statt der Cloud-Wegwerf-Library laufen kann.
// Defaults = urspruengliche Cloud-Werte (Rueckwaertskompatibilitaet).
const LIBRARY_ID = process.env.SEED_LIBRARY_ID || 'eec9f788-880a-41c5-a668-f325c4a0039b'
const COLLECTION = process.env.SEED_COLLECTION || 'doc_meta__dadf3a40-3e00-4f1d-993f-3d8af7ee5385'

// Bild-Basis: per Env ueberschreibbar. Default = auth-gegatete web/-Route
// (nur eingeloggt sichtbar). Mit SEED_IMG_BASE koennen oeffentliche Azure-Blob-URLs
// gesetzt werden, damit die Bilder ANONYM laden (siehe mirror-website-images-to-blob.ts).
const IMG = process.env.SEED_IMG_BASE || `/api/library/${LIBRARY_ID}/web/web/images`

const HOME_MARKDOWN = `
<!-- section layout=image-right bg=dark-green -->
## Wer sind wir?
![Gruppenfoto Oldies for Future](${IMG}/cover_gruppenbild1.jpg)

Wir „Oldies for Future" wollen uns mit den jungen Menschen solidarisieren und sie in ihren Anliegen und Forderungen nach einer lebenswerten Zukunft unterstützen.

Die Jugend findet mit ihren Zukunftsängsten bei unserer Generation der Verursacher dieser bedrohenden Entwicklung zu wenig Gehör. Wir möchten dabei nicht tatenlos zusehen und unseren Ruhestand genießen, sondern unsere Erfahrung und unser Engagement mit einbringen.
<!-- /section -->

<!-- section layout=video bg=neutral -->
https://player.vimeo.com/video/820810243?h=a82492eeeb
<!-- /section -->

<!-- section layout=image-left bg=linen -->
## Warum machen wir das?
![](${IMG}/oldies-for-future-warum_web.jpg)

Das gegebene kapitalistische Wirtschaftssystem weckt im Menschen unersättliche Bedürfnisse nach Konsum und Reichtum.

Dies kann nur durch grenzenloses Wachstum, Ausbeutung von menschlichen und natürlichen Ressourcen befriedigt werden. Das kritische Denken und das selbstverständliche Bewusstsein eines großen Ganzen werden von der Gesellschaft zu wenig gefördert. Wir leben in einem Teufelskreis von manipulativen Einflüssen, gedankenlosem Konsumwahn und Konkurrenzdenken.
<!-- /section -->

<!-- section layout=image-right bg=mint -->
## Was ist die Lösung?
![](${IMG}/oldies-for-future-loesung-2K_web.webp)

Es braucht ein neues Bewusstsein von einem gerechten Leben für alle im Einklang mit Umwelt und Natur.

Dem Menschen muss bewusst werden, dass er Teil der Natur ist und nicht über ihr steht. Ausgehend davon kann ein lebensfähiges Gesellschaftssystem entstehen, das allen sozialen, ökologischen und ökonomischen Anforderungen gerecht wird. Die dringendste und am schnellsten umzusetzenden Maßnahmen sind der Ausstieg aus den fossilen Energieträgern und der Erhalt der Biodiversität. Wir wollen in unserer Generation mehr Bewusstsein für die Zukunft unserer Kinder in einer l(i)ebenswerten Umwelt schaffen und unseren Respekt dadurch zeigen, indem wir jetzt aktiv werden und handeln.
<!-- /section -->

<!-- section layout=image-left bg=default -->
## Was können wir gemeinsam machen?
![](${IMG}/oldies-for-future-gemeinsamaktiv_web.jpg)

Wir wollen der Jugend zeigen, dass wir ihre Anliegen verstehen.

Indem wir bei ihren Aktionen mit ihnen gehen und so den Druck auf die Politik und andere VerantwortungsträgerInnen verstärken.
<!-- /section -->

<!-- section layout=text-only bg=mint -->
## Alle sind aufgerufen Ihren Beitrag zu leisten!

Jeder kann aktiv werden und sich in seiner Umgebung engagieren und andere Menschen informieren und sensibilisieren! Gemeinsam organisieren wir dringend notwendige Aktionen!
<!-- /section -->

<!-- section layout=text-only bg=mint -->
> Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.
> — Marie von Ebner-Eschenbach
<!-- /section -->
`.trim()

const IMPRESSUM_MARKDOWN = `
<!-- section layout=text-only bg=light -->
## Verantwortlich für den Inhalt

Verein OLDIES FOR FUTURE

Vorsitzender: Klauspeter Dissinger

Rienzdamm 20, I-39042 Brixen, Südtirol / Italien

E-Mail: info@oldiesforfuture.org

Steuer- und MwSt-Nr.: 92074960219

## Webdesign

Studio Gavari, Via Ponte alle Riffe 10R, 50133 Florenz, Italien — www.studiogavari.com

Alle Informationen und Erklärungen dieser Internetseiten sind unverbindlich. Der Verein „Oldies for Future" übernimmt für die Richtigkeit und Vollständigkeit der Inhalte keine Gewähr. Es wird keine Garantie übernommen und keine Zusicherung von Produkteigenschaften gemacht. Aus den Inhalten der Internetseiten ergeben sich keine Rechtsansprüche. Fehler im Inhalt werden bei Kenntnis darüber unverzüglich korrigiert. Die Inhalte der Internetseiten können durch zeitverzögerte Aktualisierung nicht permanent aktuell sein. Bitte fragen Sie uns daher zu dem Stand und technischen Details. Links auf andere Internetseiten werden nicht permanent kontrolliert. Somit übernehmen wir keine Verantwortung für den Inhalt verlinkter Seiten.
<!-- /section -->

<!-- section layout=text-only bg=default -->
## Urheberrechte und sonstige Sonderschutzrechte

Der Inhalt dieser Internetseiten ist urheberrechtlich geschützt. Es darf eine Kopie der Informationen der Internetseiten auf einem einzigen Computer für den nicht kommerziellen und persönlichen internen Gebrauch gespeichert werden. Grafiken, Texte, Logos, Bilder usw. dürfen nur nach schriftlicher Genehmigung durch den Verein „Oldies for Future" heruntergeladen, vervielfältigt, kopiert, geändert, veröffentlicht, versendet, übertragen oder in sonstiger Form genutzt werden. Bei genannten Produkt- und Firmennamen kann es sich um eingetragene Warenzeichen oder Marken handeln. Die unberechtigte Verwendung kann zu Schadensersatzansprüchen und Unterlassungsansprüchen führen.

## Schutz persönlicher Daten und Vertraulichkeit

Es kann nicht garantiert werden, dass Informationen oder persönliche Daten, die uns übermittelt werden, bei der Übermittlung nicht von Dritten „abgehört" werden.

## Haftungsausschluss

Der Verein „Oldies for Future" haftet nicht für Schäden insbesondere nicht für unmittelbare oder mittelbare Folgeschäden, Datenverlust, entgangenen Gewinn, System- oder Produktionsausfälle, die durch die Nutzung dieser Internetseiten oder das Herunterladen von Daten entstehen. Die durch die Nutzung der Internetseiten entstandene Rechtsbeziehung zwischen Ihnen und dem Verein „Oldies for Future" unterliegt dem Recht der Republik Italien. Bei Rechtsstreitigkeiten, die aus der Nutzung dieser Internetseiten resultieren, ist der Gerichtsstandort Bozen.
<!-- /section -->

<!-- section layout=text-only bg=light -->
## Rechtlicher Hinweis zu Beiträgen und Kommentaren

Beiträge und Kommentare müssen frei von Beleidigungen, Diskriminierungen und Obszönitäten jeglicher Art sein. Für diese Kommentare ist ausschließlich der Verfasser rechtlich verantwortlich und der Betreiber übernimmt keine Haftung für die Inhalte. Kommentare, die diese Vorschriften verletzen, werden umgehend gelöscht.

## Rechtlicher Hinweis zu Hyperlinks

Wir machen uns den Inhalt verlinkter bzw. empfohlener Webseiten nicht zu eigen und übernehmen für etwaige Rechtsverstöße auf diesen Seiten keine Haftung. Der Autor erklärt daher ausdrücklich, dass zum Zeitpunkt der Verlinkung die entsprechenden Websites frei von illegalen Inhalten waren. Der Autor hat keinerlei Einfluss auf die aktuelle und zukünftige Gestaltung und auf die Inhalte der empfohlenen Websites und nützlichen Links.
<!-- /section -->

<!-- section layout=text-only bg=default -->
## Erläuterungen zum Datenschutz — Sicherheit

Der Verein „Oldies for Future" speichert Ihre Daten auf besonders geschützten Servern in Deutschland. Der Zugriff darauf ist nur wenigen, vom Verein „Oldies for Future" befugten Personen möglich, die mit der technischen, kaufmännischen oder redaktionellen Betreuung dieser Server befasst sind.

## Werbung

Die Webseiten des Vereins „Oldies for Future" enthalten im Regelfall keine Werbeflächen. Im gegenteiligen Fall erfolgt die Auslieferung der Werbung über externe AdServer. Die im Zusammenhang mit Onlinewerbung erfassten Daten (AdImpressions, AdKlicks) dienen ausschließlich der statistischen Auswertung und zur Erstellung von Reportings an Werbekunden. Dabei werden keine personenbezogenen Daten verwendet. Bei der Auslieferung von Werbung können möglicherweise Cookies zum Einsatz kommen, ohne dass der Verein „Oldies for Future" hierauf Einfluss hat.
<!-- /section -->
`.trim()

const KONTAKT_MARKDOWN = `
<!-- section layout=contact-form bg=mint -->
## Jetzt mitmachen

Wir informieren dich regelmäßig über unsere Aktionen. Bringe deine Ideen mit ein!
<!-- /section -->
`.trim()

const FOOTER_MARKDOWN = `
<!-- section layout=text-only bg=dark-green -->
## #oldiesforfuture

Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.

Verein OLDIES FOR FUTURE — Rienzdamm 20, I-39042 Brixen

E-Mail: info@oldiesforfuture.org
<!-- /section -->
`.trim()

/** Meta-Dokument-Form (String-_id wie im Vector-Repo, nicht ObjectId). */
interface WebsiteMetaDoc {
  _id: string
  kind: 'meta'
  libraryId: string
  fileId: string
  fileName: string
  detailViewType: string
  title: string
  year: number
  upsertedAt: string
  docMetaJson: Record<string, unknown>
}

interface SeedDoc {
  fileId: string
  fileName: string
  docMetaJson: Record<string, unknown>
}

const DOCS: SeedDoc[] = [
  {
    fileId: 'website-oldies-home',
    fileName: 'Oldies for Future.md',
    docMetaJson: {
      detailViewType: 'website',
      title: 'Oldies for Future',
      hero_subtitle:
        'Wir solidarisieren uns mit jungen Menschen für eine lebenswerte Zukunft – und werden gemeinsam aktiv.',
      // Cover-Hero (Vorlage): grosser gestapelter Titel + kleineres, ueberlagertes Bild.
      hero_layout: 'cover',
      hero_image: `${IMG}/oldies-for-future-headimage-2_web.jpg`,
      hero_image_alt: '2 Hände',
      coverImageUrl: `${IMG}/oldies-for-future-headimage-2_web.jpg`,
      // Video liegt jetzt als eigene Sektion (layout=video) im Body — an der
      // richtigen Position nach „Wer sind wir?" statt am Seitenende.
      cta_label: 'Jetzt mitmachen',
      // C3: CTA zeigt auf die Kontakt-Seite (Website-Deep-Link, C1).
      cta_url: '?site=kontakt',
      menu_order: 1,
      prioritaets_index: 90,
      language: 'de',
      targetLanguage: 'de',
      source_url: 'https://oldiesforfuture.it',
      docType: 'website',
      markdown: HOME_MARKDOWN,
    },
  },
  {
    fileId: 'website-oldies-impressum',
    fileName: 'Impressum.md',
    docMetaJson: {
      detailViewType: 'website',
      title: 'Impressum',
      hero_subtitle: 'Rechtliche Informationen & Datenschutz',
      menu_order: 2,
      // C1: Impressum verschwindet aus dem Top-Menue und wird nur noch in der
      // Website-Fusszeile verlinkt (?site=impressum, stabiler Slug).
      menu_area: 'footer',
      slug: 'impressum',
      language: 'de',
      targetLanguage: 'de',
      source_url: 'https://oldiesforfuture.org/impressum',
      docType: 'website',
      markdown: IMPRESSUM_MARKDOWN,
    },
  },
  {
    fileId: 'website-oldies-kontakt',
    fileName: 'Kontakt.md',
    docMetaJson: {
      detailViewType: 'website',
      title: 'Kontakt',
      hero_subtitle:
        'Wir informieren dich regelmäßig über unsere Aktionen. Bringe deine Ideen mit ein!',
      // C3: letzter Menuepunkt (hoher menu_order); stabiler Slug fuer ?site=kontakt.
      menu_order: 8,
      slug: 'kontakt',
      // Empfaenger des Kontakt-Formulars (dokumentgetrieben, oeffentlich
      // sichtbar wie die Impressums-Adresse — Entscheidung Analyse §2.4).
      contact_email: 'info@oldiesforfuture.org',
      language: 'de',
      targetLanguage: 'de',
      source_url: 'https://oldiesforfuture.org/kontakt',
      docType: 'website',
      markdown: KONTAKT_MARKDOWN,
    },
  },
  {
    fileId: 'website-oldies-footer',
    fileName: 'Footer.md',
    docMetaJson: {
      detailViewType: 'website',
      title: '#oldiesforfuture',
      // C1: Footer-Content-Doc — Sektionen werden als Website-Fusszeile unter
      // JEDER Seite gerendert; taucht selbst in keinem Menue auf.
      site_role: 'footer-content',
      menu_area: 'hidden',
      menu_order: 99,
      language: 'de',
      targetLanguage: 'de',
      docType: 'website',
      markdown: FOOTER_MARKDOWN,
    },
  },
]

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  if (!uri) throw new Error('MONGODB_URI fehlt (.env nicht geladen?)')
  if (!dbName) throw new Error('MONGODB_DATABASE_NAME fehlt')

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const col = client.db(dbName).collection<WebsiteMetaDoc>(COLLECTION)
    const now = new Date().toISOString()

    for (const d of DOCS) {
      const metaDoc: WebsiteMetaDoc = {
        _id: `${d.fileId}-meta`,
        kind: 'meta',
        libraryId: LIBRARY_ID,
        fileId: d.fileId,
        fileName: d.fileName,
        // Top-Level fuer Facetten/Sort/Type-Filter (distinctViewTypes coalesct beides).
        detailViewType: 'website',
        title: String(d.docMetaJson.title ?? d.fileId),
        year: 2026,
        upsertedAt: now,
        docMetaJson: d.docMetaJson,
      }
      // _id nicht in $set (immutable) — kommt beim Upsert-Insert aus dem Filter.
      const { _id, ...fields } = metaDoc
      const res = await col.updateOne({ _id }, { $set: fields }, { upsert: true })
      console.log(
        `[seed-website-doc] ${d.fileId}: matched=${res.matchedCount} upserted=${res.upsertedId ? 'ja' : 'nein'} modified=${res.modifiedCount}`,
      )
    }
    console.log(`[seed-website-doc] DB=${dbName} Collection=${COLLECTION} — ${DOCS.length} Dok(e) verarbeitet.`)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('[seed-website-doc] FEHLER:', err instanceof Error ? err.message : err)
  process.exit(1)
})
