import { NextRequest, NextResponse } from 'next/server';

const SECRETARY_API_URL = process.env.SECRETARY_API_URL || 'http://127.0.0.1:5001/api';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const response = await fetch(`${SECRETARY_API_URL}/process-audio`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Fehler beim Transformieren der Audio-Datei' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Secretary Service Error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 