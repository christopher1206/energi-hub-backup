'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

  if (loading) return <div className="loading"><div className="spinner"/><p>Henter statistik...</p></div>;
  if (!data) return <div className="loading"><p>Ingen data</p></div>;

  const teslaKwh = parseFloat((data.go_e_wh_total / 1000).toFixed(1));
  const nettoGrid = parseFloat((data.grid_energy_out - data.grid_energy_in).toFixed(2));

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Statistik & Besparelser</span>
        </div>
        <div className="header-right">
          <Link href="/" className="nav-link">← Live overblik</Link>
        </div>
      </header>

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

      {/* Sol */}
      <div className="stat-sektion">
        <h2>☀️ Sol produktion</h2>
        <div className="stat-grid">
          <StatKort icon="☀️" titel="Produceret total" value={data.pv_energy_total.toFixed(2)} unit=" kWh" farve="#f59e0b" />
          <StatKort icon="⚡" titel="Sol nu" value={data.sol_power_nu} unit=" W" farve="#f59e0b" />
          <StatKort icon="🏠" titel="Hus forbrug total" value={data.load_energy_total.toFixed(2)} unit=" kWh" />
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
          <StatKort icon="⚡" titel="Total ladet via go-e" value={teslaKwh} unit=" kWh" farve="#3b82f6" />
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
