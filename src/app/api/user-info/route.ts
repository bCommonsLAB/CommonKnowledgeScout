import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  // Authentifizierungsinformationen abrufen
  const { userId } = await auth();
  
  // Wenn kein Benutzer angemeldet ist, entsprechende Info zurückgeben
  if (!userId) {
    return NextResponse.json({
      isSignedIn: false,
      message: 'Nicht angemeldet'
    });
  }
  
  // Ausführliche Benutzerinformationen abrufen
  const user = await currentUser();
  
  // Erfolgreiche Antwort mit Benutzerinformationen
  return NextResponse.json({
    isSignedIn: true,
    userId,
    email: user?.emailAddresses.map(e => ({
      id: e.id,
      email: e.emailAddress,
      isPrimary: e.id === user.primaryEmailAddressId
    })),
    fullName: `${user?.firstName} ${user?.lastName}`,
    firstName: user?.firstName,
    lastName: user?.lastName,
    imageUrl: user?.imageUrl,
    // Zeit zum Überprüfen auf Caching-Probleme
    timestamp: new Date().toISOString()
  });
} 