import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

// Find et bestemt lokalt tidspunkt i København, returneret som UTC ISO-streng.
// baseDate justeres i lokal tid FØR konvertering, så sommertid håndteres korrekt.
function copenhagenLocalToUTC(year: number, month: number, day: number): string {
  const guess = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const offsetMin =
    (new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' })).getTime() -
      new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
    60000;
  const utcMidnight = new Date(guess.getTime() - offsetMin * 60000);
  return utcMidnight.toISOString();
}

function getCopenhagenNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
}

function getRangeStart(periode: string): string {
  const nuKbh = getCopenhagenNow();
  const aar = nuKbh.getFullYear();
  const maaned = nuKbh.getMonth();
  const dag = nuKbh.getDate();

  switch (periode) {
    case 'time': {
      const start = new Date();
      start.setHours(start.getHours() - 1);
      return start.toISOString();
    }
    case 'dag':
      return copenhagenLocalToUTC(aar, maaned, dag);
    case 'uge': {
      // Mandag som ugestart (ISO). getDay(): 0=søndag..6=lørdag
      const ugedag = nuKbh.getDay();
      const dageSidenMandag = ugedag === 0 ? 6 : ugedag - 1;
      const mandag = new Date(nuKbh);
      mandag.setDate(nuKbh.getDate() - dageSidenMandag);
      return copenhagenLocalToUTC(mandag.getFullYear(), mandag.getMonth(), mandag.getDate());
    }
    case 'maaned':
      return copenhagenLocalToUTC(aar, maaned, 1);
    case 'aar':
      return copenhagenLocalToUTC(aar, 0, 1);
    default:
      return copenhagenLocalToUTC(aar, maaned, dag);
  }
}

