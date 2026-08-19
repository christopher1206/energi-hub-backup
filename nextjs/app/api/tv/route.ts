import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';
const SHELLY_TOPIC = 'TV';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

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

async function fluxRaw(flux: string): Promise<string> {
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
  return text;
}

async function fluxSum(flux: string): Promise<number> {
  const csv = await fluxRaw(flux);
  const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  let valueIdx = -1;
  let total = 0;
  for (const rawLine of lines) {
    const cols = rawLine.replace(/\r$/, '').split(',').map(c => c.trim());
    const idx = cols.indexOf('_value');
    if (idx !== -1) {
      valueIdx = idx;
      continue;
    }
    if (valueIdx !== -1 && cols[valueIdx] !== undefined) {
      const val = parseFloat(cols[valueIdx]);
      if (!isNaN(val)) total += val;
    }
  }
  return total;
}

// Sender en RPC-forespørgsel til Shelly'en over MQTT og venter på svar.
function mqttRpc(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL);
    const src = 'tv-dashboard-' + Math.random().toString(36).slice(2, 8);
    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('Timeout - intet svar fra Shelly'));
    }, 5000);
    client.on('connect', () => {
      client.subscribe(`${src}/rpc`, (err) => {
        if (err) {
          clearTimeout(timeout);
          client.end(true);
          reject(err);
          return;
        }
        client.publish(
          `${SHELLY_TOPIC}/rpc`,
          JSON.stringify({ id: 1, src, method, params })
        );
      });
    });
    client.on('message', (_topic, payload) => {
      clearTimeout(timeout);
      client.end(true);
      try {
        resolve(JSON.parse(payload.toString()));
      } catch {
        resolve({});
      }
    });
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

export async function GET() {
  try {
    const midnight = copenhagenMidnightUTC();
    const energiFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: time(v: "${midnight}"))
        |> filter(fn: (r) => r._measurement == "tv" and r._field == "apower")
        |> integral(unit: 1h, column: "_value")
    `;
    const [statusMsg, energiWh] = await Promise.all([
      mqttRpc('Switch.GetStatus', { id: 0 }),
      fluxSum(energiFlux).catch(() => 0),
    ]);
    const r = (statusMsg && statusMsg.result) ? statusMsg.result : {};
    return NextResponse.json({
      apower: typeof r.apower === 'number' ? r.apower : 0,
      voltage: typeof r.voltage === 'number' ? r.voltage : 0,
      current: typeof r.current === 'number' ? r.current : 0,
      temp_c: r.temperature && typeof r.temperature.tC === 'number' ? r.temperature.tC : 0,
      output: !!r.output,
      dagens_kwh: parseFloat((energiWh / 1000).toFixed(3)),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { on } = await request.json();
    const result = await mqttRpc('Switch.Set', { id: 0, on });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}
