import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

async function fluxQuery(flux: string): Promise<number> {
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
  if (lines.length < 2) return 0;
  const header = lines[0].split(',').map(c => c.trim());
  const valIdx = header.indexOf('_value');
  const row = lines[1].split(',').map(c => c.trim());
  const v = parseFloat(row[valIdx]);
  return isNaN(v) ? 0 : v;
}

export async function GET() {
  try {
    // Tab = eksporteret effekt (kW) × spotpris, KUN i timer hvor spotpris er negativ.
    // Resultatet er selv negativt (et tab), da vi reelt betaler for at sælge.
    const flux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: today())
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "grid_power" or r._field == "spotpris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.grid_power and r.grid_power < 0.0 and exists r.spotpris and r.spotpris < 0.0 then (-r.grid_power / 1000.0 * r.spotpris) else 0.0) }))
        |> integral(unit: 1h, column: "_value")
    `;
    const tabKr = await fluxQuery(flux);
    return NextResponse.json({ tabKr: parseFloat(tabKr.toFixed(2)), timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ tabKr: 0, timestamp: new Date().toISOString() });
  }
}
