import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function Analytics() {
  const [stats, setStats] = useState({ 
    totalQueries: 0, 
    sessionSpend: 0, 
    budgetPct: 0, 
    logs: [] 
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('hindsight_token');
        const [statsRes, analyticsRes] = await Promise.all([
          fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/analytics', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (statsRes.ok && analyticsRes.ok) {
          const statsData = await statsRes.json();
          const analyticsData = await analyticsRes.json();
          
          setStats({
            totalQueries: statsData.totalQueries || statsData.total || 0,
            sessionSpend: statsData.session?.spend || 0,
            budgetPct: statsData.session?.budgetPct || 0,
            logs: analyticsData.logs || []
          });
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      }
    };
    
    fetchAnalytics();
  }, []);

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('hindsight_token');
      const res = await fetch('/api/analytics/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai_ops_report.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>
      
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1 flex flex-col w-full md:w-[calc(100%-16rem)] min-h-screen md:ml-64 relative z-10 transition-all p-lg pt-2 md:pt-lg overflow-y-auto custom-scrollbar">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-md bg-surface-container-lowest/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 w-full mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">monitoring</span>
            <span className="font-headline-lg-mobile text-primary font-bold">Analytics</span>
          </div>
          <button 
            onClick={() => setMobileOpen(true)}
            className="text-on-surface p-sm bg-white/5 rounded-lg active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        <div className="max-w-container-max mx-auto w-full">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-xl gap-md">
            <div>
              <h2 className="font-headline-xl text-headline-xl text-on-surface">Intelligence Analytics</h2>
              <p className="text-on-surface-variant font-body-md mt-sm">Real-time performance metrics and cost distribution for Hindsight AI Operations.</p>
            </div>
            <div className="flex gap-sm">
              <button className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface px-md py-sm rounded-lg flex items-center gap-sm transition-all border border-white/5 cursor-pointer">
                <span className="material-symbols-outlined text-body-md">calendar_today</span>
                <span className="font-label-mono text-label-mono">Live Session</span>
              </button>
              <button onClick={handleExport} className="bg-primary hover:bg-primary-container text-on-primary px-md py-sm rounded-lg flex items-center gap-sm transition-all font-label-mono text-label-mono shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-95">
                <span className="material-symbols-outlined text-body-md">download</span> Export Report
              </button>
            </div>
          </div>

          {/* KPI Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
            <div className="glass-card p-lg rounded-xl">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary glow-indigo">hub</span>
              </div>
              <p className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest">Total Queries</p>
              <h3 className="text-headline-lg font-headline-lg mt-xs">{stats.totalQueries}</h3>
            </div>
            
            <div className="glass-card p-lg rounded-xl">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-secondary glow-cyan">payments</span>
              </div>
              <p className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest">Session Cost</p>
              <h3 className="text-headline-lg font-headline-lg mt-xs">${stats.sessionSpend.toFixed(2)}</h3>
            </div>
            
            <div className="glass-card p-lg rounded-xl">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-tertiary-container glow-red">account_balance_wallet</span>
              </div>
              <p className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest">Budget Used</p>
              <h3 className="text-headline-lg font-headline-lg mt-xs">{stats.budgetPct}%</h3>
            </div>
            
            <div className="glass-card p-lg rounded-xl">
              <div className="flex justify-between items-start mb-md">
                <span className="material-symbols-outlined text-primary glow-indigo">speed</span>
                <span className="text-outline font-label-mono text-[10px] bg-white/5 px-sm py-1 rounded-full border border-white/10">Stable</span>
              </div>
              <p className="text-on-surface-variant font-label-mono text-label-mono uppercase tracking-widest">Avg Latency</p>
              <h3 className="text-headline-lg font-headline-lg mt-xs">~120ms</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
            {/* Chart Placeholder */}
            <div className="lg:col-span-2 glass-card rounded-xl p-lg flex flex-col min-h-[400px]">
              <h3 className="font-label-mono text-label-mono text-outline uppercase tracking-widest mb-md">Query Volume vs Cost</h3>
              <div className="flex-1 flex items-center justify-center border border-white/5 rounded-lg bg-surface-container-highest/20">
                 <span className="text-outline flex items-center gap-sm"><span className="material-symbols-outlined animate-pulse">monitoring</span> Data visualization loading...</span>
              </div>
            </div>
            
            {/* Logs List */}
            <div className="glass-card rounded-xl p-lg flex flex-col">
              <h3 className="font-label-mono text-label-mono text-outline uppercase tracking-widest mb-md">Recent Operations</h3>
              <div className="flex-1 space-y-md overflow-y-auto hide-scrollbar max-h-[400px]">
                {stats.logs.length === 0 ? <p className="text-outline">No recent operations.</p> : stats.logs.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="p-sm bg-surface-container-high/40 rounded-lg border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="font-label-mono text-[11px] text-primary">OP-{idx}</div>
                      <div className="text-body-sm text-outline mt-xs truncate max-w-[150px]">{item.category} Query</div>
                    </div>
                    <div className="text-right">
                      <div className="font-label-mono text-[10px] text-on-surface-variant">{item.model}</div>
                      <div className="text-body-sm text-secondary">${item.costUSD?.toFixed(4)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
