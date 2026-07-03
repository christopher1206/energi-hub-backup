import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

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

// Parser CSV med flere tabeller (én pr. sted+felt-kombination) til et map: { sted: { felt: value } }
function parseGroupedByStedAndField(csv: string): Record<string, Record<string, string>> {
  const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
  const result: Record<string, Record<string, string>> = {};
  let header: string[] = [];
  for (const rawLine of lines) {
    const cols = rawLine.replace(/\r$/, '').split(',').map(c => c.trim());
    if (cols.includes('_value')) {
      header = cols;
      continue;
    }
    if (header.length === 0) continue;
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i]));
    const sted = row['sted'];
    const field = row['_field'];
    const value = row['_value'];
    if (!sted || !field) continue;
    if (!result[sted]) result[sted] = {};
    result[sted][field] = value;
  }
  return result;
}

export async function GET() {
  try {
    const liveFlux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -6h)
        |> filter(fn: (r) => r._measurement == "udendors_lys")
        |> group(columns: ["sted", "_field"])
        |> last()
    `;

    const csv = await fluxRaw(liveFlux);
    const grouped = parseGroupedByStedAndField(csv);

    const format = (sted: string) => ({
      state: grouped[sted]?.state ? parseFloat(grouped[sted].state) > 0.5 : false,
      brightness: grouped[sted]?.brightness ? parseFloat(grouped[sted].brightness) : 0,
      linkquality: grouped[sted]?.linkquality ? parseFloat(grouped[sted].linkquality) : 0,
    });

    return NextResponse.json({
      lys_carport: format('lys_carport'),
      lys_terrasse: format('lys_terrasse'),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sted, state, brightness } = await request.json();

    if (sted !== 'lys_carport' && sted !== 'lys_terrasse') {
      return NextResponse.json({ ok: false, fejl: 'Ugyldigt sted' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    if (state !== undefined) payload.state = state ? 'ON' : 'OFF';
    if (brightness !== undefined) payload.brightness = brightness;

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect('mqtt://mosquitto:1883');
      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error('Timeout - intet svar fra Zigbee2MQTT'));
      }, 5000);

      client.on('connect', () => {
        // QoS 1 sikrer at publish-callbacket først fyres når broker'en har bekræftet
        // modtagelsen (PUBACK) - undgår race condition ved for tidlig lukning.
        client.publish(`zigbee2mqtt/${sted}/set`, JSON.stringify(payload), { qos: 1 }, (err) => {
          clearTimeout(timeout);
          if (err) {
            client.end(true);
            reject(err);
            return;
          }
          client.end(); // Blød lukning - flusher evt. resterende data først
          resolve();
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end(true);
        reject(err);
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, fejl: e.message || 'Ukendt fejl' }, { status: 500 });
  }
}
