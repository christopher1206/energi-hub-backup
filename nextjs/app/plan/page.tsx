'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PrisTime {
  time: string;
  pris: number;
  zone: string;
}

interface LadePlan {
  timer: number[];
  timerDatoer: string[];
  kwhMangler: number;
  timerNodvendige: number;
  kanNaa: boolean;
  bilSoc: number;
}

function beregnLadePlan(priser: PrisTime[], bilSoc: number): LadePlan {
  const nu = new Date();
  const kwhMangler = Math.max(0, (100 - bilSoc) * 0.60);
  const timerNodvendige = Math.ceil(kwhMangler / 11);

  // Kun nattetimer 21:00-06:00
  const ladeVindue = priser.filter(p => {
    const t = new Date(p.time);
    if (t <= nu) return false;
    const h = t.getHours();
    const erSenAften = t.getDate() === nu.getDate() && h >= 21;
    const erNat = t.getDate() !== nu.getDate() && h < 6;
    return erSenAften || erNat;
  });

  const billigste = [...ladeVindue]
    .sort((a, b) => a.pris - b.pris)
    .slice(0, timerNodvendige);

  const kanNaa = ladeVindue.length >= timerNodvendige;

  return {
    timer: billigste.map(p => new Date(p.time).getHours()),
    timerDatoer: billigste.map(p => new Date(p.time).toISOString()),
    kwhMangler: Math.round(kwhMangler),
    timerNodvendige,
    kanNaa,
    bilSoc,
  };
}

