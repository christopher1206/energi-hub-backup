import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch('http://192.168.1.253:1880/api/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Fejl ved override' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/override/status', {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ aktiv: false });
  }
}
