import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/vejr', {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ tekst: 'ukendt', tempMin: null, tempMax: null, skyer: null, solPotentiale: '' });
  }
}
