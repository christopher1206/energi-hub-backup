'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PeriodeData {
  periode: string;
  koekken_temp_gennemsnit: number | null;
  koekken_temp_min: number | null;
  koekken_temp_max: number | null;
  koekken_fugt_gennemsnit: number | null;
  sol_kwh: number;
  load_kwh: number;
  grid_kob_kwh: number;
  grid_solgt_kwh: number;
  batteri_ud_kwh: number;
  batteri_ind_kwh: number;
  tesla_kwh: number;
  grid_kob_kr: number;
  sparet: number;
  selvforsyning: number;
  timestamp: string;
}

interface StatData {
  pv_energy_total: number;
  sol_power_nu: number;
  grid_energy_in: number;
  grid_energy_out: number;
  grid_power_nu: number;
  load_energy_total: number;
  load_power_nu: number;
  battery_energy_in: number;
  battery_energy_out: number;
  batteri_soc: number;
  car_soc: number;
  go_e_wh_total: number;
  go_e_amp: number;
  go_e_car: number;
  sparet_total: number;
  selvforsyning: number;
  pris_nu: number;
  timestamp: string;
}

interface ApparatForbrug {
  navn: string;
  icon: string;
  kwh: number;
}

interface SalgMaaned { solgt_kwh: number; indtjent_kr: number; gns_pris: number; maaned: string; }

function StatKort({ icon, titel, value, unit, farve }: { icon: string; titel: string; value: string | number; unit?: string; farve?: string }) {
  return (
    <div className="stat-kort">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color: farve || '#f1f5f9' }}>
        {value}<span className="stat-unit">{unit}</span>
      </div>
      <div className="stat-label">{titel}</div>
    </div>
  );
}

