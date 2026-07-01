'use client';

import { useEffect, useState, useRef } from 'react';

interface EnergiData {
  sol_power: number;
  grid_power: number;
  batteri_power: number;
  batteri_soc: number;
  load_power: number;
  tesla_lad: number;
  tesla_amp: number;
  pris: number;
  zone: string;
  batteri_temp: number;
  discharge_rate: number;
  growatt_mode: string;
  spotpris?: number;
}

interface DagensTal {
  dagens_sol_kwh: number;
  dagens_load_kwh: number;
  dagens_grid_kob_kwh: number;
  dagens_grid_solgt_kwh: number;
  dagens_batteri_ind_kwh: number;
  dagens_batteri_ud_kwh: number;
  dagens_tesla_kwh: number;
  dagens_grid_kob_kr: number;
  sparet_i_dag: number;
  selvforsyning_i_dag: number;
}

interface Vejr {
  tekst: string;
  tempMin: number | null;
  tempMax: number | null;
  skyer: number | null;
  solPotentiale: string;
}

interface Partikel { id: number; progress: number; speed: number; }

function usePartikler(aktiv: boolean, watt: number) {
  const [partikler, setPartikler] = useState<Partikel[]>([]);
  const animRef = useRef<number>(0);
  const partRef = useRef<Partikel[]>([]);
  useEffect(() => {
    cancelAnimationFrame(animRef.current);
    if (!aktiv || watt < 10) { setPartikler([]); partRef.current = []; return; }
    const antal = Math.max(1, Math.min(6, Math.floor(watt / 500) + 1));
    partRef.current = Array.from({ length: antal }, (_, i) => ({ id: i, progress: i / antal, speed: 0.005 + Math.random() * 0.003 }));
    const animate = () => {
      partRef.current = partRef.current.map(p => ({ ...p, progress: (p.progress + p.speed) % 1 }));
      setPartikler([...partRef.current]);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [aktiv, Math.floor(watt / 500)]);
  return partikler;
}

function lerp(a: [number,number], b: [number,number], t: number): [number,number] {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
}

function Pil({ fra, til, watt, farve, aktiv }: { fra: [number,number]; til: [number,number]; watt: number; farve: string; aktiv: boolean; }) {
  const partikler = usePartikler(aktiv, watt);
  return (
    <g>
      <line x1={fra[0]} y1={fra[1]} x2={til[0]} y2={til[1]} stroke={farve} strokeWidth="2.5" strokeOpacity={aktiv ? 0.55 : 0.1} strokeDasharray={aktiv ? 'none' : '5,5'} />
      {aktiv && partikler.map(p => { const pos = lerp(fra, til, p.progress); return <circle key={p.id} cx={pos[0]} cy={pos[1]} r="5" fill={farve} opacity="0.95" />; })}
    </g>
  );
}

function WattLabel({ x, y, tekst, farve }: { x: number; y: number; tekst: string; farve: string; }) {
  return (
    <g>
      <rect x={x-24} y={y-11} width="48" height="16" rx="4" fill="#0f172a" fillOpacity="0.9" />
      <text x={x} y={y+2} textAnchor="middle" fontSize="10" fontWeight="700" fill={farve}>{tekst}</text>
    </g>
  );
}

function Node({ cx, cy, w, h, farve, aktiv, emoji, titel, vaerdi, stats }: {
  cx: number; cy: number; w: number; h: number;
  farve: string; aktiv: boolean;
  emoji: string; titel: string; vaerdi: string;
  stats: { label: string; value: string; farve?: string }[];
}) {
  const x = cx - w/2; const y = cy - h/2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill={aktiv ? `${farve}15` : '#0c1627'} stroke={aktiv ? farve : '#1e293b'} strokeWidth="1.5" />
      <text x={cx} y={y+22} textAnchor="middle" fontSize="20">{emoji}</text>
      <text x={cx} y={y+38} textAnchor="middle" fontSize="10" fill="#64748b">{titel}</text>
      <text x={cx} y={y+56} textAnchor="middle" fontSize="15" fontWeight="700" fill={aktiv ? farve : '#475569'}>{vaerdi}</text>
      <line x1={x+12} y1={y+63} x2={x+w-12} y2={y+63} stroke="#1e293b" strokeWidth="0.8" />
      {stats.map((s, i) => (
        <g key={i}>
          <text x={x+12} y={y+76+i*16} fontSize="9" fill="#475569">{s.label}</text>
          <text x={x+w-12} y={y+76+i*16} textAnchor="end" fontSize="9" fontWeight="600" fill={s.farve || '#94a3b8'}>{s.value}</text>
        </g>
      ))}
    </g>
  );
}

function InfoBar({ pris, spotpris, zone, vejr }: { pris: number; spotpris?: number; zone: string; vejr: Vejr }) {
  const zoneFarve = zone === 'billig' ? '#22c55e' : zone === 'dyr' ? '#ef4444' : '#f59e0b';
  const zoneEmoji = zone === 'billig' ? '💚' : zone === 'dyr' ? '🔴' : '🟡';
  return (
    <g>
      <rect x="10" y="8" width="780" height="36" rx="10" fill="#0c1627" stroke="#1e293b" strokeWidth="1" />
      <text x="28" y="30" fontSize="12" fontWeight="700" fill={zoneFarve}>{zoneEmoji} {pris.toFixed(2)} kr/kWh</text>
      {spotpris !== undefined && <text x="162" y="30" fontSize="10" fill="#475569">(spot: {spotpris.toFixed(2)})</text>}
      <text x="275" y="30" fontSize="11" fill="#2d3748">|</text>
      <text x="288" y="30" fontSize="11" fill="#64748b">{zone.toUpperCase()}</text>
      <text x="380" y="30" fontSize="11" fill="#2d3748">|</text>
      <text x="393" y="30" fontSize="11" fill="#64748b">🌤️ {vejr.tekst}</text>
      <text x="540" y="30" fontSize="11" fill="#64748b">{vejr.tempMin}–{vejr.tempMax}°C</text>
      <text x="625" y="30" fontSize="11" fill="#64748b">{vejr.skyer}% skyer</text>
    </g>
  );
}

export default function EnergiFlow({ data, dagensTal, vejr }: {
  data: EnergiData;
  dagensTal: DagensTal | null;
  vejr: Vejr;
}) {
  const { sol_power: sol, grid_power: grid, batteri_power: bat, batteri_soc: soc, load_power: load, tesla_lad: teslaLad, tesla_amp: teslaAmp, pris, zone } = data;
  const d = dagensTal;

  const solAktiv = sol > 50;
  const gridKobAktiv = grid > 50;
  const gridSolgtAktiv = grid < -50;
  const batLaderAktiv = bat > 50;
  const batAfladesAktiv = bat < -50;
  const teslaAktiv = teslaLad > 0;
  const teslaKw = (teslaAmp * 230 * 3 / 1000).toFixed(1);
  const batFarve = batLaderAktiv ? '#22c55e' : batAfladesAktiv ? '#f59e0b' : soc > 50 ? '#22c55e' : soc > 20 ? '#f59e0b' : '#ef4444';
  const gridFarve = gridKobAktiv ? '#ef4444' : '#22c55e';

  const SOL:   [number,number] = [150, 170];
  const NET:   [number,number] = [650, 170];
  const HUS:   [number,number] = [400, 290];
  const BAT:   [number,number] = [150, 415];
  const TESLA: [number,number] = [650, 415];

  const edge = (fra: [number,number], til: [number,number], m=75): [[number,number],[number,number]] => {
    const dx=til[0]-fra[0]; const dy=til[1]-fra[1]; const len=Math.sqrt(dx*dx+dy*dy);
    return [[fra[0]+dx/len*m, fra[1]+dy/len*m],[til[0]-dx/len*m, til[1]-dy/len*m]];
  };

  const [s2h_f, s2h_t] = edge(SOL, HUS);
  const [n2h_f, n2h_t] = edge(NET, HUS);
  const [h2n_f, h2n_t] = edge(HUS, NET);
  const [h2b_f, h2b_t] = edge(HUS, BAT);
  const [b2h_f, b2h_t] = edge(BAT, HUS);
  const [h2e_f, h2e_t] = edge(HUS, TESLA);

  const mid = (a: [number,number], b: [number,number]): [number,number] => [(a[0]+b[0])/2, (a[1]+b[1])/2];

  return (
    <svg viewBox="0 0 800 545" style={{ width: '100%', height: 'auto' }}>
      <InfoBar pris={pris} spotpris={data.spotpris} zone={zone} vejr={vejr} />

      <Pil fra={s2h_f} til={s2h_t} watt={sol} farve="#f59e0b" aktiv={solAktiv} />
      <Pil fra={n2h_f} til={n2h_t} watt={grid} farve="#ef4444" aktiv={gridKobAktiv} />
      <Pil fra={h2n_f} til={h2n_t} watt={Math.abs(grid)} farve="#22c55e" aktiv={gridSolgtAktiv} />
      <Pil fra={h2b_f} til={h2b_t} watt={bat} farve="#22c55e" aktiv={batLaderAktiv} />
      <Pil fra={b2h_f} til={b2h_t} watt={Math.abs(bat)} farve="#f59e0b" aktiv={batAfladesAktiv} />
      <Pil fra={h2e_f} til={h2e_t} watt={teslaAmp*230*3} farve="#3b82f6" aktiv={teslaAktiv} />

      {solAktiv && <WattLabel x={mid(SOL,HUS)[0]-20} y={mid(SOL,HUS)[1]-14} tekst={`${sol}W`} farve="#f59e0b" />}
      {gridKobAktiv && <WattLabel x={mid(NET,HUS)[0]+20} y={mid(NET,HUS)[1]-14} tekst={`${grid}W`} farve="#ef4444" />}
      {gridSolgtAktiv && <WattLabel x={mid(HUS,NET)[0]+20} y={mid(HUS,NET)[1]-14} tekst={`${Math.abs(grid)}W`} farve="#22c55e" />}
      {batLaderAktiv && <WattLabel x={mid(HUS,BAT)[0]-24} y={mid(HUS,BAT)[1]+12} tekst={`${bat}W`} farve="#22c55e" />}
      {batAfladesAktiv && <WattLabel x={mid(BAT,HUS)[0]-24} y={mid(BAT,HUS)[1]+12} tekst={`${Math.abs(bat)}W`} farve="#f59e0b" />}
      {teslaAktiv && <WattLabel x={mid(HUS,TESLA)[0]+24} y={mid(HUS,TESLA)[1]+12} tekst={`${teslaKw}kW`} farve="#3b82f6" />}

      <Node cx={SOL[0]} cy={SOL[1]} w={170} h={120} farve="#f59e0b" aktiv={solAktiv}
        emoji="☀️" titel="Sol produktion" vaerdi={`${sol} W`}
        stats={[
          { label: 'I dag', value: d ? `${d.dagens_sol_kwh} kWh` : '–', farve: '#f59e0b' },
        ]} />

      <Node cx={NET[0]} cy={NET[1]} w={170} h={135} farve={gridFarve} aktiv={gridKobAktiv || gridSolgtAktiv}
        emoji={gridSolgtAktiv ? '📤' : '🔌'} titel={gridKobAktiv ? 'Køber' : gridSolgtAktiv ? 'Sælger' : 'Net'}
        vaerdi={`${Math.abs(grid)} W`}
        stats={[
          { label: 'Købt i dag', value: d ? `${d.dagens_grid_kob_kwh} kWh` : '–', farve: '#ef4444' },
          { label: 'Solgt i dag', value: d ? `${d.dagens_grid_solgt_kwh} kWh` : '–', farve: '#22c55e' },
          { label: 'Betalt', value: d ? `${d.dagens_grid_kob_kr} kr` : '–', farve: '#f59e0b' },
        ]} />

      <Node cx={HUS[0]} cy={HUS[1]} w={180} h={140} farve="#8b5cf6" aktiv={true}
        emoji="🏠" titel="Hus forbrug" vaerdi={`${load} W`}
        stats={[
          { label: 'Forbrug i dag', value: d ? `${d.dagens_load_kwh} kWh` : '–', farve: '#8b5cf6' },
          { label: 'Selvforsyning', value: d ? `${d.selvforsyning_i_dag}%` : '–', farve: '#22c55e' },
          { label: 'Netto', value: d ? `${d.sparet_i_dag} kr` : '–', farve: d && d.sparet_i_dag >= 0 ? '#22c55e' : '#ef4444' },
        ]} />

      <Node cx={BAT[0]} cy={BAT[1]} w={170} h={150} farve={batFarve} aktiv={batLaderAktiv || batAfladesAktiv}
        emoji="🔋" titel={batLaderAktiv ? 'Lader' : batAfladesAktiv ? 'Aflader' : 'Batteri'}
        vaerdi={`${Math.round(soc)}%`}
        stats={[
          { label: 'Mode', value: data.growatt_mode.replace(/_/g,' '), farve: '#3b82f6' },
          { label: 'Discharge', value: `${data.discharge_rate}%`, farve: data.discharge_rate > 0 ? '#22c55e' : '#475569' },
          { label: 'Temp', value: `${data.batteri_temp}°C`, farve: '#94a3b8' },
          { label: 'Ind/Ud i dag', value: d ? `${d.dagens_batteri_ind_kwh}/${d.dagens_batteri_ud_kwh} kWh` : '–', farve: '#22c55e' },
        ]} />

      <Node cx={TESLA[0]} cy={TESLA[1]} w={170} h={120} farve="#3b82f6" aktiv={teslaAktiv}
        emoji="🚗" titel={teslaAktiv ? `Lader ${teslaAmp}A` : 'King Kong'}
        vaerdi={teslaAktiv ? `${teslaKw} kW` : 'Standby'}
        stats={[
          { label: 'Ladet i dag', value: d ? `${d.dagens_tesla_kwh} kWh` : '–', farve: '#3b82f6' },
        ]} />
    </svg>
  );
}
