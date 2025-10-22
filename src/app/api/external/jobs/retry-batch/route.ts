import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'retry_batch_deprecated', message: 'Nutze die neue start-batch Route' },
    { status: 410 }
  )
}