async function fluxQuery(flux: string): Promise<number[]> {
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
  const lines = text.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  let valueIdx = -1;
  const rows: number[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const cols = line.split(',').map(c => c.trim());
    const idxInThisLine = cols.indexOf('_value');
    if (idxInThisLine !== -1) {
      valueIdx = idxInThisLine;
      continue;
    }
    if (valueIdx !== -1 && cols[valueIdx] !== undefined) {
      const val = parseFloat(cols[valueIdx]);
      if (!isNaN(val)) rows.push(val);
    }
  }
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const periode = req.nextUrl.searchParams.get('periode') || 'dag';
    const gyldigePerioder = ['time', 'dag', 'uge', 'maaned', 'aar'];
    if (!gyldigePerioder.includes(periode)) {
      return NextResponse.json({ fejl: 'Ugyldig periode' }, { status: 400 });
    }

    const rangeStart = getRangeStart(periode);

    const solFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "sol_power")
        |> integral(unit: 1h, column: "_value")
    `;
    const loadFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "load_power")
        |> integral(unit: 1h, column: "_value")
    `;
    const gridKobFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "grid_power")
        |> map(fn: (r) => ({ r with _value: if r._value > 0.0 then r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;
    const gridSolgtFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "grid_power")
        |> map(fn: (r) => ({ r with _value: if r._value < 0.0 then -r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;
    const batUdFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "batteri_power")
        |> map(fn: (r) => ({ r with _value: if r._value > 0.0 then r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;
    const batIndFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and r._field == "batteri_power")
        |> map(fn: (r) => ({ r with _value: if r._value < 0.0 then -r._value else 0.0 }))
        |> integral(unit: 1h, column: "_value")
    `;
    const gridKobKrFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "grid_power" or r._field == "pris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.grid_power and r.grid_power > 0.0 then r.grid_power else 0.0) / 1000.0 * (if exists r.pris then r.pris else 0.0) }))
        |> integral(unit: 1h, column: "_value")
    `;
    const teslaFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "tesla_amp" or r._field == "tesla_lad"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.tesla_lad and r.tesla_lad > 0.5 then 1.0 else 0.0) * (if exists r.tesla_amp then r.tesla_amp else 0.0) * 230.0 * 3.0 / 1000.0 }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Salgsindtægt: solgt effekt x rå spotpris (ikke fuld detailpris - man får kun
    // spotprisen for solgt strøm, ikke tariffer/afgifter oveni)
    const gridSolgtKrFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "grid_power" or r._field == "spotpris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.grid_power and r.grid_power < 0.0 then -r.grid_power else 0.0) / 1000.0 * (if exists r.spotpris then r.spotpris else 0.0) }))
        |> integral(unit: 1h, column: "_value")
    `;

    // Hvad ville HELE husforbruget have kostet, hvis alt var købt fra nettet
    // til den FAKTISKE pris hver time - bruges til at beregne reel besparelse
    // (i stedet for en hardkodet gennemsnitspris, som var markant unøjagtig).
    const teoretiskFuldPrisFlux = `
      data = from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "energi" and (r._field == "load_power" or r._field == "pris"))
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      data
        |> map(fn: (r) => ({ r with _value: (if exists r.load_power then r.load_power else 0.0) / 1000.0 * (if exists r.pris then r.pris else 0.0) }))
        |> integral(unit: 1h, column: "_value")
    `;

    const tempMeanFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "temperatur_fugt" and r.sted == "koekken" and r._field == "temperature")
        |> mean(column: "_value")
    `;
    const tempMinFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "temperatur_fugt" and r.sted == "koekken" and r._field == "temperature")
        |> min(column: "_value")
    `;
    const tempMaxFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "temperatur_fugt" and r.sted == "koekken" and r._field == "temperature")
        |> max(column: "_value")
    `;
    const fugtMeanFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${rangeStart}"))
        |> filter(fn: (r) => r._measurement == "temperatur_fugt" and r.sted == "koekken" and r._field == "humidity")
        |> mean(column: "_value")
    `;

    const [sol, load, gridKob, gridSolgt, batUd, batInd, tesla, gridKobKr, gridSolgtKr, teoretiskFuldPris, tempMean, tempMin, tempMax, fugtMean] = await Promise.all([
      fluxQuery(solFlux),
      fluxQuery(loadFlux),
      fluxQuery(gridKobFlux),
      fluxQuery(gridSolgtFlux),
      fluxQuery(batUdFlux),
      fluxQuery(batIndFlux),
      fluxQuery(teslaFlux),
      fluxQuery(gridKobKrFlux),
      fluxQuery(gridSolgtKrFlux).catch(() => []),
      fluxQuery(teoretiskFuldPrisFlux).catch(() => []),
      fluxQuery(tempMeanFlux).catch(() => []),
      fluxQuery(tempMinFlux).catch(() => []),
      fluxQuery(tempMaxFlux).catch(() => []),
      fluxQuery(fugtMeanFlux).catch(() => []),
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
    const gridSolgtKrTotal = parseFloat(sum(gridSolgtKr).toFixed(2));

    const teoretiskFuldPrisKr = sum(teoretiskFuldPris);
    const sparetIPeriode = parseFloat((teoretiskFuldPrisKr - gridKobKrTotal).toFixed(2));
    const selvforsyningIPeriode = loadKwh > 0 ? parseFloat(((1 - gridKobKwh / loadKwh) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      periode,
      range_start_brugt: rangeStart,
      koekken_temp_gennemsnit: tempMean.length > 0 ? parseFloat(tempMean[0].toFixed(1)) : null,
      koekken_temp_min: tempMin.length > 0 ? parseFloat(tempMin[0].toFixed(1)) : null,
      koekken_temp_max: tempMax.length > 0 ? parseFloat(tempMax[0].toFixed(1)) : null,
      koekken_fugt_gennemsnit: fugtMean.length > 0 ? parseFloat(fugtMean[0].toFixed(0)) : null,
      sol_kwh: parseFloat(solKwh.toFixed(2)),
      load_kwh: parseFloat(loadKwh.toFixed(2)),
      grid_kob_kwh: parseFloat(gridKobKwh.toFixed(2)),
      grid_solgt_kwh: parseFloat(gridSolgtKwh.toFixed(2)),
      batteri_ud_kwh: parseFloat(batUdKwh.toFixed(2)),
      batteri_ind_kwh: parseFloat(batIndKwh.toFixed(2)),
      tesla_kwh: parseFloat(teslaKwh.toFixed(2)),
      grid_kob_kr: gridKobKrTotal,
      grid_solgt_kr: gridSolgtKrTotal,
      sparet: sparetIPeriode,
      selvforsyning: selvforsyningIPeriode,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}
