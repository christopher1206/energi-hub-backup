'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Event {
  tid: string;
  type: string;
  beskrivelse: string;
}

const typeIkon: Record<string, string> = {
  discharge_skift: '🔋',
  tesla_ladning: '🚗',
  override: '🚨',
  alarm: '⚠️',
  system: '⚡',
};

const typeFarve: Record<string, string> = {
  discharge_skift: '#3b82f6',
  tesla_ladning: '#22c55e',
  override: '#ef4444',
  alarm: '#f59e0b',
  system: '#94a3b8',
};

export default function LogSide() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');

  useEffect(() => {
    const hent = async () => {
      try {
        const res = await fetch('/api/events');
        setEvents(await res.json());
      } catch (e) {}
      setLoading(false);
    };
    hent();
    const i = setInterval(hent, 60000);
    return () => clearInterval(i);
  }, []);

  const filtrerede = filter === 'alle' 
    ? events 
    : events.filter(e => e.type === filter);

  return (
    <div className="dashboard">
      <header>
        <div className="header-left">
          <h1>⚡ Energi Hub</h1>
          <span className="subtitle">Hændelseslog</span>
        </div>
        <div className="header-right">
          <Link href="/" className="nav-link">← Live overblik</Link>
        </div>
      </header>

      {/* Filter knapper */}
      <div className="periode-valg">
        {['alle', 'discharge_skift', 'tesla_ladning', 'override', 'alarm'].map(f => (
          <button
            key={f}
            className={`periode-btn ${filter === f ? 'aktiv' : ''}`}
            onClick={() => setFilter(f)}
          >
            {typeIkon[f] || '📋'} {f === 'alle' ? 'Alle' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/><p>Henter log...</p></div>
      ) : filtrerede.length === 0 ? (
        <div style={{textAlign:'center', color:'#64748b', padding:'2rem'}}>
          Ingen hændelser endnu
        </div>
      ) : (
        <div className="log-liste">
          {filtrerede.map((e, i) => {
            const dato = new Date(e.tid);
            return (
              <div key={i} className="log-række">
                <div className="log-ikon" style={{color: typeFarve[e.type] || '#94a3b8'}}>
                  {typeIkon[e.type] || '📋'}
                </div>
                <div className="log-indhold">
                  <div className="log-besked">{e.beskrivelse}</div>
                  <div className="log-tid">
                    {dato.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })} kl. {dato.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="log-type" style={{color: typeFarve[e.type] || '#94a3b8'}}>
                  {e.type.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{textAlign:"center", marginBottom:"1rem"}}>
        <Link href="/" className="nav-link">← Live overblik</Link>
      </div>

      <footer>
        <span>Gemmer op til 30 dages historik</span>
        <span>Opdateres hvert minut</span>
      </footer>
    </div>
  );
}
