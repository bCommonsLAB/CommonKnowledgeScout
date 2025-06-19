import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="de">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background text-foreground">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404 - Seite nicht gefunden</h1>
            <p className="text-lg mb-4">Die angeforderte Seite konnte nicht gefunden werden.</p>
            <Link 
              href="/"
              className="text-blue-500 hover:text-blue-700 underline"
            >
              Zurück zur Startseite
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
} 