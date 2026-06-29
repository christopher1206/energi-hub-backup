import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const nu = new Date();
    const år = nu.getFullYear();
    const måned = String(nu.getMonth() + 1).padStart(2, '0');
    const dag = String(nu.getDate()).padStart(2, '0');

    const imorgen = new Date(nu);
    imorgen.setDate(imorgen.getDate() + 1);
    const imorgeMåned = String(imorgen.getMonth() + 1).padStart(2, '0');
    const imorgenDag = String(imorgen.getDate()).padStart(2, '0');

    const [dagRes, imorgenRes] = await Promise.all([
      fetch(`https://www.elprisenligenu.dk/api/v1/prices/${år}/${måned}-${dag}_DK1.json`, { cache: 'no-store' }),
      fetch(`https://www.elprisenligenu.dk/api/v1/prices/${år}/${imorgeMåned}-${imorgenDag}_DK1.json`, { cache: 'no-store' }),
    ]);

    const dagData = await dagRes.json();
    const imorgenData = imorgenRes.ok ? await imorgenRes.json() : [];

    const alleData = [...dagData, ...imorgenData];

    // Beregn dynamiske zoner
    const sorteret = [...alleData].sort((a, b) => a.DKK_per_kWh - b.DKK_per_kWh);
    const billigGraense = sorteret[Math.floor(sorteret.length / 3)].DKK_per_kWh;
    const dyrGraense = sorteret[Math.floor(sorteret.length * 2 / 3)].DKK_per_kWh;

    const priser = alleData.map(p => ({
      time: p.time_start,
      pris: parseFloat(p.DKK_per_kWh.toFixed(4)),
      zone: p.DKK_per_kWh <= billigGraense ? 'billig' : p.DKK_per_kWh >= dyrGraense ? 'dyr' : 'normal',
    }));

    return NextResponse.json(priser);
  } catch (error) {
    return NextResponse.json({ error: 'Fejl ved hentning af priser' }, { status: 500 });
  }
}
