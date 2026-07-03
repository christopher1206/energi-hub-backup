import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const INFLUX_ORG = process.env.INFLUX_ORG || 'energihub';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'energi2';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';

const LAT = 55.48375;
const LON = 9.299174;

// Samme NOAA-baserede beregning som i Node-RED, portet til TypeScript
function calcSunUTC(date: Date, lat: number, lon: number, isSunrise: boolean): number | null {
  const rad = Math.PI / 180;
  const zenith = 90.833;
  const N1 = Math.floor(275 * (date.getUTCMonth() + 1) / 9);
  const N2 = Math.floor((date.getUTCMonth() + 1 + 9) / 12);
  const N3 = 1 + Math.floor((date.getUTCFullYear() - 4 * Math.floor(date.getUTCFullYear() / 4) + 2) / 3);
  const N = N1 - N2 * N3 + date.getUTCDate() - 30;
  const lngHour = lon / 15;
  const t = isSunrise ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
  L = (L + 360) % 360;
  let RA = (1 / rad) * Math.atan(0.91764 * Math.tan(L * rad));
  RA = (RA + 360) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  let H = isSunrise ? 360 - (1 / rad) * Math.acos(cosH) : (1 / rad) * Math.acos(cosH);
  H = H / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  return ((T - lngHour) + 24) % 24;
}

function utcHoursToLocalStr(utcHours: number | null, baseDate: Date): string | null {
  if (utcHours === null) return null;
  const h = Math.floor(utcHours);
  const m = Math.round((utcHours - h) * 60);
  const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), h, m, 0));
  return d.toLocaleString('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hour12: false });
}

export async function GET() {
  const now = new Date();
  const sunrise = utcHoursToLocalStr(calcSunUTC(now, LAT, LON, true), now);
  const sunset = utcHoursToLocalStr(calcSunUTC(now, LAT, LON, false), now);

  let sidsteHaendelse: { tid: string; beskrivelse: string } | null = null;

  try {
    const flux = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "events" and r.type == "lys_automatik")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
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
    const lines = csv.trim().split(/\r?\n/).filter(l => l.length > 0 && !l.startsWith('#'));
    if (lines.length >= 2) {
      const header = lines[0].split(',').map(c => c.trim());
      const row = lines[1].split(',').map(c => c.trim());
      const tidIdx = header.indexOf('_time');
      const valIdx = header.indexOf('_value');
      if (tidIdx !== -1 && valIdx !== -1) {
        sidsteHaendelse = { tid: row[tidIdx], beskrivelse: row[valIdx] };
      }
    }
  } catch (e) {
    // Stille fejl - dashboard skal ikke crashe hvis events-opslag fejler
  }

  return NextResponse.json({
    sunrise,
    sunset,
    sidste_haendelse: sidsteHaendelse,
    timestamp: new Date().toISOString(),
  });
}