export default function StatistikSide() {
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState<'time' | 'dag' | 'uge' | 'maaned' | 'aar'>('dag');
  const [periodeData, setPeriodeData] = useState<PeriodeData | null>(null);
  const [periodeLoading, setPeriodeLoading] = useState(false);
  const [apparater, setApparater] = useState<ApparatForbrug[]>([]);
  const [salg, setSalg] = useState<SalgMaaned | null>(null);

  useEffect(() => {
    const hent = async () => {
      try {
        const res = await fetch('/api/statistik');
        setData(await res.json());
      } catch (e) {}
      setLoading(false);
    };
    hent();
    const i = setInterval(hent, 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const hentPeriode = async () => {
      setPeriodeLoading(true);
      try {
        const res = await fetch(`/api/statistik-periode?periode=${periode}`);
        setPeriodeData(await res.json());
      } catch (e) {}
      setPeriodeLoading(false);
    };
    hentPeriode();
    const i = setInterval(hentPeriode, 60000);
    return () => clearInterval(i);
  }, [periode]);

  useEffect(() => {
    const hentApparater = async () => {
      try {
        const res = await fetch('/api/apparat-forbrug');
        const d = await res.json();
        setApparater(d.apparater || []);
      } catch (e) {}
    };
    hentApparater();
    const i = setInterval(hentApparater, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const hentSalg = async () => {
      try { const r = await fetch('/api/salg-maaned'); const d = await r.json(); if (!d.fejl) setSalg(d); } catch (e) {}
    };
    hentSalg();
    const i = setInterval(hentSalg, 60000);
    return () => clearInterval(i);
  }, []);

  if (loading) return <div className="loading"><div className="spinner"/><p>Henter statistik...</p></div>;
  if (!data) return <div className="loading"><p>Ingen data</p></div>;

  const teslaKwh = parseFloat((data.go_e_wh_total / 1000).toFixed(1));
  const nettoGrid = parseFloat((data.grid_energy_out - data.grid_energy_in).toFixed(2));

  return (
    <div className="dashboard stat-compact">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Statistik & Besparelser</span>
        </div>
        <div className="header-right">
          <Link href="/" className="nav-link">← Live overblik</Link>
        </div>
      </header>

      {/* Periode-oversigt */}
      <div className="stat-sektion">
        <h2>📅 Periode-oversigt</h2>
        <div className="periode-valg">
          {(['time', 'dag', 'uge', 'maaned', 'aar'] as const).map((p) => (
            <button
              key={p}
              className={`periode-btn ${periode === p ? 'aktiv' : ''}`}
              onClick={() => setPeriode(p)}
            >
              {{ time: 'Time', dag: 'Dag', uge: 'Uge', maaned: 'Måned', aar: 'År' }[p]}
            </button>
          ))}
        </div>

        {periodeLoading && !periodeData ? (
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Henter...</div>
        ) : periodeData ? (
          <div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Bemærk: længere perioder (uge/måned/år) kan vise ufuldstændige tal indtil systemet har indsamlet data i hele perioden.
            </div>
            <div className="stat-grid">
              <StatKort icon="☀️" titel="Sol produceret" value={periodeData.sol_kwh} unit=" kWh" farve="#f59e0b" />
              <StatKort icon="🏠" titel="Hus forbrug" value={periodeData.load_kwh} unit=" kWh" />
              <StatKort icon="🔌" titel="Købt fra net" value={periodeData.grid_kob_kwh} unit=" kWh" farve="#ef4444" />
              <StatKort icon="📤" titel="Solgt til net" value={periodeData.grid_solgt_kwh} unit=" kWh" farve="#22c55e" />
              <StatKort icon="⬆️" titel="Batteri ladet ind" value={periodeData.batteri_ind_kwh} unit=" kWh" farve="#22c55e" />
              <StatKort icon="⬇️" titel="Batteri afladet" value={periodeData.batteri_ud_kwh} unit=" kWh" farve="#f59e0b" />
              <StatKort icon="🚗" titel="Tesla ladet" value={periodeData.tesla_kwh} unit=" kWh" farve="#3b82f6" />
              <StatKort icon="💰" titel="Betalt for strøm" value={periodeData.grid_kob_kr} unit=" kr" farve="#ef4444" />
              <StatKort icon="💵" titel="Sparet (est.)" value={periodeData.sparet} unit=" kr" farve="#22c55e" />
              <StatKort icon="📊" titel="Selvforsyning" value={periodeData.selvforsyning} unit="%" farve="#22c55e" />
              {periodeData.koekken_temp_gennemsnit !== null && (
                <StatKort icon="🌡️" titel="Køkken temp (snit)" value={periodeData.koekken_temp_gennemsnit} unit="°C" farve="#f97316" />
              )}
              {periodeData.koekken_temp_min !== null && periodeData.koekken_temp_max !== null && (
                <StatKort icon="📈" titel="Køkken temp min/max" value={`${periodeData.koekken_temp_min}-${periodeData.koekken_temp_max}`} unit="°C" />
              )}
              {periodeData.koekken_fugt_gennemsnit !== null && (
                <StatKort icon="💧" titel="Køkken fugt (snit)" value={periodeData.koekken_fugt_gennemsnit} unit="%" farve="#38bdf8" />
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Ingen data tilgængelig</div>
        )}
      </div>

      {/* Besparelser */}
      <div className="stat-sektion">
        <h2>💰 Besparelser</h2>
        <div className="stat-grid">
          <StatKort icon="💰" titel="Sparet total (est.)" value={data.sparet_total} unit=" kr" farve="#22c55e" />
          <StatKort icon="📊" titel="Selvforsyningsgrad" value={data.selvforsyning} unit="%" farve="#22c55e" />
          <StatKort icon="💡" titel="Nuværende pris" value={data.pris_nu.toFixed(2)} unit=" kr/kWh" />
          <StatKort icon="📤" titel="Netto salg til net" value={nettoGrid} unit=" kWh" farve={nettoGrid > 0 ? '#22c55e' : '#ef4444'} />
        </div>
      </div>

      {/* Apparat-forbrug (plugs) */}
      {apparater.length > 0 && (
        <div className="stat-sektion">
          <h2>🔌 Apparat-forbrug i dag</h2>
          <div className="stat-grid">
            {apparater.map((a) => (
              <StatKort key={a.navn} icon={a.icon} titel={a.navn} value={a.kwh.toFixed(2)} unit=" kWh" farve="#38bdf8" />
            ))}
          </div>
        </div>
      )}

      {/* Salg af strøm */}
      {salg && (
        <div className="stat-sektion">
          <h2>💰 Salg af strøm ({salg.maaned})</h2>
          <div className="stat-grid">
            <StatKort icon="💰" titel="Indtjent" value={salg.indtjent_kr.toFixed(2)} unit=" kr" farve="#22c55e" />
            <StatKort icon="📤" titel="Solgt" value={salg.solgt_kwh.toFixed(1)} unit=" kWh" farve="#38bdf8" />
            <StatKort icon="🏷️" titel="Gns. salgspris" value={salg.gns_pris.toFixed(2)} unit=" kr/kWh" farve="#eab308" />
          </div>
        </div>
      )}

      {/* Sol */}
      <div className="stat-sektion">
        <h2>☀️ Sol produktion</h2>
        <div className="stat-grid">
          <StatKort icon="☀️" titel="Produceret i alt (levetid)" value={data.pv_energy_total.toFixed(2)} unit=" kWh" farve="#f59e0b" />
          <StatKort icon="⚡" titel="Sol nu" value={data.sol_power_nu} unit=" W" farve="#f59e0b" />
          <StatKort icon="🏠" titel="Hus forbrug i alt (levetid)" value={data.load_energy_total.toFixed(2)} unit=" kWh" />
          <StatKort icon="🔌" titel="Hus forbrug nu" value={data.load_power_nu} unit=" W" />
        </div>
      </div>

      {/* Net */}
      <div className="stat-sektion">
        <h2>🔌 Net forbrug</h2>
        <div className="stat-grid">
          <StatKort icon="🔌" titel="Købt fra net" value={data.grid_energy_in.toFixed(2)} unit=" kWh" farve="#ef4444" />
          <StatKort icon="📤" titel="Solgt til net" value={data.grid_energy_out.toFixed(2)} unit=" kWh" farve="#22c55e" />
          <StatKort icon="⚡" titel="Net nu" value={Math.abs(data.grid_power_nu)} unit=" W" farve={data.grid_power_nu < 0 ? '#22c55e' : '#ef4444'} />
          <StatKort icon="📊" titel="Status" value={data.grid_power_nu < 0 ? 'Sælger' : 'Køber'} farve={data.grid_power_nu < 0 ? '#22c55e' : '#ef4444'} />
        </div>
      </div>

      {/* Batteri */}
      <div className="stat-sektion">
        <h2>🔋 Growatt Batteri</h2>
        <div className="stat-grid">
          <StatKort icon="🔋" titel="SOC nu" value={data.batteri_soc} unit="%" farve={data.batteri_soc > 50 ? '#22c55e' : '#f59e0b'} />
          <StatKort icon="⬆️" titel="Ladet ind" value={data.battery_energy_in.toFixed(2)} unit=" kWh" farve="#22c55e" />
          <StatKort icon="⬇️" titel="Afladet ud" value={data.battery_energy_out.toFixed(2)} unit=" kWh" farve="#f59e0b" />
          <StatKort icon="⚖️" titel="Netto batteri" value={(data.battery_energy_in - data.battery_energy_out).toFixed(2)} unit=" kWh" />
        </div>
      </div>

      {/* Tesla */}
      <div className="stat-sektion">
        <h2>🚗 King kong — Tesla Model Y</h2>
        <div className="stat-grid">
          <StatKort icon="🔋" titel="Bil batteri" value={data.car_soc} unit="%" farve={data.car_soc > 50 ? '#22c55e' : '#ef4444'} />
          <StatKort icon="⚡" titel="Ladet i alt via go-e (levetid)" value={teslaKwh} unit=" kWh" farve="#3b82f6" />
          <StatKort icon="🔌" titel="Ladestrøm nu" value={data.go_e_car > 1 ? `${data.go_e_amp}A` : 'Ikke tilsluttet'} farve={data.go_e_car > 1 ? '#22c55e' : '#64748b'} />
          <StatKort icon="💰" titel="Ladet for (est.)" value={(teslaKwh * 0.80).toFixed(0)} unit=" kr" farve="#3b82f6" />
        </div>
      </div>

      <div style={{textAlign:"center", marginBottom:"1rem", display:"flex", gap:"1rem", justifyContent:"center"}}>
        <Link href="/" className="nav-link">← Live overblik</Link>
        <Link href="/plan" className="nav-link">📅 Ladeplan →</Link>
      </div>

      <footer>
        <span>Sidst opdateret: {new Date(data.timestamp).toLocaleTimeString('da-DK')}</span>
        <span>Opdaterer hvert 30. sekund</span>
      </footer>
    </div>
  );
}
