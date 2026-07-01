import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';

async function queryInflux(flux: string) {
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
  return res.text();
}

function parseCSV(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(l => !l.startsWith('#') && l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periode = searchParams.get('periode') || '24h';
  const felt = searchParams.get('felt') || 'sol_power';
  try {
    const flux = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -${periode})
  |> filter(fn: (r) => r._measurement == "energi")
  |> filter(fn: (r) => r._field == "${felt}")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> yield(name: "mean")
`;
    const csv = await queryInflux(flux);
    const data = parseCSV(csv);
    const punkter = data.map(r => ({
      tid: r._time,
      vaerdi: parseFloat(r._value) || 0,
    }));
    return NextResponse.json(punkter);
  } catch {
    return NextResponse.json([]);
  }
}
