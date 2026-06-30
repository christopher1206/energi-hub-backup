import { NextResponse } from 'next/server';

const INFLUX_URL = 'http://192.168.1.253:8086';
const INFLUX_TOKEN = 'Token A-Dni7i_eROyYjhmdcxTc8lLce2gXNzOldul2k2sWY-HMkqZVcE8U9_XvjNqSg4z_0QfbWq6nnTEHCEjtF1K9w==';
const INFLUX_ORG = 'energihub';
const INFLUX_BUCKET = 'energi2';

async function queryInflux(flux: string) {
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
  return res.text();
}

function parseCSV(csv: string) {
  const lines = csv.trim().split('\n').filter(l => !l.startsWith('#') && l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim() || '');
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
  } catch (error) {
    return NextResponse.json([]);
  }
}