export default function PlanSide() {
  const [priser, setPriser] = useState<PrisTime[]>([]);
  const [bilSoc, setBilSoc] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hent = async () => {
      try {
        const [prisRes, bilRes] = await Promise.all([
          fetch('/api/priser-real'),
          fetch('/api/bil'),
        ]);
        const prisData = await prisRes.json();
        const bilData = await bilRes.json();
        setPriser(Array.isArray(prisData) ? prisData : []);
        setBilSoc(bilData.soc || 50);
      } catch (e) {}
      setLoading(false);
    };
    hent();
    const i = setInterval(hent, 60000);
    return () => clearInterval(i);
  }, []);

  const ladePlan = beregnLadePlan(priser, bilSoc);
  const nu = new Date();
  const maxPris = Math.max(...priser.map(p => p.pris), 1);

  // Opdel priser i i dag og i morgen
  const iDagPriser = priser.filter(p => new Date(p.time).getDate() === nu.getDate());
  const iMorgenPriser = priser.filter(p => new Date(p.time).getDate() !== nu.getDate());

  const erLadeTime = (time: string) => {
    return ladePlan.timerDatoer.some(t => {
      const a = new Date(t);
      const b = new Date(time);
      return a.getHours() === b.getHours() && a.getDate() === b.getDate();
    });
  };

  if (loading) return <div className="loading"><div className="spinner"/><p>Henter priser...</p></div>;

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Ladeplan & Strømpriser</span>
        </div>
        <div className="header-right">
          <Link href="/" className="nav-link">← Live overblik</Link>
        </div>
      </header>

      {/* Ladeplan */}
      <div className="plan-section">
        <h2>🚗 Tesla ladeplan i nat</h2>
        
        <div className="plan-info">
          <div className="plan-stat">
            <span className="plan-stat-value">{bilSoc}%</span>
            <span className="plan-stat-label">Bil batteri nu</span>
          </div>
          <div className="plan-stat">
            <span className="plan-stat-value">{ladePlan.kwhMangler} kWh</span>
            <span className="plan-stat-label">Mangler</span>
          </div>
          <div className="plan-stat">
            <span className="plan-stat-value">{ladePlan.timerNodvendige}t</span>
            <span className="plan-stat-label">Ladetid nødvendig</span>
          </div>
          <div className="plan-stat">
            <span className={`plan-stat-value ${ladePlan.kanNaa ? 'pos' : 'neg'}`}>
              {ladePlan.kanNaa ? '✓ JA' : '✗ NEJ'}
            </span>
            <span className="plan-stat-label">Kan nå 100% kl 06:00</span>
          </div>
        </div>

        {!ladePlan.kanNaa && (
          <div className="advarsel">
            ⚠️ Bilen kan ikke nå 100% inden kl. 06:00 — tving ladning aktiveres kl. 03:00!
          </div>
        )}

        {/* I dag kalender */}
        <div className="kalender-dato-label">
          📅 I dag — {nu.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div className="kalender">
          {iDagPriser.map((p, i) => {
            const t = new Date(p.time);
            const erNu = t.getHours() === nu.getHours();
            const erFortid = t < nu && !erNu;
            const erLade = erLadeTime(p.time);
            return (
              <div key={i} className={`kalender-time ${erLade ? 'lade-time' : ''} ${erNu ? 'nu-time' : ''} ${erFortid ? 'fortid-time' : ''}`}>
                <span className="time-label">{String(t.getHours()).padStart(2, '0')}</span>
                {erLade && <span className="lade-ikon">⚡</span>}
                <span className={`time-pris zone-${p.zone}`}>{p.pris.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* I morgen kalender */}
        {iMorgenPriser.length > 0 && (
          <>
            <div className="kalender-dato-label" style={{marginTop: '1rem'}}>
              📅 I morgen — {new Date(iMorgenPriser[0].time).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="kalender">
              {iMorgenPriser.map((p, i) => {
                const t = new Date(p.time);
                const erLade = erLadeTime(p.time);
                return (
                  <div key={i} className={`kalender-time ${erLade ? 'lade-time' : ''}`}>
                    <span className="time-label">{String(t.getHours()).padStart(2, '0')}</span>
                    {erLade && <span className="lade-ikon">⚡</span>}
                    <span className={`time-pris zone-${p.zone}`}>{p.pris.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="kalender-legend">
          <span className="legend-item"><span className="legend-dot lade"/>&nbsp;Planlagt ladning</span>
          <span className="legend-item"><span className="legend-dot nu"/>&nbsp;Nuværende time</span>
        </div>
      </div>

      {/* Strømpris graf */}
      <div className="plan-section">
        <h2>💰 Strømpriser næste 24 timer (inkl. afgifter)</h2>
        <div className="pris-graf">
          {priser.map((p, i) => {
            const time = new Date(p.time);
            const erNu = time.getHours() === nu.getHours() && time.getDate() === nu.getDate();
            const erFortid = time < nu && !erNu;
            const højde = Math.max(4, (p.pris / maxPris) * 200);
            const farve = p.zone === 'billig' ? '#22c55e' : p.zone === 'dyr' ? '#ef4444' : '#f59e0b';
            
            return (
              <div key={i} className="graf-kolonne">
                <span className="graf-pris">{p.pris.toFixed(2)}</span>
                <div className="graf-bar-wrapper">
                  <div
                    className="graf-bar"
                    style={{ height: `${højde}px`, background: farve, opacity: erFortid ? 0.3 : erNu ? 1 : 0.7 }}
                    title={`${time.getDate()}/${time.getMonth()+1} ${time.getHours()}:00 — ${p.pris.toFixed(2)} kr/kWh`}
                  />
                </div>
                <span className={`graf-time ${erNu ? 'nu' : ''}`}>{time.getHours()}</span>
              </div>
            );
          })}
        </div>
        <div className="graf-legend">
          <span style={{color:'#22c55e'}}>● Billig</span>
          <span style={{color:'#f59e0b'}}>● Normal</span>
          <span style={{color:'#ef4444'}}>● Dyr</span>
        </div>
      </div>

      <div style={{textAlign:"center",marginBottom:"1rem", display:"flex", gap:"1rem", justifyContent:"center"}}>
        <Link href="/" className="nav-link">← Live overblik</Link>
        <Link href="/statistik" className="nav-link">📊 Statistik →</Link>
      </div>

      <footer>
        <span>Deadline: 06:00 hverdage</span>
        <span>Opdateres hvert minut</span>
      </footer>
    </div>
  );
}
