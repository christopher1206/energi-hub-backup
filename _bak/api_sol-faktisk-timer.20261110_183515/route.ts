import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

export async function GET() {
  try {
    // VIGTIGT: Vi grupperer IKKE før aggregateWindow. "sol_power" har tags
    // (zone, growatt_mode) der ændrer sig i løbet af dagen, hvilket giver
    // FLERE separate underliggende serier. At gruppere dem sammen FØR
    // aggregatWindow's mean-beregning gav et forkert (for lavt) resultat -
    // den korrekte metode (bekræftet mod dagens-tal's integral-baserede
    // beregning) er at lade hver tag-serie beregnes separat pr. time, og så
    // LÆGGE DEM SAMMEN pr. tidspunkt i selve parsingen nedenfor.
    const flux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: today())
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "sol_power")
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
    // CSV'en kan indeholde FLERE tabeller (én pr. zone/growatt_mode-serie),
    // hver med sin egen header-linje. Vi finder _time og _value-kolonnen
    // dynamisk pr. header, og LÆGGER VÆRDIER SAMMEN når flere rækker deler
    // samme tidspunkt (det er netop det der gør beregningen korrekt).
    const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
    const summer: Record<string, number> = {};
    let tidIdx = -1;
    let valIdx = -1;

    for (const rawLine of lines) {
      const cols = rawLine.replace(/\r$/, '').split(',').map(c => c.trim());
      const idxInThisLine = cols.indexOf('_value');
      if (idxInThisLine !== -1) {
        tidIdx = cols.indexOf('_time');
        valIdx = idxInThisLine;
        continue;
      }
      if (tidIdx === -1 || valIdx === -1) continue;
      const tid = cols[tidIdx];
      const val = parseFloat(cols[valIdx]);
      if (tid && !isNaN(val)) {
        summer[tid] = (summer[tid] || 0) + val;
      }
    }

    const timer = Object.entries(summer)
      .map(([time, kwh]) => ({ time, kwh: parseFloat(kwh.toFixed(2)) }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json({ timer, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ timer: [], timestamp: new Date().toISOString() });
  }
}
