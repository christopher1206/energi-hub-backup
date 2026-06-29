import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/tesla/status', {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      soc: null,
      state: 'offline',
      odometer: null,
      fallback: true
    });
  }
}
