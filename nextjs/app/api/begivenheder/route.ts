import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/begivenheder', {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ naeste: [], sidst: [] });
  }
}
