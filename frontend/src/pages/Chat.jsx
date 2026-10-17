import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/auth';

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [memoryCount, setMemoryCount] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hindsight_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMemoryCount(data.total || 0);
        }
      } catch { /* stats are non-critical */ }
    };
    fetchStats();
  }, []);

  const sendQuery = async (queryText) => {
    const trimmedMessage = (queryText || input).trim();
    if (!trimmedMessage || isLoading) return;

    setShowWelcome(false);
    setIsLoading(true);
    setInput('');

    const newMessages = [...messages, { role: 'user', content: trimmedMessage, id: Date.now() }];
    setMessages(newMessages);

    // AI placeholder
    const aiId = 'ai-' + Date.now();
    setMessages((prev) => [
      ...prev,
      { role: 'ai', content: '', id: aiId, badges: [{ label: 'ROUTING...', reason: '' }], memory: null }
    ]);

    try {
      const token = localStorage.getItem('hindsight_token');
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: trimmedMessage })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let currentText = '';
      let currentEvent = '';
      let buffer = '';

      const handleEvent = (event, dataStr) => {
        if (!dataStr) return;
        let d;
        try { d = JSON.parse(dataStr); } catch { return; }

        if (event === 'error') {
          throw new Error(d.message || 'Stream error');
        }

        setMessages((prev) => 
          prev.map((msg) => {
            if (msg.id !== aiId) return msg;

            const updatedMsg = { ...msg };

            if (event === 'routing') {
              updatedMsg.badges = [{ label: d.label, reason: d.reason }];
            } else if (event === 'memory_matches' && d.used) {
              updatedMsg.memory = d.matches[0];
            } else if (event === 'token') {
              currentText += d.token;
              updatedMsg.content = currentText;
            }
            return updatedMsg;
          })
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line; keep the last partial chunk in the buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          currentEvent = '';
          let dataStr = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr += line.slice(6);
            }
          }
          handleEvent(currentEvent, dataStr);
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiId ? { ...msg, content: 'Error: ' + e.message } : msg
        )
      );
    }
    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  return (
    <div className="flex h-screen bg-surface-container-lowest overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40"></div>
      
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1 flex flex-col w-full min-h-screen md:ml-64 xl:mr-[320px] relative z-10 transition-all pt-20 md:pt-0">
        <div className="flex-1 flex flex-col h-screen relative w-full">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between p-md bg-surface-container-lowest/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 w-full">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary">memory</span>
              <span className="font-headline-lg-mobile text-primary font-bold">Hindsight</span>
            </div>
            <button 
              onClick={() => setMobileOpen(true)}
              className="text-on-surface p-sm bg-white/5 rounded-lg active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
          
          {/* Chat Scroll Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-xl pb-32 px-xl">
            {showWelcome && (
              <div className="flex flex-col items-center justify-center min-h-[614px] text-center mb-xl">
                <div className="w-24 h-24 mb-lg rounded-3xl bg-surface-container flex items-center justify-center border border-white/10 glow-indigo animate-float">
                  <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>neurology</span>
                </div>
                <h2 className="font-headline-xl text-headline-xl mb-sm ai-gradient-text">Welcome back, Hindsight</h2>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-lg mb-xl">Your system architect assistant is ready. I've indexed {memoryCount} operational {memoryCount === 1 ? 'memory' : 'memories'} and neural fragments.</p>
                <div className="flex flex-wrap justify-center gap-md max-w-2xl">
                  <button 
                    onClick={() => sendQuery('Check last IT incident')}
                    className="glass-card px-lg py-sm rounded-full flex items-center gap-sm hover:border-primary/40 hover:bg-white/10 active:scale-95 transition-all text-body-sm font-body-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-secondary">bolt</span> Check last IT incident
                  </button>
                  <button 
                    onClick={() => sendQuery('Summarize all HR memory fragments')}
                    className="glass-card px-lg py-sm rounded-full flex items-center gap-sm hover:border-primary/40 hover:bg-white/10 active:scale-95 transition-all text-body-sm font-body-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-tertiary">summarize</span> Summarize HR memory
                  </button>
                  <button 
                    onClick={() => sendQuery('Analyze system latency and Tier 2 operations')}
                    className="glass-card px-lg py-sm rounded-full flex items-center gap-sm hover:border-primary/40 hover:bg-white/10 active:scale-95 transition-all text-body-sm font-body-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-primary">search_insights</span> Analyze Tier 2 latency
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-xl max-w-4xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-md ${msg.role === 'user' ? 'flex-row-reverse mb-xl' : 'mb-xl'}`}>
                  {msg.role === 'user' ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center font-label-mono text-primary">{(user?.username || 'U').slice(0, 2).toUpperCase()}</div>
                      <div className="glass-card glass-card-active p-md rounded-2xl rounded-tr-none max-w-[80%]">
                        <p className="font-body-md text-body-md text-on-surface">{msg.content}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-primary-container border border-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-primary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>memory</span>
                      </div>
                      <div className="flex-1 space-y-md max-w-[85%]">
                        <div className="glass-card p-lg rounded-2xl rounded-tl-none space-y-md">
                          {msg.badges && msg.badges.map((b, i) => (
                             <div key={i} className="flex flex-wrap gap-xs mb-sm">
                               <span className="px-sm py-1 rounded bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label-mono uppercase tracking-tighter">{b.label}</span>
                               {b.reason && <span className="px-sm py-1 rounded bg-white/5 border border-white/10 text-outline text-[10px] font-label-mono uppercase tracking-tighter">{b.reason}</span>}
                             </div>
                          ))}
                          
                          <p className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">{msg.content || '_'}</p>
                          
                          {msg.memory && (
                            <div className="mt-md bg-surface-container-lowest/50 border border-white/10 rounded-xl p-md">
                              <div className="flex items-center justify-between mb-sm">
                                <span className="text-[11px] font-label-mono uppercase text-outline">Retrieved from Hindsight</span>
                                <span className="text-[11px] font-label-mono text-secondary px-sm py-0.5 rounded-full bg-secondary/10 border border-secondary/20">{msg.memory.score}% Match</span>
                              </div>
                              <div className="text-[13px] font-bold">{msg.memory.user}</div>
                              <div className="mt-sm pt-sm border-t border-white/5 text-[13px] text-on-surface-variant italic">"{msg.memory.summary}"</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div className="absolute bottom-lg left-1/2 -translate-x-1/2 w-full max-w-4xl px-lg">
            <div className="glass-card rounded-2xl p-sm flex items-center gap-sm shadow-2xl border-white/10 group focus-within:border-primary/50 transition-all">
              <button className="w-10 h-10 rounded-xl flex items-center justify-center text-outline hover:text-on-surface hover:bg-white/5 transition-all">
                <span className="material-symbols-outlined">add</span>
              </button>
              <input 
                className="flex-1 bg-transparent border-none focus:ring-0 text-body-md font-body-md text-on-surface placeholder:text-outline/50 outline-none" 
                id="chat-input" 
                placeholder="Ask anything about system operations..." 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
              />
              <div className="flex items-center gap-sm">
                <span className="hidden md:block font-label-mono text-[10px] text-outline/40 mr-sm">Enter to send</span>
                <button 
                  className={`w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center transition-transform shadow-lg shadow-primary/20 cursor-pointer ${isLoading ? 'opacity-50' : 'active:scale-90'}`}
                  onClick={() => sendQuery()}
                  disabled={isLoading}
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats & Memory Sidebar */}
      <aside className="hidden xl:block fixed right-0 top-0 h-full w-[320px] bg-surface-container-lowest/40 backdrop-blur-xl border-l border-white/5 p-lg z-40 flex flex-col overflow-y-auto custom-scrollbar">
        <h3 className="font-label-mono text-label-mono text-outline uppercase tracking-widest mb-lg flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-sm">analytics</span>
          Live Intelligence
        </h3>
        
        <div className="space-y-lg">
          <div className="glass-card p-md rounded-xl cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/analytics')}>
            <div className="flex justify-between items-center mb-sm">
              <span className="font-body-sm text-body-sm font-semibold">Memory Context</span>
              <span className="font-label-mono text-[11px] text-secondary">{memoryCount} Records</span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-secondary h-full rounded-full" style={{ width: '65%' }}></div>
            </div>
            <p className="mt-xs text-[10px] text-outline font-body-sm">Active SQLite semantic neural index</p>
          </div>

          <div className="space-y-md">
            <h4 className="text-[11px] font-label-mono text-outline-variant uppercase">Current Status</h4>
            <div className="flex items-center gap-md p-sm hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5 cursor-pointer" onClick={() => sendQuery('Show IT Cluster A status')}>
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">dns</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold">IT Cluster A</span>
                  <span className="text-[10px] text-secondary font-label-mono">Stable</span>
                </div>
                <div className="text-[10px] text-outline">99.98% Uptime</div>
              </div>
            </div>
            <div className="flex items-center gap-md p-sm hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5 cursor-pointer" onClick={() => sendQuery('Troubleshoot HR DB latency issue')}>
              <div className="w-8 h-8 rounded bg-tertiary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-sm">warning</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold">HR DB Link</span>
                  <span className="text-[10px] text-tertiary font-label-mono">Delayed</span>
                </div>
                <div className="text-[10px] text-outline">Latency +240ms</div>
              </div>
            </div>
          </div>

          <div className="space-y-md">
            <h4 className="text-[11px] font-label-mono text-outline-variant uppercase">Recent Memory Fragments</h4>
            <div className="space-y-sm">
              <div 
                onClick={() => sendQuery('Explain Incident Report #112 regarding schema update failure')}
                className="p-sm bg-white/5 border border-white/10 rounded-lg hover:border-primary/40 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-xs mb-xs">
                  <span className="material-symbols-outlined text-[12px] text-primary">bookmark</span>
                  <span className="text-[10px] font-label-mono text-outline">Incident Report #112</span>
                </div>
                <p className="text-[12px] text-on-surface line-clamp-2">"Schema update failed due to locked rows in legacy production table..."</p>
              </div>
              <div 
                onClick={() => sendQuery('What is the policy for Tier 2 administrative MFA access?')}
                className="p-sm bg-white/5 border border-white/10 rounded-lg hover:border-primary/40 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-xs mb-xs">
                  <span className="material-symbols-outlined text-[12px] text-secondary">shield</span>
                  <span className="text-[10px] font-label-mono text-outline">Auth Policy #88</span>
                </div>
                <p className="text-[12px] text-on-surface line-clamp-2">"New MFA requirements for Tier 2 administrative access levels..."</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/vault')}
              className="w-full py-2 border border-white/10 rounded-lg text-[11px] font-label-mono text-outline hover:text-on-surface hover:bg-white/5 transition-all cursor-pointer"
            >
              View Full Archive
            </button>
          </div>

          <div className="h-40 glass-card rounded-xl overflow-hidden relative group">
            <div className="absolute inset-0 flex items-center justify-center text-outline/20 group-hover:text-primary/30 transition-colors">
              <span className="material-symbols-outlined text-6xl">insights</span>
            </div>
            <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-primary/10 to-transparent"></div>
            <div className="absolute top-2 left-2 flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-primary animate-ping"></div>
              <span className="text-[10px] font-label-mono text-primary uppercase">Flow Analysis</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
