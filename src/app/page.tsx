import { SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">Common Knowledge Scout</h1>
        
        <div className="bg-muted rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Ihr digitaler Assistent für Dokumentenmanagement</h2>
          
          <p className="text-lg mb-6">
            Common Knowledge Scout ist ein modernes Dokumentenmanagementsystem, 
            das Ihnen hilft, Ihre Dokumente zu organisieren, zu durchsuchen und zu verwalten - 
            alles an einem Ort und mit einer einheitlichen Benutzeroberfläche.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignInButton mode="modal">
              <Button size="lg" className="font-medium">
                Anmelden
              </Button>
            </SignInButton>
            
            <Link href="/sign-up" passHref>
              <Button variant="outline" size="lg" className="font-medium">
                Konto erstellen
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-medium mb-3">Multi-Provider Storage</h3>
            <p>Verbinden Sie verschiedene Speicheranbieter wie lokale Dateien, SharePoint oder Google Drive.</p>
          </div>
          
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-medium mb-3">Erweiterte Dokumentenverwaltung</h3>
            <p>Organisieren Sie Ihre Dokumente hierarchisch und nutzen Sie Metadaten für bessere Strukturierung.</p>
          </div>
          
          <div className="bg-card p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-medium mb-3">Berechtigungsverwaltung</h3>
            <p>Kontrollieren Sie den Zugriff auf Dokumente mit feingranularen Benutzerberechtigungen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}