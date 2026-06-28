const fs = require('fs');
const path = require('path');

const STITCH_DIR = path.join(__dirname, '..', 'stitch_cascadeflow_ai_ops_manager');
const CLIENT_DIR = path.join(__dirname, 'client');

// Clear existing HTML files
if (fs.existsSync(CLIENT_DIR)) {
    const files = fs.readdirSync(CLIENT_DIR);
    for (const f of files) {
        if (f.endsWith('.html')) fs.unlinkSync(path.join(CLIENT_DIR, f));
    }
} else {
    fs.mkdirSync(CLIENT_DIR);
}

function fixLinks(html) {
    // Landing page nav (adding Settings so it's visible at the top)
    html = html.replace(/href="#"([^>]*)>Chat<\/a>/g, 'href="/chat.html"$1>Chat</a>');
    html = html.replace(/href="#"([^>]*)>Memory<\/a>/g, 'href="/vault.html"$1>Memory</a>');
    html = html.replace(/href="#"([^>]*)>Analytics<\/a>/g, 'href="/analytics.html"$1>Analytics</a>\n<a class="text-on-surface-variant hover:text-primary transition-colors" href="/settings.html">Settings</a>');
    
    // Landing page Launch Console button
    html = html.replace(
        /<button class="btn-3d ([^"]+)">\s*Launch Console/g,
        '<button onclick="window.location.href=\'/chat.html\'" class="btn-3d $1">\n                Launch Console'
    );

    // Sidebar links (original theme uses slightly different DOM)
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>chat<\/span>\s*Chat/g, 'href="/chat.html">\n<span class="material-symbols-outlined" data-icon="chat">chat</span>\n                Chat');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>database<\/span>\s*Memory/g, 'href="/vault.html">\n<span class="material-symbols-outlined" data-icon="database">database</span>\n                Memory');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>monitoring<\/span>\s*Analytics/g, 'href="/analytics.html">\n<span class="material-symbols-outlined" data-icon="monitoring">monitoring</span>\n                Analytics');
    html = html.replace(/href="[^"]*"\s*>\s*<span[^>]*>settings<\/span>\s*Settings/g, 'href="/settings.html">\n<span class="material-symbols-outlined" data-icon="settings">settings</span>\n                Settings');
    
    // New Session button
    html = html.replace(
        /<button class="([^"]*)">([^<]*)New Session/g,
        '<button onclick="window.location.reload()" class="$1">$2New Session'
    );
    
    // RESPONSIVE LAYOUT FIXES
    // 1. Make left sidebar togglable on mobile
    html = html.replace(/<aside class="fixed left-0/g, '<aside id="mobile-menu" class="fixed left-0 -translate-x-full md:translate-x-0 transition-transform duration-300');
    // 2. Hide right sidebar on mobile/tablet
    html = html.replace(/<aside class="fixed right-0/g, '<aside class="hidden xl:block fixed right-0');
    // 3. Adjust main content margins (remove fixed left/right margins on mobile)
    html = html.replace(/<main class="flex-1 flex ml-72 mr-\[320px\]/g, '<main class="flex-1 flex w-full md:ml-72 xl:mr-[320px]');
    
    // 4. Inject a mobile hamburger header at the top of the main content area!
    const mobileHeader = `
    <div class="md:hidden flex items-center justify-between p-md bg-surface-container-lowest/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-50 w-full">
        <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-primary">memory</span>
            <span class="font-headline-lg-mobile text-primary font-bold">Hindsight</span>
        </div>
        <button onclick="document.getElementById('mobile-menu').classList.toggle('-translate-x-full')" class="text-on-surface p-sm bg-white/5 rounded-lg active:scale-95">
            <span class="material-symbols-outlined">menu</span>
        </button>
    </div>
    `;
    html = html.replace(/<div class="flex-1 flex flex-col h-screen relative">/, '<div class="flex-1 flex flex-col h-screen relative w-full">' + mobileHeader);

    return html;
}

// ─── 1. Landing Page ──────────────────────────────────────────────────────────
const landingPath = path.join(STITCH_DIR, 'hindsight_ai_ops_manager', 'code.html');
if (fs.existsSync(landingPath)) {
    let html = fs.readFileSync(landingPath, 'utf8');
    html = fixLinks(html);
    fs.writeFileSync(path.join(CLIENT_DIR, 'index.html'), html);
    console.log('✅ index.html (from hindsight_ai_ops_manager)');
}

// ─── 2. Chat Console ──────────────────────────────────────────────────────────
const chatPath = path.join(STITCH_DIR, 'hindsight_chat', 'code.html');
if (fs.existsSync(chatPath)) {
    let html = fs.readFileSync(chatPath, 'utf8');
    html = fixLinks(html);
    const script = `
<script>
let isLoading = false;
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || isLoading) return;

  document.getElementById('welcome-state').classList.add('hidden');
  document.getElementById('chat-messages').classList.remove('hidden');
  isLoading = true;
  input.value = '';
  
  const chatArea = document.getElementById('chat-messages');
  chatArea.innerHTML += \`
    <div class="flex items-start gap-md flex-row-reverse mb-xl">
      <div class="w-10 h-10 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center font-label-mono text-primary">ID_01</div>
      <div class="glass-card glass-card-active p-md rounded-2xl rounded-tr-none max-w-[80%]">
        <p class="font-body-md text-body-md text-on-surface">\${message.replace(/</g, '&lt;')}</p>
      </div>
    </div>\`;

  const id = 'ai-' + Date.now();
  chatArea.innerHTML += \`
    <div class="flex items-start gap-md mb-xl">
      <div class="w-10 h-10 rounded-full bg-primary-container border border-primary/20 flex items-center justify-center">
        <span class="material-symbols-outlined text-on-primary-container text-xl" style="font-variation-settings: 'FILL' 1;">memory</span>
      </div>
      <div class="flex-1 space-y-md max-w-[85%]">
        <div class="glass-card p-lg rounded-2xl rounded-tl-none space-y-md">
          <div class="flex flex-wrap gap-xs mb-sm" id="\${id}-badges">
             <span class="px-sm py-1 rounded bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label-mono uppercase tracking-tighter animate-pulse">ROUTING...</span>
          </div>
          <p class="font-body-md text-body-md text-on-surface leading-relaxed" id="\${id}-text">_</p>
          <div id="\${id}-memory" class="hidden mt-md"></div>
        </div>
      </div>
    </div>\`;
    
  chatArea.parentElement.scrollTo({ top: chatArea.parentElement.scrollHeight, behavior: 'smooth' });

  try {
    const res = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunks = decoder.decode(value).split('\\n');
      for (const line of chunks) {
        if (line.startsWith('event: ')) this.evt = line.replace('event: ','').trim();
        else if (line.startsWith('data: ')) {
          const d = JSON.parse(line.replace('data: ',''));
          if (this.evt === 'routing') {
            document.getElementById(id+'-badges').innerHTML = \`
              <span class="px-sm py-1 rounded bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label-mono uppercase tracking-tighter">\${d.label}</span>
              <span class="px-sm py-1 rounded bg-white/5 border border-white/10 text-outline text-[10px] font-label-mono uppercase tracking-tighter">\${d.reason}</span>\`;
          } else if (this.evt === 'memory_matches' && d.used) {
            const m = d.matches[0];
            document.getElementById(id+'-memory').classList.remove('hidden');
            document.getElementById(id+'-memory').innerHTML = \`
              <div class="bg-surface-container-lowest/50 border border-white/10 rounded-xl p-md">
                <div class="flex items-center justify-between mb-sm">
                  <span class="text-[11px] font-label-mono uppercase text-outline">Retrieved from Hindsight</span>
                  <span class="text-[11px] font-label-mono text-secondary px-sm py-0.5 rounded-full bg-secondary/10 border border-secondary/20">\${m.score}% Match</span>
                </div>
                <div class="text-[13px] font-bold">\${m.user}</div>
                <div class="mt-sm pt-sm border-t border-white/5 text-[13px] text-on-surface-variant italic">"\${m.summary}"</div>
              </div>\`;
          } else if (this.evt === 'token') {
            text += d.token;
            document.getElementById(id+'-text').innerHTML = text.replace(/\\n/g, '<br>');
            chatArea.parentElement.scrollTo({ top: chatArea.parentElement.scrollHeight, behavior: 'smooth' });
          }
        }
      }
    }
  } catch (e) {
    document.getElementById(id+'-text').innerText = 'Error: ' + e.message;
  }
  isLoading = false;
}
document.getElementById('chat-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
document.querySelectorAll('#welcome-state button').forEach(b => {
  b.addEventListener('click', () => { document.getElementById('chat-input').value = b.innerText.trim(); sendMessage(); });
});
</script>`;
    html = html.replace(/<script>[\s\S]*?<\/script>\s*<\/body>\s*<\/html>/i, script + '</body></html>');
    fs.writeFileSync(path.join(CLIENT_DIR, 'chat.html'), html);
    console.log('✅ chat.html');
}

// ─── 3. Vault (Memory Browser) ────────────────────────────────────────────────
const vaultPath = path.join(STITCH_DIR, 'memory_browser', 'code.html');
if (fs.existsSync(vaultPath)) {
    let html = fs.readFileSync(vaultPath, 'utf8');
    html = fixLinks(html);
    const script = `
<script>
window.addEventListener('load', async () => {
    try {
        const res = await fetch('/api/memory');
        const data = await res.json();
        const grid = document.querySelector('.grid');
        if (grid && data.memories) {
            grid.innerHTML = data.memories.map(m => \`
                <div class="glass-card rounded-2xl p-lg hover:border-primary transition-all group">
                    <div class="flex justify-between items-start mb-md">
                        <span class="font-label-mono text-label-mono text-outline">\${m.date}</span>
                        <span class="px-sm py-1 rounded bg-primary/10 border border-primary/20 text-primary font-label-mono text-[10px] uppercase">\${m.category || 'LOG'}</span>
                    </div>
                    <h3 class="font-body-md text-body-md text-on-surface font-semibold mb-sm">\${m.user}</h3>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mb-md">\${m.content}</p>
                </div>
            \`).join('');
        }
    } catch(e) {}
});
</script>`;
    html = html.replace(/<script>[\s\S]*?<\/script>\s*<\/body>\s*<\/html>/i, script + '</body></html>');
    fs.writeFileSync(path.join(CLIENT_DIR, 'vault.html'), html);
    console.log('✅ vault.html');
}

// ─── 4. Analytics ─────────────────────────────────────────────────────────────
const analyticsPath = path.join(STITCH_DIR, 'hindsight_analytics', 'code.html');
if (fs.existsSync(analyticsPath)) {
    let html = fs.readFileSync(analyticsPath, 'utf8');
    html = fixLinks(html);
    
    // Add IDs to the KPI headers so we can update them safely without regex replacing the whole body
    html = html.replace(/>1,284,092<\/h3>/, ' id="kpi-queries">0</h3>');
    html = html.replace(/>\$0.0024<\/h3>/, ' id="kpi-cost">$0.00</h3>');
    html = html.replace(/>84.2%<\/h3>/, ' id="kpi-budget">0%</h3>');
    html = html.replace(/>96.8%<\/h3>/, ' id="kpi-memory">0%</h3>');

    const script = `
<script>
window.addEventListener('load', async () => {
    try {
        const res = await fetch('/api/stats');
        const d = await res.json();
        
        document.getElementById('kpi-queries').innerText = d.total || 0;
        document.getElementById('kpi-cost').innerText = '$' + (d.session ? d.session.spend.toFixed(4) : '0.0000');
        document.getElementById('kpi-budget').innerText = (d.session ? d.session.budgetPct : '0') + '%';
        
        // Example calculation for memory hit rate if not provided by backend
        const memHits = d.memoryHits || 0;
        const hitRate = d.total > 0 ? ((memHits / d.total) * 100).toFixed(1) : 100;
        document.getElementById('kpi-memory').innerText = hitRate + '%';
        
    } catch(e) {
        console.error('Failed to load analytics', e);
    }
});
</script>`;
    html = html.replace(/<script>[\s\S]*?<\/script>\s*<\/body>\s*<\/html>/i, script + '</body></html>');
    fs.writeFileSync(path.join(CLIENT_DIR, 'analytics.html'), html);
    console.log('✅ analytics.html');
}

// ─── 5. Settings ──────────────────────────────────────────────────────────────
const settingsPath = path.join(STITCH_DIR, 'system_settings', 'code.html');
if (fs.existsSync(settingsPath)) {
    let html = fs.readFileSync(settingsPath, 'utf8');
    html = fixLinks(html);
    fs.writeFileSync(path.join(CLIENT_DIR, 'settings.html'), html);
    console.log('✅ settings.html');
}
