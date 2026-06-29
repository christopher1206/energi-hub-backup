import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [prisRes, bilRes] = await Promise.all([
      fetch('http://192.168.1.253:3000/api/priser-real', { cache: 'no-store' }),
      fetch('http://192.168.1.253:1880/api/bil/soc', { cache: 'no-store' }),
    ]);

    const priser = await prisRes.json();
    const bil = await bilRes.json();
    const bilSoc = bil.soc || 50;

    const nu = new Date();
    const kwhMangler = Math.max(0, (100 - bilSoc) * 0.60);
    const timerNodvendige = Math.ceil(kwhMangler / 11);

    // KUN timer UDEN for 16-21 (dyr nettarif)
    // Tillad: 21:00-06:00 (nat + sen aften)
    const tilladteLadeTimer = priser.filter((p: any) => {
      const t = new Date(p.time);
      if (t <= nu) return false;
      const h = t.getHours();
      // ALDRIG 16-21 uanset pris
      if (h >= 16 && h < 21) return false;
      // Kun fremtidige timer inden næste deadline (06:00)
      const erSenAften = t.getDate() === nu.getDate() && h >= 21;
      const erNat = t.getDate() !== nu.getDate() && h < 6;
      return erSenAften || erNat;
    });

    if (tilladteLadeTimer.length === 0) {
      return NextResponse.json({
        harPlan: false,
        besked: 'Venter på morgendagens priser'
      });
    }

    // Vælg de billigste timer
    const valgte = [...tilladteLadeTimer]
      .sort((a: any, b: any) => a.pris - b.pris)
      .slice(0, timerNodvendige)
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const foerste = new Date(valgte[0].time);
    const sidst = new Date(valgte[valgte.length - 1].time);
    sidst.setHours(sidst.getHours() + 1);

    const fmt = (d: Date) => d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

    return NextResponse.json({
      harPlan: true,
      startTid: fmt(foerste),
      slutTid: fmt(sidst),
      timerNodvendige,
      bilSoc,
      besked: `Planlagt ladning: ${fmt(foerste)} → ${fmt(sidst)}`
    });

  } catch (error) {
    return NextResponse.json({ harPlan: false, besked: 'Ingen plan tilgængelig' });
  }
}
