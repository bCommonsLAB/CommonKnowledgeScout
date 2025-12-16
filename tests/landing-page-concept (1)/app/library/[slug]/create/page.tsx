export default function CreateContentPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Content erstellen</h1>
          <p className="text-muted-foreground">
            Füge neue Events, Testimonials oder Job-Angebote zur Wissensbibliothek hinzu
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Event Card */}
          <a
            href={`/library/${params.slug}/create/event`}
            className="group block p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Event erfassen</h3>
                <p className="text-sm text-muted-foreground">
                  Erfasse strukturierte Event-Informationen durch Sprechen, Text oder von einer Webseite
                </p>
              </div>
            </div>
          </a>

          {/* Testimonial Card */}
          <a
            href={`/library/${params.slug}/create/testimonial`}
            className="group block p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Testimonial erfassen</h3>
                <p className="text-sm text-muted-foreground">
                  Teile persönliche Eindrücke und Erkenntnisse aus einem Event oder Dokument
                </p>
              </div>
            </div>
          </a>

          {/* Job Offer Card */}
          <a
            href={`/library/${params.slug}/create/job`}
            className="group block p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">Job-Angebot erfassen</h3>
                <p className="text-sm text-muted-foreground">
                  Stelle ein Job-Angebot durch Sprechen, Text oder von einer Webseite ein
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
