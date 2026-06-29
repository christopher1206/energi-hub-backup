import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/bil/soc', {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ soc: 50, opdateret: null });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch('http://192.168.1.253:1880/api/bil/soc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
