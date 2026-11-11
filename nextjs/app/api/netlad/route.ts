import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch('http://192.168.1.253:1880/api/netlad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json({ error: 'Fejl ved netopladning' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/netlad/status', { cache: 'no-store' });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ aktiv: false, status: 'slukket', valgte: [] });
  }
}
