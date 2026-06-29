'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EnergiData {
  batteri_soc: number;
  sol_power: number;
  grid_power: number;
  batteri_power: number;
  batteri_temp: number;
  tesla_lad: number;
  tesla_amp: number;
  pris: number;
  zone: string;
  growatt_mode: string;
  timestamp: string;
}

interface BilData {
  soc: number;
  opdateret: string | null;
}

interface NaesteLadning {
  harPlan: boolean;
  startTid?: string;
  slutTid?: string;
  besked: string;
}

interface OverrideStatus {
  aktiv: boolean;
}

function ZoneFarve({ zone }: { zone: string }) {
  if (zone === 'billig') return <span className="zone-billig">● BILLIG</span>;
  if (zone === 'dyr') return <span className="zone-dyr">● DYR</span>;
  if (zone === 'override') return <span className="zone-override">● OVERRIDE</span>;
  return <span className="zone-normal">● NORMAL</span>;
}

function BatteriRing({ pct }: { pct: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 70 70)" />
      <text x="70" y="65" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">{pct}%</text>
      <text x="70" y="85" textAnchor="middle" fill="#94a3b8" fontSize="11">BATTERI</text>
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<EnergiData | null>(null);
  const [bil, setBil] = useState<BilData>({ soc: 50, opdateret: null });
  const [naesteLadning, setNaesteLadning] = useState<NaesteLadning>({ harPlan: false, besked: 'Henter...' });
  const [override, setOverride] = useState<OverrideStatus>({ aktiv: false });
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [bilInput, setBilInput] = useState('');
  const [bilGemt, setBilGemt] = useState(false);
  const [tid, setTid] = useState('');

  useEffect(() => {
    const hent = async () => {
      try {
        const [dataRes, overrideRes, bilRes, ladningRes] = await Promise.all([
          fetch('/api/data'),
          fetch('/api/override'),
          fetch('/api/bil'),
          fetch('/api/naeste-ladning'),
        ]);
        setData(await dataRes.json());
        setOverride(await overrideRes.json());
        setBil(await bilRes.json());
        setNaesteLadning(await ladningRes.json());
      } catch (e) {}
    };
    hent();
    const interval = setInterval(hent, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTid(new Date().toLocaleTimeString('da-DK'));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const toggleOverride = async () => {
    setOverrideLoading(true);
    try {
      await fetch('/api/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktiv: !override.aktiv }),
      });
      const res = await fetch('/api/override');
      setOverride(await res.json());
    } catch (e) {}
    setOverrideLoading(false);
  };

  const gemBilSoc = async () => {
    const soc = parseFloat(bilInput);
    if (isNaN(soc) || soc < 0 || soc > 100) return;
    try {
      await fetch('/api/bil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soc }),
      });
      setBil({ soc, opdateret: new Date().toISOString() });
      setBilInput('');
      setBilGemt(true);
      setTimeout(() => setBilGemt(false), 3000);
    } catch (e) {}
  };

  if (!data) return (
    <div className="loading">
      <div className="spinner" />
      <p>Henter data...</p>
    </div>
  );

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Mikkelsen • {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <div className="header-right">
          <span className="clock">{tid}</span>
          <ZoneFarve zone={data.zone} />
        </div>
      </header>

      {override.aktiv && (
        <div className="override-banner">
          🚨 MANUEL OVERRIDE AKTIV — Tesla lader med 16A — Kører indtil manuelt stop
        </div>
      )}

      <div className="grid">
        <div className="card batteri-card">
          <BatteriRing pct={Math.round(data.batteri_soc)} />
          <div className="batteri-info">
            <div className="info-row">
              <span>Effekt</span>
              <span className={data.batteri_power > 0 ? 'pos' : data.batteri_power < 0 ? 'neg' : ''}>
                {data.batteri_power > 0 ? '↑' : data.batteri_power < 0 ? '↓' : '—'} {Math.abs(data.batteri_power)}W
              </span>
            </div>
            <div className="info-row">
              <span>Temperatur</span>
              <span>{data.batteri_temp}°C</span>
            </div>
            <div className="info-row">
              <span>Mode</span>
              <span className="mode">{data.growatt_mode.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-icon">☀️</div>
          <div className="card-value">{data.sol_power}<span className="unit">W</span></div>
          <div className="card-label">Sol produktion</div>
          <div className="card-bar">
            <div className="bar-fill sol" style={{ width: `${Math.min(100, (data.sol_power / 6000) * 100)}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card-icon">{data.grid_power > 0 ? '🔌' : '📤'}</div>
          <div className="card-value">{Math.abs(data.grid_power)}<span className="unit">W</span></div>
          <div className="card-label">{data.grid_power > 0 ? 'Køber fra net' : 'Sælger til net'}</div>
          <div className="card-bar">
            <div className="bar-fill net" style={{ width: `${Math.min(100, (Math.abs(data.grid_power) / 5000) * 100)}%` }} />
          </div>
        </div>

        <div className="card pris-card">
          <div className="card-icon">💰</div>
          <div className="card-value">{data.pris.toFixed(2)}<span className="unit"> kr/kWh</span></div>
          <div className="card-label">Nuværende pris</div>
          <ZoneFarve zone={data.zone} />
        </div>

        <div className="card tesla-card">
          <div className="card-icon">🚗</div>
          <div className="card-value tesla-status">{bil.soc}%</div>
          <div className="card-label">King kong — Tesla Model Y</div>
          {data.tesla_lad ? (
            <div className="lader-badge">⚡ LADER {data.tesla_amp}A</div>
          ) : (
            <div className="standby-badge">⏸ STANDBY</div>
          )}
          <div className={`naeste-ladning ${naesteLadning.harPlan ? '' : 'ingen-plan'}`}>
            {naesteLadning.harPlan
              ? `🕐 Næste ladning: ${naesteLadning.startTid} → ${naesteLadning.slutTid}`
              : `⏳ ${naesteLadning.besked}`}
          </div>
          {bil.opdateret && (
            <div style={{fontSize:'0.7rem', color:'#64748b', marginTop:'0.3rem'}}>
              Opdateret: {new Date(bil.opdateret).toLocaleTimeString('da-DK')}
            </div>
          )}
          <div className="bil-input-row">
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Bil % nu"
              value={bilInput}
              onChange={e => setBilInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && gemBilSoc()}
              className="bil-input"
            />
            <button onClick={gemBilSoc} className="bil-btn">
              {bilGemt ? '✅' : 'Gem'}
            </button>
          </div>
        </div>

        <div className="card override-card">
          <div className="card-icon">🎛️</div>
          <div className="card-label">Manuel styring</div>
          <button
            className={`override-btn ${override.aktiv ? 'override-aktiv' : ''}`}
            onClick={toggleOverride}
            disabled={overrideLoading}
          >
            {overrideLoading ? '...' : override.aktiv ? '⏹ Stop override' : '🚨 Tving ladning'}
          </button>
        </div>
      </div>

      <div style={{textAlign:"center",marginBottom:"1rem"}}>
        <Link href="/plan" className="nav-link">📅 Se ladeplan & strømpriser →</Link>
      </div>

      <footer>
        <span>Sidst opdateret: {new Date(data.timestamp).toLocaleTimeString('da-DK')}</span>
        <span>Opdaterer hvert 30. sekund</span>
      </footer>
    </div>
  );
}
