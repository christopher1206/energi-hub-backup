import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';

export async function GET() {
  try {
    const flux = `
from(bucket: "energi2")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "events")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 100)
`;
    const res = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
      },
      body: flux,
      cache: 'no-store',
    });

    const csv = await res.text();
    if (!res.ok) return NextResponse.json([]);

    // Fix: brug /\r?\n/ og trim kolonner for at håndtere Windows-linjeskift
    const lines = csv.trim().split(/\r?\n/).filter(l => !l.startsWith('#') && l.trim());
    if (lines.length < 2) return NextResponse.json([]);

    const headers = lines[0].split(',').map(h => h.trim());
    const events = lines.slice(1)
      .map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        return {
          tid: obj['_time'],
          type: obj['type'],
          beskrivelse: obj['_value'],
        };
      })
      .filter(e => e.tid && e.beskrivelse); // fjern tomme rækker

    return NextResponse.json(events);
  } catch {
    return NextResponse.json([]);
  }
}
