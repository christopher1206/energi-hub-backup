import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

// Find midnat i dansk lokaltid, returneret som UTC ISO-streng
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

async function fluxQuery(flux: string): Promise<any[]> {
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
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`InfluxDB fejl ${res.status}: ${text.slice(0, 300)}`);
  }
  // Flux annotated CSV kan indeholde flere tabeller (en pr. tag-kombination,
  // f.eks. zone=dyr / zone=normal), hver med sin egen header-linje.
  // Vi finder _value-kolonnen dynamisk per header og summerer ALLE datarækker.
  const lines = text.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  let valueIdx = -1;
  const rows: number[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const cols = line.split(',').map(c => c.trim());
    const idxInThisLine = cols.indexOf('_value');
    if (idxInThisLine !== -1) {
      // Dette er en header-linje (kolonnenavne) - opdater valueIdx
      valueIdx = idxInThisLine;
      continue;
    }
    if (valueIdx !== -1 && cols[valueIdx] !== undefined) {
      const val = parseFloat(cols[valueIdx]);
      if (!isNaN(val)) {
        rows.push(val);
      }
    }
  }
  return rows;
}

export async function GET() {
  try {
    const midnight = copenhagenMidnightUTC();

    // Sol produktion i dag (kWh)
    const solFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "sol_power")
        |> integral(unit: 1h, column: "_value")
    `;

    // Hus forbrug i dag (kWh)
    const loadFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "load_power")
        |> integral(unit: 1h, column: "_value")
    `;

    // Net - købt (positiv del af grid_power)
    const gridKobFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "grid_power")
        |> map(fn: (r) => ({ r with _value: if r._value > 0.0 then r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Net - solgt (negativ del af grid_power, vendt positiv)
    const gridSolgtFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "grid_power")
        |> map(fn: (r) => ({ r with _value: if r._value < 0.0 then -r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Batteri - udladet (positiv del af batteri_power, antaget: positiv = ud af batteri)
    const batUdFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "batteri_power")
        |> map(fn: (r) => ({ r with _value: if r._value > 0.0 then r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Batteri - ladet ind (negativ del af batteri_power, vendt positiv)
    const batIndFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "batteri_power")
        |> map(fn: (r) => ({ r with _value: if r._value < 0.0 then -r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Net - kr brugt på købt strøm i dag (grid_power x pris integreret over tid)
    const gridKobKrFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "grid_power" or r._field == "pris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.grid_power and r.grid_power > 0.0 then r.grid_power else 0.0) / 1000.0 * (if exists r.pris then r.pris else 0.0) }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Tesla - estimeret kWh (kun mens tesla_lad = 1, baseret på tesla_amp, 3-faset 230V)
    const teslaFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "tesla_amp" or r._field == "tesla_lad"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.tesla_lad and r.tesla_lad > 0.5 then 1.0 else 0.0) * (if exists r.tesla_amp then r.tesla_amp else 0.0) * 230.0 * 3.0 / 1000.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    const [sol, load, gridKob, gridSolgt, batUd, batInd, tesla, gridKobKr] = await Promise.all([
      fluxQuery(solFlux),
      fluxQuery(loadFlux),
      fluxQuery(gridKobFlux),
      fluxQuery(gridSolgtFlux),
      fluxQuery(batUdFlux),
      fluxQuery(batIndFlux),
      fluxQuery(teslaFlux),
      fluxQuery(gridKobKrFlux),
    ]);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    const solKwh = sum(sol) / 1000;
    const loadKwh = sum(load) / 1000;
    const gridKobKwh = sum(gridKob) / 1000;
    const gridSolgtKwh = sum(gridSolgt) / 1000;
    const batUdKwh = sum(batUd) / 1000;
    const batIndKwh = sum(batInd) / 1000;
    const teslaKwh = sum(tesla);
    const gridKobKrTotal = parseFloat(sum(gridKobKr).toFixed(2));

    const gennemsnitsElpris = 2.5;
    const sparetIDag = parseFloat(((solKwh - gridKobKwh) * gennemsnitsElpris).toFixed(2));
    const selvforsyningIDag = loadKwh > 0 ? parseFloat(((1 - gridKobKwh / loadKwh) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      dagens_sol_kwh: parseFloat(solKwh.toFixed(2)),
      dagens_load_kwh: parseFloat(loadKwh.toFixed(2)),
      dagens_grid_kob_kwh: parseFloat(gridKobKwh.toFixed(2)),
      dagens_grid_solgt_kwh: parseFloat(gridSolgtKwh.toFixed(2)),
      dagens_batteri_ud_kwh: parseFloat(batUdKwh.toFixed(2)),
      dagens_batteri_ind_kwh: parseFloat(batIndKwh.toFixed(2)),
      dagens_tesla_kwh: parseFloat(teslaKwh.toFixed(2)),
      dagens_grid_kob_kr: gridKobKrTotal,
      sparet_i_dag: sparetIDag,
      selvforsyning_i_dag: selvforsyningIDag,
      midnight_brugt: midnight,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}
