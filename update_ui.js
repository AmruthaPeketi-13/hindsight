const fs = require('fs');

const stitchHtml = fs.readFileSync('./stitch-chat.html', 'utf8');

const jsLogic = `
<script>
// ─── State ────────────────────────────────────────────────────────────────────
let isLoading = false;
let hasMessages = false;
let sessionSpend = 0;
const SESSION_BUDGET = 5.00;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  loadStats();
  document.getElementById('chat-input').focus();
});

// ─── Send Message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const input   = document.getElementById('chat-input');
  const message = input.value.trim();
  const name    = 'ID_01'; // Default for new UI
  if (!message || isLoading) return;

  // Hide welcome, show chat
  const welcome = document.getElementById('welcome-state');
  const messages = document.getElementById('chat-messages');
  if (welcome) welcome.style.display = 'none';
  if (messages) messages.classList.remove('hidden');

  isLoading = true;
  input.value = '';

  appendUserMsg(message);
  const aiBubbleId = appendAIMsgSkeleton();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat/stream', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, userName: name })
    });

    if (!res.ok) throw new Error('Server error');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    let aiText = '';
    const textEl = document.getElementById(aiBubbleId + '-text');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\\n');
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          this.currentEvent = line.replace('event: ', '').trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (!dataStr) continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (this.currentEvent === 'routing') {
              updateRoutingBadge(aiBubbleId, data);
            } else if (this.currentEvent === 'memory_matches') {
              updateMemoryBadge(aiBubbleId, data);
            } else if (this.currentEvent === 'token') {
              aiText += data.token;
              textEl.innerHTML = formatAnswer(aiText);
              scrollToBottom();
            } else if (this.currentEvent === 'done') {
              updateStats(data);
            } else if (this.currentEvent === 'error') {
              textEl.innerHTML += \`<br><span style="color:var(--tertiary)">⚠ Error: \${data.message}</span>\`;
            }
          } catch(e) {}
        }
      }
    }

  } catch (err) {
    document.getElementById(aiBubbleId + '-text').innerHTML = \`<span style="color:var(--tertiary)">⚠ Error: \${err.message}</span>\`;
  }

  isLoading = false;
  input.focus();
  scrollToBottom();
}

function appendUserMsg(text) {
  const row = document.createElement('div');
  row.className = 'flex items-start gap-md flex-row-reverse mb-xl';
  row.innerHTML = \`
    <div class="w-10 h-10 bg-surface-container-high dotted-border flex items-center justify-center font-label-mono text-primary">ID_01</div>
    <div class="glass-card glass-card-active p-md max-w-[80%]">
      <p class="font-body-md text-body-md text-on-surface">\${escapeHtml(text)}</p>
    </div>
  \`;
  document.getElementById('chat-messages').appendChild(row);
}

function appendAIMsgSkeleton() {
  const id = 'ai-' + Date.now();
  const row = document.createElement('div');
  row.className = 'flex items-start gap-md mb-xl';
  row.innerHTML = \`
    <div class="w-10 h-10 bg-primary-container dotted-border flex items-center justify-center">
      <span class="material-symbols-outlined text-primary text-xl">memory</span>
    </div>
    <div class="flex-1 space-y-md max-w-[85%]">
      <div class="glass-card p-lg space-y-md">
        <!-- Meta Badges -->
        <div class="flex flex-wrap gap-xs mb-sm" id="\${id}-badges">
          <span class="px-sm py-1 dotted-border bg-surface-variant text-on-surface-variant text-[10px] font-label-mono uppercase tracking-tighter animate-pulse">ROUTING...</span>
        </div>
        <div class="font-body-md text-body-md text-on-surface leading-relaxed" id="\${id}-text">
          <span class="animate-pulse">_</span>
        </div>
        <div id="\${id}-memory" class="hidden"></div>
      </div>
    </div>
  \`;
  document.getElementById('chat-messages').appendChild(row);
  return id;
}

function updateRoutingBadge(id, routing) {
  const badgeColors = { 1:'text-primary bg-primary/10', 2:'text-secondary bg-secondary/10', 3:'text-tertiary bg-tertiary/10' };
  const colorClass = badgeColors[routing.tier] || 'text-outline bg-surface-variant';
  
  document.getElementById(id + '-badges').innerHTML = \`
    <span class="px-sm py-1 dotted-border \${colorClass} text-[10px] font-label-mono uppercase tracking-tighter">\${routing.label}</span>
    <span class="px-sm py-1 dotted-border text-outline bg-white/5 text-[10px] font-label-mono uppercase tracking-tighter">\${routing.reason}</span>
  \`;
}

function updateMemoryBadge(id, memData) {
  if (!memData.used || !memData.matches.length) return;
  
  const memEl = document.getElementById(id + '-memory');
  memEl.classList.remove('hidden');
  
  const m = memData.matches[0]; // just show top match in UI for brevity
  memEl.innerHTML = \`
    <div class="bg-surface-container-lowest/50 dotted-border p-md mt-md">
      <div class="flex items-center justify-between mb-sm">
        <div class="flex items-center gap-sm">
          <span class="material-symbols-outlined text-secondary text-sm">history_edu</span>
          <span class="text-[11px] font-label-mono uppercase text-outline">Shard Retrieved</span>
        </div>
        <div class="text-[11px] font-label-mono text-secondary px-sm py-0.5 dotted-border bg-secondary/10">MATCH_\${m.score}%</div>
      </div>
      <div class="flex items-center gap-md">
        <div class="w-12 h-12 bg-surface-container-highest dotted-border flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-outline">person_search</span>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-body-md text-body-sm font-semibold truncate text-primary">\${escapeHtml(m.user)}</h4>
          <p class="font-body-sm text-body-sm text-outline-variant truncate">\${m.date} - \${m.category}</p>
        </div>
      </div>
      <div class="mt-sm pt-sm border-t border-white/5 text-[13px] text-on-surface-variant italic font-label-mono">
        "\${escapeHtml(m.summary)}"
      </div>
    </div>
  \`;
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const d = await res.json();
    
    // Update sidebar memory stats
    const pct = Math.min((d.total / 500) * 100, 100).toFixed(1);
    const capacityBar = document.querySelector('.bg-primary.h-full');
    if (capacityBar) capacityBar.style.width = pct + '%';
    
    const capText = document.querySelector('.mt-xs.text-\\[10px\\].text-outline.font-body-sm');
    if (capText) capText.textContent = \`\${pct}% of total shard capacity (\${d.total} items)\`;

  } catch (e) {}
}

function updateStats(data) {
  loadStats();
}

function formatAnswer(text) {
  return escapeHtml(text)
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\`([^\`]+)\`/g, '<code class="bg-surface-container-highest px-1 text-secondary dotted-border">$1</code>')
    .replace(/\\n/g, '<br>');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('chat-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

document.querySelectorAll('#welcome-state button').forEach(button => {
    button.addEventListener('click', () => {
        document.getElementById('chat-input').value = button.innerText.trim();
        sendMessage();
    });
});

function scrollToBottom() {
  const container = document.getElementById('chat-messages').parentElement;
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}
</script>
</body>
</html>
`;

// Replace the old script block with our new one
const updatedHtml = stitchHtml.replace(/<script>[\s\S]*?<\/script>\s*<\/body>\s*<\/html>/i, jsLogic);

fs.writeFileSync('./client/index.html', updatedHtml);
console.log('Successfully updated index.html with new Stitch Chat UI!');
