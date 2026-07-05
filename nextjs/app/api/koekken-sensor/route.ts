import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/koekken-sensor', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ temperature: null, humidity: null, battery: null, linkquality: null, timestamp: null });
  }
}
