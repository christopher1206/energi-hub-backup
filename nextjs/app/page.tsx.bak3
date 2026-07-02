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

  const dataWithPris = { ...data };

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

      {/* Live energiflow — fylder hele bredden */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>⚡ Live energiflow</div>
        <EnergiFlow data={dataWithPris} dagensTal={dagensTal} vejr={vejr} />
      </div>

      {/* Kompakt info-række under flow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Begivenheder */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>⏰ Næste begivenheder</div>
          {begivenheder.naeste.length > 0 ? begivenheder.naeste.map((b, i) => (
            <div key={i} className="begivenhed-række">
              <span className="begivenhed-tid">{b.tid}</span>
              <span className="begivenhed-besked">{b.besked}</span>
              {b.minutter && <span className="begivenhed-minutter">om {b.minutter}m</span>}
            </div>
          )) : <div style={{ color: '#475569', fontSize: '0.8rem' }}>Ingen planlagte begivenheder</div>}
          {begivenheder.sidst.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', margin: '0.5rem 0 0.25rem' }}>📋 Senest</div>
              {begivenheder.sidst.map((b, i) => (
                <div key={i} className="begivenhed-række">
                  <span className="begivenhed-tid">{b.tid}</span>
                  <span className="begivenhed-besked">{b.besked}</span>
                </div>
              ))}
            </>
          )}
          {/* Growatt status */}
          <div style={{ borderTop: '1px solid #1e293b', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <div className="info-row"><span>Mode</span><span className="mode">{data.growatt_mode.replace(/_/g, ' ')}</span></div>
            <div className="info-row"><span>Temp</span><span>{data.batteri_temp}°C</span></div>
            <div className="info-row"><span>Discharge</span><span>{data.discharge_rate}%</span></div>
          </div>
        </div>

        {/* Tesla */}
        <div className="card tesla-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>🚗 King Kong — Tesla Model Y</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{bil.soc}%</div>
          {data.tesla_lad ? (
            <div className="lader-badge">⚡ LADER {data.tesla_amp}A</div>
          ) : (
            <div className="standby-badge">⏸ STANDBY</div>
          )}
          <div className={`naeste-ladning ${naesteLadning.harPlan ? '' : 'ingen-plan'}`} style={{ marginTop: '0.5rem' }}>
            {naesteLadning.harPlan
              ? `🕐 ${naesteLadning.startTid} → ${naesteLadning.slutTid} (${naesteLadning.startDato || ''})`
              : `⏳ ${naesteLadning.besked}`}
          </div>
          {bil.opdateret && (
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.3rem' }}>
              Opdateret: {new Date(bil.opdateret).toLocaleTimeString('da-DK')}
            </div>
          )}
          <div className="bil-input-row" style={{ marginTop: '0.75rem' }}>
            <input
              type="number" min="0" max="100" placeholder="Bil % nu"
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

        {/* Override + navigation */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>🎛️ Manuel styring</div>
          <button
            className={`override-btn ${override.aktiv ? 'override-aktiv' : ''}`}
            onClick={toggleOverride}
            disabled={overrideLoading}
            style={{ width: '100%' }}
          >
            {overrideLoading ? '...' : override.aktiv ? '⏹ Stop override' : '🚨 Tving ladning'}
          </button>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link href="/plan" className="nav-link" style={{ textAlign: 'center' }}>📅 Ladeplan & priser</Link>
            <Link href="/statistik" className="nav-link" style={{ textAlign: 'center' }}>📊 Statistik</Link>
            <Link href="/grafer" className="nav-link" style={{ textAlign: 'center' }}>📈 Grafer</Link>
            <Link href="/log" className="nav-link" style={{ textAlign: 'center' }}>📋 Hændelseslog</Link>
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
