import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🚀 TEST-ROUTE: GET request received');
  console.warn('🚀 TEST-ROUTE: GET request received (warn)');
  console.error('🚀 TEST-ROUTE: GET request received (error)');
  
  return NextResponse.json({
    message: 'Test route is working!',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method
  });
}

export async function POST(request: NextRequest) {
  console.log('🚀 TEST-ROUTE: POST request received');
  
  const body = await request.json().catch(() => null);
  
  return NextResponse.json({
    message: 'POST received',
    body,
    timestamp: new Date().toISOString()
  });
} 