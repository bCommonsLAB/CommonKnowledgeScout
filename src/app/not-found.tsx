import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="de">
      <head>
        <title>404 - Seite nicht gefunden | Knowledge Scout</title>
        <meta name="description" content="Die angeforderte Seite konnte nicht gefunden werden." />
        <style>{`
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
          }
          h1 {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 1rem;
            color: #1e293b;
          }
          p {
            font-size: 1.125rem;
            margin-bottom: 2rem;
            color: #64748b;
          }
          a {
            color: #3b82f6;
            text-decoration: underline;
            font-weight: 500;
          }
          a:hover {
            color: #1d4ed8;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h1>404 - Seite nicht gefunden</h1>
          <p>Die angeforderte Seite konnte nicht gefunden werden.</p>
          <Link href="/">
            Zurück zur Startseite
          </Link>
        </div>
      </body>
    </html>
  );
} 