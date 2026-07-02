'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import EnergiFlow from './components/EnergiFlow';

interface EnergiData {
  batteri_soc: number;
  sol_power: number;
  grid_power: number;
  batteri_power: number;
  batteri_temp: number;
  discharge_rate: number;
  tesla_lad: number;
  tesla_amp: number;
  load_power: number;
  pris: number;
  zone: string;
  growatt_mode: string;
  timestamp: string;
  spotpris?: number;
}

interface BilData {
  soc: number;
  opdateret: string | null;
}

interface NaesteLadning {
  harPlan: boolean;
  startTid?: string;
  slutTid?: string;
  startDato?: string;
  besked: string;
}

interface Begivenhed {
  tid: string;
  besked: string;
  minutter?: number;
}

interface Begivenheder {
  naeste: Begivenhed[];
  sidst: Begivenhed[];
}

interface Vejr {
  tekst: string;
  tempMin: number | null;
  tempMax: number | null;
  skyer: number | null;
  solPotentiale: string;
}

interface OverrideStatus {
  aktiv: boolean;
}

interface DagensTal {
  dagens_sol_kwh: number;
  dagens_load_kwh: number;
  dagens_grid_kob_kwh: number;
  dagens_grid_solgt_kwh: number;
  dagens_batteri_ud_kwh: number;
  dagens_batteri_ind_kwh: number;
  dagens_tesla_kwh: number;
  sparet_i_dag: number;
  selvforsyning_i_dag: number;
  dagens_grid_kob_kr: number;
}

function ZoneFarve({ zone }: { zone: string }) {
  if (zone === 'billig') return <span className="zone-billig">● BILLIG</span>;
  if (zone === 'dyr') return <span className="zone-dyr">● DYR</span>;
  if (zone === 'override') return <span className="zone-override">● OVERRIDE</span>;
  return <span className="zone-normal">● NORMAL</span>;
}

