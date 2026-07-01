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

export async function GET() {
  try {
    const energiFlux = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -2m)
  |> filter(fn: (r) => r._measurement == "energi")
  |> last()
`;

    const prisFlux = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -2m)
  |> filter(fn: (r) => r._measurement == "strompris")
  |> last()
`;

    const [energiCSV, prisCSV] = await Promise.all([
      queryInflux(energiFlux),
      queryInflux(prisFlux),
    ]);

    const energiData = parseCSV(energiCSV);
    const prisData = parseCSV(prisCSV);

    const getValue = (data: Record<string, string>[], field: string) => {
      const row = data.find(r => r._field === field);
      return row ? parseFloat(row._value) : 0;
    };

    const getTag = (data: Record<string, string>[], tag: string) => {
      const row = data[0];
      return row ? row[tag] || '' : '';
    };

    return NextResponse.json({
      batteri_soc: getValue(energiData, 'batteri_soc'),
      sol_power: getValue(energiData, 'sol_power'),
      grid_power: getValue(energiData, 'grid_power'),
      batteri_power: getValue(energiData, 'batteri_power'),
      batteri_temp: getValue(energiData, 'batteri_temp'),
      discharge_rate: getValue(energiData, 'discharge_rate'),
      tesla_lad: getValue(energiData, 'tesla_lad'),
      tesla_amp: getValue(energiData, 'tesla_amp'),
      load_power: getValue(energiData, 'load_power'),
      pris: getValue(energiData, 'pris'),
      spotpris: getValue(energiData, 'spotpris'),
      zone: getTag(energiData, 'zone'),
      growatt_mode: getTag(energiData, 'growatt_mode'),
      pris_zone: getTag(prisData, 'zone'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fejl ved hentning af data' }, { status: 500 });
  }
}
