import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

// === Tilføj nye plugs her: { measurement, label, icon } ===
const PLUGS = [
  { m: 'opvaskemaskine',       label: 'Opvaskemaskine',        icon: '🍽️' },
  { m: 'vinkoelerskab',        label: 'Vinkølerskab',          icon: '🍷' },
  { m: 'villadsgamerpc',       label: 'Villads Gamer PC',      icon: '🎮' },
  { m: 'nilanventilationloft', label: 'Nilan Ventilation Loft', icon: '🌬️' },
];

function copenhagenMidnightUTC(): string {
  const now = new Date();
  const offsetMin =
    (new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
    60000;
  const shifted = new Date(now.getTime() + offsetMin * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  const utcMidnight = new Date(shifted.getTime() - offsetMin * 60000);
  return utcMidnight.toISOString();
}

async function fluxSum(flux: string): Promise<number> {
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
  if (!res.ok) throw new Error(`InfluxDB fejl ${res.status}: ${csv.slice(0, 200)}`);
  const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  let valueIdx = -1, total = 0;
  for (const raw of lines) {
    const cols = raw.replace(/\r$/, '').split(',').map(c => c.trim());
    const idx = cols.indexOf('_value');
    if (idx !== -1) { valueIdx = idx; continue; }
    if (valueIdx !== -1 && cols[valueIdx] !== undefined) {
      const v = parseFloat(cols[valueIdx]);
      if (!isNaN(v)) total += v;
    }
  }
  return total;
}

export async function GET() {
  try {
    const midnight = copenhagenMidnightUTC();
    const resultater = await Promise.all(
      PLUGS.map(async (p) => {
        const flux = `
          from(bucket: "${INFLUX_BUCKET}")
            |> range(start: time(v: "${midnight}"))
            |> filter(fn: (r) => r._measurement == "${p.m}" and r._field == "apower")
            |> integral(unit: 1h, column: "_value")
        `;
        let kwh = 0;
        try { kwh = parseFloat(((await fluxSum(flux)) / 1000).toFixed(3)); } catch { kwh = 0; }
        return { navn: p.label, icon: p.icon, kwh };
      })
    );
    return NextResponse.json({ apparater: resultater, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl', apparater: [] }, { status: 500 });
  }
}
