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

interface OpvaskemaskineData {
  apower: number;
  voltage: number;
  current: number;
  temp_c: number;
  output: boolean;
  dagens_kwh: number;
  timestamp: string;
}

interface UdendorsLysEnhed {
  state: boolean;
  brightness: number;
  linkquality: number;
}

interface UdendorsLysData {
  lys_carport: UdendorsLysEnhed;
  lys_terrasse: UdendorsLysEnhed;
  timestamp: string;
}

interface LysAutomatikData {
  sunrise: string | null;
  sunset: string | null;
  sidste_haendelse: { tid: string; beskrivelse: string } | null;
  timestamp: string;
}

interface LadeplanTime {
  time: string;
  pris: number;
}

interface LadeplanData {
  timer: LadeplanTime[];
  manglerKwh: number;
  timerNodvendige: number;
  bilTilsluttet: boolean;
  carSoc: number;
  deadline: string | null;
}

interface KalenderBegivenhed {
  summary: string;
  start: string;
  slut: string;
  heldag: boolean;
  lokation: string | null;
}

interface KalenderData {
  igangvaerende: KalenderBegivenhed[];
  kommende: KalenderBegivenhed[];
  opdateret: string | null;
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
  const [opvask, setOpvask] = useState<OpvaskemaskineData | null>(null);

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
    const hentOpvask = async () => {
      try {
        const res = await fetch('/api/opvaskemaskine');
        setOpvask(await res.json());
      } catch (e) {}
    };
    hentOpvask();
    const interval = setInterval(hentOpvask, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hentLys = async () => {
      try {
        const res = await fetch('/api/udendors-lys');
        const d: UdendorsLysData = await res.json();
        setUdendorsLys(d);
        setSliderVaerdi({ lys_carport: d.lys_carport.brightness, lys_terrasse: d.lys_terrasse.brightness });
      } catch (e) {}
    };
    hentLys();
    const interval = setInterval(hentLys, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hentAutomatik = async () => {
      try {
        const res = await fetch('/api/lys-automatik');
        setLysAutomatik(await res.json());
      } catch (e) {}
    };
    hentAutomatik();
    const interval = setInterval(hentAutomatik, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hentLadeplan = async () => {
      try {
        const res = await fetch('/api/ladeplan');
        setLadeplan(await res.json());
      } catch (e) {}
    };
    hentLadeplan();
    const interval = setInterval(hentLadeplan, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hentKalender = async () => {
      try {
        const res = await fetch('/api/kalender');
        setKalender(await res.json());
      } catch (e) {}
    };
    hentKalender();
    const interval = setInterval(hentKalender, 60000);
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

  const [opvaskLoading, setOpvaskLoading] = useState(false);
  const [udendorsLys, setUdendorsLys] = useState<UdendorsLysData | null>(null);
  const [lysLoading, setLysLoading] = useState<{ lys_carport: boolean; lys_terrasse: boolean }>({ lys_carport: false, lys_terrasse: false });
  const [sliderVaerdi, setSliderVaerdi] = useState<{ lys_carport: number; lys_terrasse: number }>({ lys_carport: 254, lys_terrasse: 254 });
  const [lysAutomatik, setLysAutomatik] = useState<LysAutomatikData | null>(null);
  const [ladeplan, setLadeplan] = useState<LadeplanData | null>(null);
  const [kalender, setKalender] = useState<KalenderData | null>(null);

  const toggleLys = async (sted: 'lys_carport' | 'lys_terrasse') => {
    if (!udendorsLys) return;
    setLysLoading(prev => ({ ...prev, [sted]: true }));
    try {
      await fetch('/api/udendors-lys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sted, state: !udendorsLys[sted].state }),
      });
      const res = await fetch('/api/udendors-lys');
      setUdendorsLys(await res.json());
    } catch (e) {}
    setLysLoading(prev => ({ ...prev, [sted]: false }));
  };

  const sendLysstyrke = async (sted: 'lys_carport' | 'lys_terrasse', vaerdi: number) => {
    try {
      await fetch('/api/udendors-lys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sted, brightness: vaerdi }),
      });
    } catch (e) {}
  };

  const toggleOpvask = async () => {
    if (!opvask) return;
    setOpvaskLoading(true);
    try {
      await fetch('/api/opvaskemaskine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: !opvask.output }),
      });
      const res = await fetch('/api/opvaskemaskine');
      setOpvask(await res.json());
    } catch (e) {}
    setOpvaskLoading(false);
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
            type="number" min="0" max="100" placeholder={String(bil.soc)}
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

      {/* Opvaskemaskine - live forbrug */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>🍽️ Opvaskemaskine</div>
        {opvask ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: opvask.apower > 5 ? '#22c55e' : opvask.output ? '#eab308' : '#475569',
                display: 'inline-block'
              }} />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {opvask.apower > 5 ? 'Kører' : opvask.output ? 'Tændt (standby)' : 'Slukket'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9' }}>{opvask.apower.toFixed(1)}</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '4px' }}>W</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              I dag: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{opvask.dagens_kwh.toFixed(2)} kWh</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {opvask.voltage.toFixed(0)} V · {opvask.current.toFixed(2)} A · {opvask.temp_c.toFixed(0)}°C
            </div>
            <button
              onClick={toggleOpvask}
              disabled={opvaskLoading}
              style={{
                marginLeft: 'auto', padding: '5px 14px', cursor: 'pointer', borderRadius: '8px',
                fontSize: '0.8rem', fontWeight: 600,
                border: opvask.output ? '1px solid #ef4444' : '1px solid #22c55e',
                background: opvask.output ? '#7f1d1d' : '#14532d',
                color: opvask.output ? '#fca5a5' : '#86efac',
              }}
            >
              {opvaskLoading ? '...' : opvask.output ? '⏻ Sluk' : '⏻ Tænd'}
            </button>
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '0.8rem' }}>Henter...</div>
        )}
      </div>

      {/* Arbejdskalender */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>📅 Kalender</div>
        {kalender ? (
          <div>
            {kalender.igangvaerende.length > 0 && (
              <div style={{
                background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: '8px',
                padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.8rem'
              }}>
                <span style={{ color: '#93c5fd', fontWeight: 600 }}>🔵 Lige nu: </span>
                <span style={{ color: '#dbeafe' }}>{kalender.igangvaerende[0].summary}</span>
                {kalender.igangvaerende[0].lokation && (
                  <span style={{ color: '#93c5fd' }}> · {kalender.igangvaerende[0].lokation}</span>
                )}
              </div>
            )}
            {kalender.kommende.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Ingen kommende begivenheder</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {kalender.kommende.map((b, i) => {
                  const start = new Date(b.start);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#cbd5e1' }}>
                        {b.summary}
                        {b.lokation && <span style={{ color: '#64748b' }}> · {b.lokation}</span>}
                      </span>
                      <span style={{ color: '#64748b', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                        {b.heldag
                          ? start.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
                          : start.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + start.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '0.8rem' }}>Henter...</div>
        )}
      </div>

      {/* Ladeplan - hvilke timer systemet forventer at lade i */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>🔋 Ladeplan</div>
        {ladeplan ? (
          !ladeplan.bilTilsluttet ? (
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>🚗 Bil ikke tilsluttet</div>
          ) : ladeplan.manglerKwh <= 0 ? (
            <div style={{ color: '#86efac', fontSize: '0.85rem' }}>✅ Bil allerede fuldt opladet ({ladeplan.carSoc}%)</div>
          ) : ladeplan.timer.length === 0 ? (
            <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>⚠️ Ingen billige timer fundet endnu (mangler {ladeplan.manglerKwh.toFixed(1)} kWh)</div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                {ladeplan.carSoc}% → 100% · mangler {ladeplan.manglerKwh.toFixed(1)} kWh · {ladeplan.timerNodvendige} planlagte timer
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ladeplan.timer.map((t, i) => {
                  const d = new Date(t.time);
                  return (
                    <div key={i} style={{
                      background: '#14532d', border: '1px solid #22c55e', borderRadius: '8px',
                      padding: '0.4rem 0.7rem', fontSize: '0.8rem'
                    }}>
                      <div style={{ color: '#86efac', fontWeight: 600 }}>
                        {d.toLocaleDateString('da-DK', { weekday: 'short' })} {d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ color: '#4ade80', fontSize: '0.75rem' }}>{t.pris.toFixed(2)} kr/kWh</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div style={{ color: '#475569', fontSize: '0.8rem' }}>Henter...</div>
        )}
      </div>

      {/* Udendørs lys - carport og terrasse */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>💡 Udendørs lys</div>
        {udendorsLys ? (
          <div className="two-col-responsive">
            {(['lys_carport', 'lys_terrasse'] as const).map(sted => (
              <div key={sted} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {sted === 'lys_carport' ? '🚗 Carport' : '🌳 Terrasse'}
                  </span>
                  <button
                    onClick={() => toggleLys(sted)}
                    disabled={lysLoading[sted]}
                    style={{
                      padding: '4px 12px', cursor: 'pointer', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                      border: udendorsLys[sted].state ? '1px solid #ef4444' : '1px solid #22c55e',
                      background: udendorsLys[sted].state ? '#7f1d1d' : '#14532d',
                      color: udendorsLys[sted].state ? '#fca5a5' : '#86efac',
                    }}
                  >
                    {lysLoading[sted] ? '...' : udendorsLys[sted].state ? 'Sluk' : 'Tænd'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: udendorsLys[sted].state ? '#22c55e' : '#475569',
                    display: 'inline-block'
                  }} />
                  <span style={{ fontSize: '0.75rem', color: udendorsLys[sted].state ? '#86efac' : '#64748b', fontWeight: 600 }}>
                    {udendorsLys[sted].state ? 'TÆNDT' : 'SLUKKET'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={254}
                  value={sliderVaerdi[sted]}
                  onChange={e => setSliderVaerdi(prev => ({ ...prev, [sted]: parseInt(e.target.value) }))}
                  onMouseUp={e => sendLysstyrke(sted, parseInt((e.target as HTMLInputElement).value))}
                  onTouchEnd={e => sendLysstyrke(sted, parseInt((e.target as HTMLInputElement).value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Lysstyrke: {Math.round((sliderVaerdi[sted] / 254) * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '0.8rem' }}>Henter...</div>
        )}
        {lysAutomatik && (
          <div style={{
            marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid #1e293b',
            display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', fontSize: '0.75rem', color: '#64748b'
          }}>
            <span>🌅 Solopgang: <strong style={{ color: '#94a3b8' }}>{lysAutomatik.sunrise ?? '–'}</strong></span>
            <span>🌇 Solnedgang: <strong style={{ color: '#94a3b8' }}>{lysAutomatik.sunset ?? '–'}</strong></span>
            <span>🌙 Nat-stop: <strong style={{ color: '#94a3b8' }}>23:58</strong></span>
            <span>☀️ Morgen-tænd: <strong style={{ color: '#94a3b8' }}>05:30*</strong></span>
            {lysAutomatik.sidste_haendelse && (
              <span style={{ width: '100%' }}>
                Seneste automatik: <strong style={{ color: '#94a3b8' }}>{lysAutomatik.sidste_haendelse.beskrivelse}</strong>
                {' '}kl. {new Date(lysAutomatik.sidste_haendelse.tid).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span style={{ width: '100%', fontSize: '0.65rem', color: '#475569' }}>
              *springes over hvis solen allerede er stået op
            </span>
          </div>
        )}
      </div>

      {/* Begivenheder — kompakt enkelt kort */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div className="two-col-responsive">
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
