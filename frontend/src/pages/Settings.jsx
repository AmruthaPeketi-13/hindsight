import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { api } from '../api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    instanceName: '',
    adminEmail: '',
    primaryModel: 'Gemini 2.5 Flash (Recommended)',
    streamMode: true,
    memoryRetrieval: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(api('/api/settings'), {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hindsight_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setForm(prev => ({ ...prev, ...data }));
        }
      } catch { /* settings load is non-critical */ }
    };
    loadSettings();
  }, []);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(api('/api/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hindsight_token')}`
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch {
      alert('Failed to save configuration.');
    }
    setSaving(false);
  };

  return (
    <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>
      
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1 flex flex-col w-full md:w-[calc(100%-16rem)] min-h-screen md:ml-64 relative z-10 transition-all p-lg pt-2 md:pt-lg overflow-y-auto custom-scrollbar">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-md bg-surface-container-lowest/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 w-full mb-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">settings</span>
            <span className="font-headline-lg-mobile text-primary font-bold">Settings</span>
          </div>
          <button 
            onClick={() => setMobileOpen(true)}
            className="text-on-surface p-sm bg-white/5 rounded-lg active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        <div className="max-w-container-max mx-auto w-full">
          <header className="mb-xl">
            <h2 className="font-headline-xl text-headline-xl text-on-surface">Configuration</h2>
            <p className="text-on-surface-variant font-body-md mt-sm">System settings, AI guardrails, and integrations.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
            {/* Settings Sidebar */}
            <div className="lg:col-span-3">
              <nav className="flex flex-col space-y-sm">
                {[
                  { id: 'general', label: 'General' },
                  { id: 'models', label: 'AI Models' },
                  { id: 'integrations', label: 'Integrations' },
                  { id: 'billing', label: 'Billing' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-md py-sm rounded-lg font-label-mono text-sm transition-colors text-left cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-primary/10 text-primary border border-primary/20 font-bold'
                        : 'text-outline hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-9 space-y-xl pb-32">
              {savedNotice && (
                <div className="p-md rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center gap-sm">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Configuration saved successfully!</span>
                </div>
              )}

              {activeTab === 'general' && (
                <div className="glass-card p-xl rounded-xl">
                  <h3 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface mb-md">General Profile</h3>
                  
                  <div className="space-y-lg">
                    <div>
                      <label className="block font-label-mono text-[11px] text-outline uppercase tracking-widest mb-sm">Instance Name</label>
                      <input type="text" value={form.instanceName} onChange={(e) => update('instanceName', e.target.value)} className="w-full bg-surface-container/50 border border-white/10 rounded-lg py-sm px-md text-on-surface focus:border-primary outline-none transition-all max-w-md" placeholder="Hindsight Production Node 01" />
                    </div>
                    <div>
                      <label className="block font-label-mono text-[11px] text-outline uppercase tracking-widest mb-sm">Admin Email</label>
                      <input type="email" value={form.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} className="w-full bg-surface-container/50 border border-white/10 rounded-lg py-sm px-md text-on-surface focus:border-primary outline-none transition-all max-w-md" placeholder="admin@company.com" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'models' && (
                <div className="glass-card p-xl rounded-xl">
                  <h3 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface mb-md">Gemini Engine Configuration</h3>
                  
                  <div className="space-y-lg">
                    <div>
                      <label className="block font-label-mono text-[11px] text-outline uppercase tracking-widest mb-sm">Primary Model</label>
                      <select value={form.primaryModel} onChange={(e) => update('primaryModel', e.target.value)} className="w-full bg-surface-container/50 border border-white/10 rounded-lg py-sm px-md text-on-surface focus:border-primary outline-none transition-all max-w-md appearance-none">
                        <option>Gemini 2.5 Flash (Recommended)</option>
                        <option>Gemini 2.5 Pro</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-md">
                      <input type="checkbox" id="stream_mode" checked={form.streamMode} onChange={(e) => update('streamMode', e.target.checked)} className="w-4 h-4 rounded border-white/10 bg-surface-container text-primary focus:ring-primary focus:ring-offset-surface cursor-pointer" />
                      <label htmlFor="stream_mode" className="text-body-sm text-on-surface cursor-pointer">Enable streaming responses in Chat Console</label>
                    </div>
                    <div className="flex items-center gap-md">
                      <input type="checkbox" id="memory_retrieval" checked={form.memoryRetrieval} onChange={(e) => update('memoryRetrieval', e.target.checked)} className="w-4 h-4 rounded border-white/10 bg-surface-container text-primary focus:ring-primary focus:ring-offset-surface cursor-pointer" />
                      <label htmlFor="memory_retrieval" className="text-body-sm text-on-surface cursor-pointer">Auto-retrieve from Memory Vault during inference</label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="glass-card p-xl rounded-xl space-y-md">
                  <h3 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface mb-md">Automated Webhooks</h3>
                  <div className="p-md rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">GitHub Webhook</div>
                      <div className="text-xs text-outline font-label-mono">POST /api/webhooks/github</div>
                    </div>
                    <span className="text-xs font-label-mono text-secondary px-sm py-1 rounded bg-secondary/10">Active</span>
                  </div>
                  <div className="p-md rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">PagerDuty Incidents</div>
                      <div className="text-xs text-outline font-label-mono">POST /api/webhooks/pagerduty</div>
                    </div>
                    <span className="text-xs font-label-mono text-secondary px-sm py-1 rounded bg-secondary/10">Active</span>
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="glass-card p-xl rounded-xl space-y-md">
                  <h3 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface mb-md">Budget & Guardrails</h3>
                  <p className="text-body-sm text-outline">Session Budget: $5.00 USD (Gemini Free Tier active)</p>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-sm">
                    <div className="bg-primary h-full rounded-full" style={{ width: '4%' }}></div>
                  </div>
                  <p className="text-xs font-label-mono text-outline">$0.00 consumed of $5.00 limit</p>
                </div>
              )}

              <div className="flex justify-end gap-md">
                <button onClick={() => setSavedNotice(false)} className="px-lg py-sm rounded-lg font-label-mono text-outline hover:text-on-surface transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-3d px-lg py-sm rounded-lg font-label-mono text-on-primary shadow-lg cursor-pointer active:scale-95 disabled:opacity-50">{saving ? 'Saving...' : 'Save Configuration'}</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
