import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  // Authentifizierungsinformationen abrufen
  const { userId } = await auth();
  
  // Wenn kein Benutzer angemeldet ist, 401 zurückgeben
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // Ausführliche Benutzerinformationen abrufen
  const user = await currentUser();
  
  // Erfolgreiche Antwort mit Benutzerinformationen
  return NextResponse.json({
    message: 'Authentifizierter Endpunkt',
    userId,
    user: {
      id: user?.id,
      email: user?.emailAddresses[0]?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName,
      imageUrl: user?.imageUrl
    }
  });
} 