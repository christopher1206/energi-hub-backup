import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/sol-prognose', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ timer: [], totalKwh: 0, restKwhTil16: 0, opdateret: null });
  }
}
