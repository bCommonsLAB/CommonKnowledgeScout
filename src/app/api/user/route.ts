import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();
  
  // Wenn kein Benutzer angemeldet ist, 401 Unauthorized zurückgeben
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  
  // Holt alle Details des aktuellen Benutzers
  const user = await currentUser();
  
  // Gibt nur die notwendigen Informationen zurück (sicherer)
  return NextResponse.json({
    id: user?.id,
    firstName: user?.firstName,
    lastName: user?.lastName,
    emailAddresses: user?.emailAddresses,
    imageUrl: user?.imageUrl
  });
} 