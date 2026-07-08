import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

export async function GET() {
  try {
    const flux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: today())
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "sol_power")
        |> group()
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false, timeSrc: "_start")
        |> map(fn: (r) => ({ r with _value: r._value / 1000.0 }))
    `;
    const res = await fetch(`${INFLUX_URL}/api/v2/query?org=${INFLUX_ORG}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/vnd.flux',
        Accept: 'application/csv',
      },
      body: flux,
      cache: 'no-store',
    });
    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
    const timer: { time: string; kwh: number }[] = [];

    if (lines.length >= 2) {
      const header = lines[0].split(',').map(c => c.trim());
      const tidIdx = header.indexOf('_time');
      const valIdx = header.indexOf('_value');
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (tidIdx !== -1 && valIdx !== -1 && cols[tidIdx] && cols[valIdx]) {
          timer.push({ time: cols[tidIdx], kwh: parseFloat(parseFloat(cols[valIdx]).toFixed(2)) });
        }
      }
    }

    return NextResponse.json({ timer, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ timer: [], timestamp: new Date().toISOString() });
  }
}
