import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/ladeplan', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ timer: [], manglerKwh: 0, timerNodvendige: 0, bilTilsluttet: false, carSoc: 0, deadline: null });
  }
}
