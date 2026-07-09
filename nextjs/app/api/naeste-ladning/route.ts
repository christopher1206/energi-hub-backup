import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// VIGTIGT: Læser direkte fra /api/ladeplan (som igen afspejler Beslutnings-
// motorens FAKTISKE, aktuelle plan i Node-RED), i stedet for at genberegne
// planen uafhængigt her. Denne route havde tidligere sin egen forældede kopi
// af logikken (bl.a. en fast antagelse om at 16-21 ALDRIG kan bruges til
// ladning, som blev fjernet fra Beslutnings-motoren for at tillade ladning
// i det vindue når prisen reelt er billig) - det kunne vise en "Næste
// ladning"-besked der ikke stemte overens med hvad systemet rent faktisk
// gjorde. Samme rodårsag og løsning som "Næste begivenheder"-fejlen tidligere.

export async function GET() {
  try {
    const res = await fetch('http://192.168.1.253:1880/api/ladeplan', { cache: 'no-store' });
    const plan = await res.json();

    if (!plan.bilTilsluttet) {
      return NextResponse.json({ harPlan: false, besked: '🚗 Bil ikke tilsluttet' });
    }
    if (plan.manglerKwh <= 0) {
      return NextResponse.json({ harPlan: false, besked: `✅ Bil allerede fuldt opladet (${plan.carSoc}%)` });
    }
    if (!plan.timer || plan.timer.length === 0) {
      return NextResponse.json({ harPlan: false, besked: 'Venter på priser/plan' });
    }

    const foerste = new Date(plan.timer[0].time);
    const sidst = new Date(plan.timer[plan.timer.length - 1].time);
    sidst.setHours(sidst.getHours() + 1);

    const fmt = (d: Date) => d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

    return NextResponse.json({
      harPlan: true,
      startTid: fmt(foerste),
      startDato: foerste.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' }),
      slutTid: fmt(sidst),
      timerNodvendige: plan.timerNodvendige,
      bilSoc: plan.carSoc,
      besked: `Planlagt ladning: ${fmt(foerste)} → ${fmt(sidst)}`,
    });
  } catch (error) {
    return NextResponse.json({ harPlan: false, besked: 'Ingen plan tilgængelig' });
  }
}
