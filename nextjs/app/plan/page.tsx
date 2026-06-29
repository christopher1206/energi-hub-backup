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
  kwhMangler: number;
  timerNodvendige: number;
  kanNaa: boolean;
  bilSoc: number;
}

function beregnLadePlan(priser: PrisTime[], bilSoc: number): LadePlan {
  const nu = new Date();
  const erHverdag = nu.getDay() >= 1 && nu.getDay() <= 5;
  
  const kwhMangler = Math.max(0, (100 - bilSoc) * 0.60);
  const timerNodvendige = Math.ceil(kwhMangler / 11);

  // Find kommende timer frem til 06:00
  const deadline = new Date(nu);
  if (nu.getHours() >= 6) {
    deadline.setDate(deadline.getDate() + 1);
  }
  deadline.setHours(6, 0, 0, 0);

  const kommende = priser.filter(p => {
    const t = new Date(p.time);
    return t > nu && t < deadline;
  });

  // Sorter efter pris og vælg de billigste
  const billigste = [...kommende]
    .sort((a, b) => a.pris - b.pris)
    .slice(0, timerNodvendige)
    .map(p => new Date(p.time).getHours());

  const kanNaa = kommende.length >= timerNodvendige;

  return {
    timer: billigste.sort((a, b) => a - b),
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
        const [prisRes, dataRes, bilRes] = await Promise.all([
          fetch('/api/priser'),
          fetch('/api/data'),
          fetch('/api/bil'),
        ]);
        const prisData = await prisRes.json();
        const energiData = await dataRes.json();
        setPriser(Array.isArray(prisData) ? prisData : []);
        const bilData = await bilRes.json();
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

        {/* 24 timers kalender */}
        <div className="kalender">
          {Array.from({ length: 24 }, (_, i) => {
            const erLadeTime = ladePlan.timer.includes(i);
            const erNuTime = nu.getHours() === i;
            const prisForTime = priser.find(p => new Date(p.time).getHours() === i);
            
            return (
              <div key={i} className={`kalender-time ${erLadeTime ? 'lade-time' : ''} ${erNuTime ? 'nu-time' : ''}`}>
                <span className="time-label">{String(i).padStart(2, '0')}</span>
                {erLadeTime && <span className="lade-ikon">⚡</span>}
                {prisForTime && (
                  <span className={`time-pris zone-${prisForTime.zone}`}>
                    {prisForTime.pris.toFixed(2)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="kalender-legend">
          <span className="legend-item"><span className="legend-dot lade"/>&nbsp;Planlagt ladning</span>
          <span className="legend-item"><span className="legend-dot nu"/>&nbsp;Nuværende time</span>
        </div>
      </div>

      {/* Strømpris graf */}
      <div className="plan-section">
        <h2>💰 Strømpriser næste 24 timer</h2>
        <div className="pris-graf">
          {priser.map((p, i) => {
            const time = new Date(p.time);
            const erNu = time.getHours() === nu.getHours() && time.getDate() === nu.getDate();
            const højde = Math.max(4, (p.pris / maxPris) * 200);
            const farve = p.zone === 'billig' ? '#22c55e' : p.zone === 'dyr' ? '#ef4444' : '#f59e0b';
            
            return (
              <div key={i} className="graf-kolonne">
                <span className="graf-pris">{p.pris.toFixed(2)}</span>
                <div className="graf-bar-wrapper">
                  <div
                    className="graf-bar"
                    style={{ height: `${højde}px`, background: farve, opacity: erNu ? 1 : 0.7 }}
                    title={`${time.getHours()}:00 — ${p.pris.toFixed(2)} kr/kWh`}
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

      <footer>
        <span>Deadline: 06:00 hverdage</span>
        <span>Opdateres hvert minut</span>
      </footer>
    </div>
  );
}
