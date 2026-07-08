import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/discharge-status', { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      mode: 'ukendt', aarsag: '', solPrognoseKwh: 0, manglerTilFuldKwh: 0,
      solDaekkerResten: false, zone: '', pris: 0, soc: 0, time: 0, opdateret: null
    });
  }
}
