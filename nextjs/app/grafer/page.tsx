'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DataPunkt {
  tid: string;
  vaerdi: number;
}

function GrafLinje({ data, farve, label, enhed, maxVal }: {
  data: DataPunkt[];
  farve: string;
  label: string;
  enhed: string;
  maxVal: number;
}) {
  if (data.length === 0) return (
    <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
      Ingen data endnu
    </div>
  );

  const width = 800;
  const height = 200;
  const padding = { top: 10, right: 20, bottom: 30, left: 60 };
  const grafWidth = width - padding.left - padding.right;
  const grafHeight = height - padding.top - padding.bottom;

  const max = maxVal || Math.max(...data.map(d => d.vaerdi)) || 1;
  const min = Math.min(0, Math.min(...data.map(d => d.vaerdi)));

  const xScale = (i: number) => (i / (data.length - 1)) * grafWidth;
  const yScale = (v: number) => grafHeight - ((v - min) / (max - min)) * grafHeight;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.vaerdi)}`).join(' ');
  const area = `${xScale(0)},${grafHeight} ${points} ${xScale(data.length - 1)},${grafHeight}`;

  // X-akse labels (hver time)
  const labels: { x: number; label: string }[] = [];
  data.forEach((d, i) => {
    const t = new Date(d.tid);
    if (t.getMinutes() === 0 || i === 0) {
      labels.push({
        x: xScale(i),
        label: t.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  // Y-akse labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: yScale(min + f * (max - min)),
    label: Math.round(min + f * (max - min)).toString()
  }));

  const nuvaerende = data[data.length - 1]?.vaerdi || 0;

  return (
    <div className="graf-container">
      <div className="graf-header">
        <span className="graf-label" style={{ color: farve }}>{label}</span>
        <span className="graf-nu" style={{ color: farve }}>
          {nuvaerende > 0 ? nuvaerende.toFixed(nuvaerende < 10 ? 2 : 0) : 0} {enhed}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Grid linjer */}
          {yLabels.map((l, i) => (
            <g key={i}>
              <line x1={0} y1={l.y} x2={grafWidth} y2={l.y} stroke="#1e293b" strokeWidth="1" />
              <text x={-5} y={l.y + 4} textAnchor="end" fill="#64748b" fontSize="11">{l.label}</text>
            </g>
          ))}

          {/* Area */}
          <polygon points={area} fill={farve} fillOpacity="0.1" />

          {/* Linje */}
          <polyline points={points} fill="none" stroke={farve} strokeWidth="2" strokeLinejoin="round" />

          {/* X-akse labels */}
          {labels.filter((_, i) => i % 2 === 0).map((l, i) => (
            <text key={i} x={l.x} y={grafHeight + 20} textAnchor="middle" fill="#64748b" fontSize="10">{l.label}</text>
          ))}

          {/* Nuværende punkt */}
          {data.length > 0 && (
            <circle
              cx={xScale(data.length - 1)}
              cy={yScale(data[data.length - 1].vaerdi)}
              r="4"
              fill={farve}
            />
          )}
        </g>
      </svg>
    </div>
  );
}

export default function GraferSide() {
  const [sol, setSol] = useState<DataPunkt[]>([]);
  const [grid, setGrid] = useState<DataPunkt[]>([]);
  const [batteri, setBatteri] = useState<DataPunkt[]>([]);
  const [pris, setPris] = useState<DataPunkt[]>([]);
  const [load, setLoad] = useState<DataPunkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('24h');

  useEffect(() => {
    const hent = async () => {
      setLoading(true);
      try {
        const [solRes, gridRes, batteriRes, prisRes, loadRes] = await Promise.all([
          fetch(`/api/historik?felt=sol_power&periode=${periode}`),
          fetch(`/api/historik?felt=grid_power&periode=${periode}`),
          fetch(`/api/historik?felt=batteri_soc&periode=${periode}`),
          fetch(`/api/historik?felt=pris&periode=${periode}`),
          fetch(`/api/historik?felt=load_power&periode=${periode}`),
        ]);
        setSol(await solRes.json());
        setGrid(await gridRes.json());
        setBatteri(await batteriRes.json());
        setPris(await prisRes.json());
        setLoad(await loadRes.json());
      } catch (e) {}
      setLoading(false);
    };
    hent();
    const i = setInterval(hent, 300000);
    return () => clearInterval(i);
  }, [periode]);

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Grafer & Historik</span>
        </div>
        <div className="header-right">
          <Link href="/" className="nav-link">← Live overblik</Link>
        </div>
      </header>

      {/* Periode vælger */}
      <div className="periode-valg">
        {['6h', '12h', '24h', '48h', '7d'].map(p => (
          <button
            key={p}
            className={`periode-btn ${periode === p ? 'aktiv' : ''}`}
            onClick={() => setPeriode(p)}
          >
            {p === '6h' ? '6 timer' : p === '12h' ? '12 timer' : p === '24h' ? '24 timer' : p === '48h' ? '2 dage' : '7 dage'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/><p>Henter data...</p></div>
      ) : (
        <div className="grafer-grid">
          <div className="graf-kort">
            <h3>☀️ Sol produktion</h3>
            <GrafLinje data={sol} farve="#f59e0b" label="Sol" enhed="W" maxVal={6000} />
          </div>

          <div className="graf-kort">
            <h3>🔌 Net forbrug</h3>
            <GrafLinje data={grid} farve="#3b82f6" label="Net" enhed="W" maxVal={5000} />
          </div>

          <div className="graf-kort">
            <h3>🔋 Batteri SOC</h3>
            <GrafLinje data={batteri} farve="#22c55e" label="Batteri" enhed="%" maxVal={100} />
          </div>

          <div className="graf-kort">
            <h3>🏠 Husforbrug</h3>
            <GrafLinje data={load} farve="#8b5cf6" label="Hus" enhed="W" maxVal={5000} />
          </div>

          <div className="graf-kort graf-bred">
            <h3>💰 Strømpris (inkl. afgifter)</h3>
            <GrafLinje data={pris} farve="#ec4899" label="Pris" enhed="kr/kWh" maxVal={4} />
          </div>
        </div>
      )}

      <div style={{textAlign:"center", marginBottom:"1rem", display:"flex", gap:"1rem", justifyContent:"center"}}>
        <Link href="/" className="nav-link">← Live overblik</Link>
        <Link href="/statistik" className="nav-link">📊 Statistik →</Link>
        <Link href="/plan" className="nav-link">📅 Ladeplan →</Link>
      </div>

      <footer>
        <span>Data opdateres hvert 5. minut</span>
      </footer>
    </div>
  );
}