export default function Dashboard() {
  const [data, setData] = useState<EnergiData | null>(null);
  const [bil, setBil] = useState<BilData>({ soc: 50, opdateret: null });
  const [naesteLadning, setNaesteLadning] = useState<NaesteLadning>({ harPlan: false, besked: 'Henter...' });
  const [begivenheder, setBegivenheder] = useState<Begivenheder>({ naeste: [], sidst: [] });
  const [vejr, setVejr] = useState<Vejr>({ tekst: '', tempMin: null, tempMax: null, skyer: null, solPotentiale: '' });
  const [override, setOverride] = useState<OverrideStatus>({ aktiv: false });
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [bilInput, setBilInput] = useState('');
  const [bilGemt, setBilGemt] = useState(false);
  const [tid, setTid] = useState('');
  const [dagensTal, setDagensTal] = useState<DagensTal | null>(null);

  useEffect(() => {
    const hent = async () => {
      try {
        const [dataRes, overrideRes, bilRes, ladningRes, begivRes, vejrRes, statRes] = await Promise.all([
          fetch('/api/data'),
          fetch('/api/override'),
          fetch('/api/bil'),
          fetch('/api/naeste-ladning'),
          fetch('/api/begivenheder'),
          fetch('/api/vejr'),
          fetch('/api/dagens-tal'),
        ]);
        setData(await dataRes.json());
        setOverride(await overrideRes.json());
        setBil(await bilRes.json());
        setNaesteLadning(await ladningRes.json());
        setBegivenheder(await begivRes.json());
        setVejr(await vejrRes.json());
        setDagensTal(await statRes.json());
      } catch (e) {}
    };
    hent();
    const interval = setInterval(hent, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTid(new Date().toLocaleTimeString('da-DK')), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleOverride = async () => {
    setOverrideLoading(true);
    try {
      await fetch('/api/override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktiv: !override.aktiv }) });
      const res = await fetch('/api/override');
      setOverride(await res.json());
    } catch (e) {}
    setOverrideLoading(false);
  };

  const gemBilSoc = async () => {
    const soc = parseFloat(bilInput);
    if (isNaN(soc) || soc < 0 || soc > 100) return;
    try {
      await fetch('/api/bil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ soc }) });
      setBil({ soc, opdateret: new Date().toISOString() });
      setBilInput('');
      setBilGemt(true);
      setTimeout(() => setBilGemt(false), 3000);
    } catch (e) {}
  };

  if (!data) return <div className="loading"><div className="spinner" /><p>Henter data...</p></div>;

  return (
    <div className="dashboard">

      {/* Header */}
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

      {/* Kompakt kontrol-bjælke */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px',
        padding: '0.6rem 1rem', marginBottom: '1rem'
      }}>
        {/* Tesla SOC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🚗</span>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>King Kong</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6' }}>{bil.soc}%</span>
          {data.tesla_lad ? (
            <span style={{ fontSize: '0.75rem', background: '#1d4ed8', color: '#93c5fd', padding: '2px 8px', borderRadius: '6px' }}>⚡ LADER {data.tesla_amp}A</span>
          ) : (
            <span style={{ fontSize: '0.75rem', background: '#1e293b', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>⏸ STANDBY</span>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: '#1e293b' }} />

        {/* Næste ladning */}
        <div style={{ fontSize: '0.8rem', color: naesteLadning.harPlan ? '#22c55e' : '#64748b', flex: 1, minWidth: '200px' }}>
          {naesteLadning.harPlan
            ? `🕐 ${naesteLadning.startTid} → ${naesteLadning.slutTid} (${naesteLadning.startDato || ''})`
            : `⏳ ${naesteLadning.besked}`}
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: '#1e293b' }} />

        {/* Bil % input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Opdater bil %</span>
          <input
            type="number" min="0" max="100" placeholder="76"
            value={bilInput}
            onChange={e => setBilInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && gemBilSoc()}
            style={{
              width: '60px', padding: '4px 8px', background: '#1e293b', border: '1px solid #334155',
              borderRadius: '8px', color: '#f1f5f9', fontSize: '0.85rem', textAlign: 'center'
            }}
          />
          <button onClick={gemBilSoc} style={{
            padding: '4px 12px', background: bilGemt ? '#166534' : '#1d4ed8',
            border: 'none', borderRadius: '8px', color: 'white', fontSize: '0.8rem', cursor: 'pointer'
          }}>
            {bilGemt ? '✅' : 'Gem'}
          </button>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '24px', background: '#1e293b' }} />

        {/* Override knap */}
        <button
          onClick={toggleOverride}
          disabled={overrideLoading}
          style={{
            padding: '5px 14px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
            border: override.aktiv ? '1px solid #ef4444' : '1px solid #334155',
            background: override.aktiv ? '#7f1d1d' : '#1e293b',
            color: override.aktiv ? '#fca5a5' : '#94a3b8',
          }}
        >
          {overrideLoading ? '...' : override.aktiv ? '⏹ Stop override' : '🚨 Tving ladning'}
        </button>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
          <Link href="/plan" style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', padding: '4px 8px', background: '#1e293b', borderRadius: '6px' }}>📅 Plan</Link>
          <Link href="/statistik" style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', padding: '4px 8px', background: '#1e293b', borderRadius: '6px' }}>📊 Statistik</Link>
          <Link href="/grafer" style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', padding: '4px 8px', background: '#1e293b', borderRadius: '6px' }}>📈 Grafer</Link>
          <Link href="/log" style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', padding: '4px 8px', background: '#1e293b', borderRadius: '6px' }}>📋 Log</Link>
        </div>
      </div>

      {override.aktiv && (
        <div className="override-banner">
          🚨 MANUEL OVERRIDE AKTIV — Tesla lader med 16A — Kører indtil manuelt stop
        </div>
      )}

      {/* Live energiflow */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>⚡ Live energiflow</div>
        <EnergiFlow data={data} dagensTal={dagensTal} vejr={vejr} />
      </div>

      {/* Begivenheder — kompakt enkelt kort */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.4rem' }}>⏰ Næste begivenheder</div>
            {begivenheder.naeste.length > 0 ? begivenheder.naeste.map((b, i) => (
              <div key={i} className="begivenhed-række">
                <span className="begivenhed-tid">{b.tid}</span>
                <span className="begivenhed-besked">{b.besked}</span>
                {b.minutter && <span className="begivenhed-minutter">om {b.minutter}m</span>}
              </div>
            )) : <div style={{ color: '#475569', fontSize: '0.8rem' }}>Ingen planlagte begivenheder</div>}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>📋 Senest</div>
            {begivenheder.sidst.map((b, i) => (
              <div key={i} className="begivenhed-række">
                <span className="begivenhed-tid">{b.tid}</span>
                <span className="begivenhed-besked">{b.besked}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer>
        <span>Sidst opdateret: {new Date(data.timestamp).toLocaleTimeString('da-DK')}</span>
        <span>Opdaterer hvert 30. sekund</span>
      </footer>
    </div>
  );
}
