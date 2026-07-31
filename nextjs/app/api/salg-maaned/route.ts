import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

// Tarif ved salg (Vindstød): -0,0230 kr/kWh. Salgspris = variabel timepris (rå spotpris).
const SALG_TARIF_KR = 0.023;

// Månedens start (Europe/Copenhagen) i UTC-iso
function maanedStartUTC(): string {
  const now = new Date();
  const cph = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
  const first = new Date(cph.getFullYear(), cph.getMonth(), 1, 0, 0, 0, 0);
  const offsetMin =
    (new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 60000;
  return new Date(first.getTime() - offsetMin * 60000).toISOString();
}

async function fluxScalar(flux: string): Promise<number> {
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
  if (!res.ok) throw new Error(`InfluxDB ${res.status}: ${csv.slice(0, 200)}`);
  const lines = csv.trim().split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  let vi = -1, total = 0;
  for (const raw of lines) {
    const c = raw.replace(/\r$/, '').split(',').map(x => x.trim());
    const idx = c.indexOf('_value');
    if (idx !== -1) { vi = idx; continue; }
    if (vi !== -1 && c[vi] !== undefined) {
      const v = parseFloat(c[vi]);
      if (!isNaN(v)) total += v;
    }
  }
  return total;
}

export async function GET() {
  try {
    const start = maanedStartUTC();

    const solgtFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${start}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "grid_power")
        |> group(columns: ["_start", "_stop"])
        |> sort(columns: ["_time"])
        |> map(fn: (r) => ({ r with _value: if r._value < 0.0 then -r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;
    const indtjentFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${start}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "grid_power" or r._field == "spotpris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> group(columns: ["_start", "_stop"])
        |> sort(columns: ["_time"])
        |> map(fn: (r) => ({ r with _value: (if r.grid_power < 0.0 then -r.grid_power else 0.0) * (r.spotpris - ${SALG_TARIF_KR}) / 1000.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    const [solgtWh, indtjentKr] = await Promise.all([
      fluxScalar(solgtFlux),
      fluxScalar(indtjentFlux),
    ]);

    const solgtKwh = solgtWh / 1000;
    const gnsPris = solgtKwh > 0 ? indtjentKr / solgtKwh : 0;
    const maaned = new Date().toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', month: 'long', year: 'numeric' });

    return NextResponse.json({
      solgt_kwh: parseFloat(solgtKwh.toFixed(1)),
      indtjent_kr: parseFloat(indtjentKr.toFixed(2)),
      gns_pris: parseFloat(gnsPris.toFixed(3)),
      maaned,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl', solgt_kwh: 0, indtjent_kr: 0, gns_pris: 0 }, { status: 500 });
  }
}
