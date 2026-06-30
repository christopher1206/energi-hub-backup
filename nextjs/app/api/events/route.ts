import { NextResponse } from 'next/server';

const INFLUX_URL = 'http://192.168.1.253:8086';
const INFLUX_TOKEN = 'Token A-Dni7i_eROyYjhmdcxTc8lLce2gXNzOldul2k2sWY-HMkqZVcE8U9_XvjNqSg4z_0QfbWq6nnTEHCEjtF1K9w==';
const INFLUX_ORG = 'energihub';

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
        'Authorization': INFLUX_TOKEN,
        'Content-Type': 'application/vnd.flux',
        'Accept': 'application/csv',
      },
      body: flux,
      cache: 'no-store',
    });

    const csv = await res.text();
    const lines = csv.trim().split('\n').filter(l => !l.startsWith('#') && l.trim());
    if (lines.length < 2) return NextResponse.json([]);

    const headers = lines[0].split(',');
    const events = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
      return {
        tid: obj['_time'],
        type: obj['type'],
        beskrivelse: obj['_value'],
      };
    });

    return NextResponse.json(events);
  } catch {
    return NextResponse.json([]);
  }
}
