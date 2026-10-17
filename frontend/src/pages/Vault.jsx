import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function Vault() {
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState({ total: 0, hits: '1.2k', recurrent: 0, orphaned: 14 });
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const res = await fetch('/api/memory', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hindsight_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          const formattedMemories = data.memories.map(m => ({
            id: `#MEM-${m.id}`,
            user: m.user || 'Unknown',
            time: m.date || 'Just now',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdZJ8wsbwYsuM_99J_i_E08ZkbrocV0gz5ft6N2ECgadbJ6SqMvWCU0iE_A6E1jSP285vDhScZH6htEaD6Gp9CWEjG_NX8K_gkdOXa_sC2UiKpxSAf5LenWmO3IsnSt_EdI-I0_C24Rd2yHsxSgMwcVxF5Cvd1EnFj1mUl8QA6kR5-1SZKjwnMFc7oeT5ykVnkoSQWERE85Hyj6V8dCygQP1Pe33xwYvkoAKJnO072iEt5CNlss6XP7X-WvAnwTwtytgxOdRN0wQ',
            category: m.category || 'General',
            severity: (m.severity || 'LOW').toUpperCase(),
            tags: [
              { label: m.severity || 'LOW', style: m.severity === 'HIGH' ? 'bg-error/10 border-error/30 text-error' : 'bg-primary/10 border-primary/30 text-primary' },
              { label: m.category || 'General', style: 'bg-secondary/10 border-secondary/30 text-secondary' }
            ],
            content: m.content,
            statusIcon: 'verified',
            statusText: m.resolution ? 'Resolved' : 'Open',
            recurrence: m.recurrenceCount > 1 ? `RECURRED ${m.recurrenceCount}X` : null
          }));
          setMemories(formattedMemories);
          setStats(prev => ({ ...prev, total: data.total, recurrent: data.memories.filter(x => x.recurrenceCount > 1).length }));
        }
      } catch (err) {
        console.error("Failed to load memories", err);
      }
    };
    fetchMemories();
  }, []);

  const handleAddMemory = async () => {
    const content = prompt('Enter a new operational memory:');
    if (!content) return;
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hindsight_token')}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to add memory.");
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const filteredMemories = memories.filter(m => {
    const matchesSearch = !searchQuery || 
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = domainFilter === 'ALL' || m.category.toUpperCase() === domainFilter;
    const matchesTier = tierFilter === 'ALL' || m.severity === tierFilter;
    return matchesSearch && matchesDomain && matchesTier;
  });

  return (
    <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>
      
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1 flex flex-col w-full min-h-screen md:ml-64 xl:mr-[320px] relative z-10 transition-all pt-2 md:pt-0 p-lg overflow-y-auto custom-scrollbar">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-md bg-surface-container-lowest/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 w-full mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">memory</span>
            <span className="font-headline-lg-mobile text-primary font-bold">Memory Vault</span>
          </div>
          <button 
            onClick={() => setMobileOpen(true)}
            className="text-on-surface p-sm bg-white/5 rounded-lg active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        {/* Header Section */}
        <header className="flex justify-between items-end mb-xl mt-sm">
          <div>
            <nav className="flex gap-xs items-center text-outline-variant text-body-sm mb-xs">
              <span>Explorer</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-primary-fixed-dim">Vault</span>
            </nav>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Memory Vault</h2>
            <p className="font-body-sm text-body-sm text-outline">Manage and audit your persistent neural context ({filteredMemories.length} shown).</p>
          </div>
          <button onClick={handleAddMemory} className="btn-3d flex items-center gap-sm px-lg py-sm rounded-xl text-on-primary font-bold shadow-lg cursor-pointer">
            <span className="material-symbols-outlined">add</span>
            <span className="font-label-mono uppercase tracking-widest text-[11px]">Add Memory</span>
          </button>
        </header>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
          <div className="glass-card p-md rounded-xl flex items-center gap-md">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary">database</span>
            </div>
            <div>
              <p className="font-label-mono text-[10px] text-outline uppercase tracking-widest">Total Vectors</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{stats.total}</p>
            </div>
          </div>
          <div className="glass-card p-md rounded-xl flex items-center gap-md">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20">
              <span className="material-symbols-outlined text-secondary">memory</span>
            </div>
            <div>
              <p className="font-label-mono text-[10px] text-outline uppercase tracking-widest">Active Hits</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{stats.hits}</p>
            </div>
          </div>
          <div className="glass-card p-md rounded-xl flex items-center gap-md">
            <div className="w-10 h-10 rounded-lg bg-tertiary-container/10 flex items-center justify-center border border-tertiary-container/20">
              <span className="material-symbols-outlined text-tertiary-container">cyclone</span>
            </div>
            <div>
              <p className="font-label-mono text-[10px] text-outline uppercase tracking-widest">Recurrent Issues</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{stats.recurrent}</p>
            </div>
          </div>
          <div className="glass-card p-md rounded-xl flex items-center gap-md">
            <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center border border-error/20">
              <span className="material-symbols-outlined text-error">warning</span>
            </div>
            <div>
              <p className="font-label-mono text-[10px] text-outline uppercase tracking-widest">Orphaned Nodes</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{stats.orphaned}</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-md mb-lg">
          <div className="relative flex-1 group">
            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-high/50 border border-white/10 rounded-xl py-sm pl-xl pr-md text-body-sm text-on-surface focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all" 
              placeholder="Search operational memories by keyword, employee, or ID..." 
              type="text"
            />
          </div>
          <div className="flex items-center gap-md overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <div className="flex items-center gap-xs">
              <span className="text-[10px] font-label-mono text-outline uppercase mr-xs">Domain:</span>
              {['ALL', 'IT', 'HR', 'GENERAL'].map((d) => (
                <button 
                  key={d}
                  onClick={() => setDomainFilter(d)}
                  className={`px-md py-xs rounded-lg text-label-mono text-[10px] uppercase transition-colors cursor-pointer ${
                    domainFilter === d 
                      ? 'bg-primary text-on-primary font-bold shadow-md' 
                      : 'bg-white/5 border border-white/5 text-on-surface-variant hover:bg-white/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <div className="flex items-center gap-xs">
              <span className="text-[10px] font-label-mono text-outline uppercase mr-xs">Tier:</span>
              <button 
                onClick={() => setTierFilter('HIGH')}
                className={`px-sm py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  tierFilter === 'HIGH' ? 'bg-error text-white shadow-md' : 'bg-error/20 text-error'
                }`}
              >
                HIGH
              </button>
              <button 
                onClick={() => setTierFilter('MED')}
                className={`px-sm py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  tierFilter === 'MED' ? 'bg-white/20 text-white shadow-md' : 'bg-white/5 text-outline-variant hover:text-white'
                }`}
              >
                MED
              </button>
              <button 
                onClick={() => setTierFilter('LOW')}
                className={`px-sm py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  tierFilter === 'LOW' ? 'bg-secondary text-on-secondary shadow-md' : 'bg-white/5 text-outline-variant hover:text-white'
                }`}
              >
                LOW
              </button>
              <button 
                onClick={() => { setDomainFilter('ALL'); setTierFilter('ALL'); setSearchQuery(''); }}
                className="px-sm py-1 rounded border border-white/10 text-outline text-[10px] font-bold hover:bg-white/10 transition-colors cursor-pointer"
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>

        {/* Memory List Content */}
        <div className="space-y-sm pb-10">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-xl text-outline glass-card rounded-xl">
              <span className="material-symbols-outlined text-4xl mb-sm block">filter_alt_off</span>
              No memories matching current filters.
            </div>
          ) : filteredMemories.map((m, idx) => (
            <div key={idx} className="glass-card p-md rounded-xl hover:translate-x-1">
              <div className="flex justify-between items-start mb-sm">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                    <img className="w-full h-full object-cover" src={m.avatar} alt="User Avatar" />
                  </div>
                  <div>
                    <h4 className="text-on-surface font-bold text-body-md">{m.user}</h4>
                    <p className="text-outline text-body-sm font-label-mono">{m.id} • {m.time}</p>
                  </div>
                </div>
                <div className="flex gap-sm">
                  {m.tags.map((t, i) => (
                    <span key={i} className={`px-md py-xs rounded-full border ${t.style} text-label-mono text-[10px] uppercase font-bold flex items-center gap-xs`}>
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pl-[56px]">
                <p className="text-on-surface-variant text-body-md mb-md leading-relaxed">{m.content}</p>
                <div className="flex items-center gap-xl">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-outline text-[18px]">{m.statusIcon}</span>
                    <span className="text-outline text-body-sm">{m.statusText}</span>
                  </div>
                  {m.recurrence && (
                    <div className="flex items-center gap-sm bg-error/5 px-sm py-xs rounded border border-error/10">
                      <span className="material-symbols-outlined text-error text-[18px]">history</span>
                      <span className="text-error text-label-mono text-[10px] font-bold">{m.recurrence}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Right Sidebar Stats */}
      <aside className="hidden xl:block fixed right-0 top-0 h-full w-[320px] bg-surface-container-lowest/40 backdrop-blur-xl border-l border-white/5 p-lg z-40 flex flex-col overflow-y-auto custom-scrollbar">
        <h3 className="font-label-mono text-label-mono text-outline uppercase tracking-widest mb-lg">System Insights</h3>
        <div className="space-y-lg">
          <div className="glass-card p-md rounded-xl">
            <div className="flex justify-between items-center mb-md">
              <span className="text-body-sm font-bold text-on-surface">Data Retention</span>
              <span className="text-outline text-body-sm font-label-mono">94%</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '94%' }}></div>
            </div>
            <p className="text-[11px] text-outline mt-sm leading-tight">Storage optimization will trigger at 98% threshold.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
