require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { searchMemory, saveMemory, loadMemory, getStats, registerUser, loginUser, verifyToken } = require('./memory_prisma');
const { classifyQuery, estimateCost }                    = require('./router');
const { saveLog, getAnalytics }                          = require('./analytics');
const { detectCategory, detectSeverity, extractTags }   = require('./helpers');

const app   = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ══════════════════════════════════════════════════════════════════════════════
// Auth API
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await registerUser(username, password);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await loginUser(username, password);
    res.json(user);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// Middleware to protect routes
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(' ')[1];
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

// ─── Session budget tracker ───────────────────────────────────────────────────
let sessionSpend = 0;
const SESSION_BUDGET = parseFloat(process.env.SESSION_BUDGET_USD || '5.00');

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(relevantMemories, routing) {
  const memoryBlock = relevantMemories.length > 0
    ? relevantMemories.map((m, i) =>
        `[Memory ${i+1} | ${m.date} | ${m.category||'General'} | Match: ${(m._score*100).toFixed(0)}%]\n` +
        `  Employee : ${m.user}\n` +
        `  Issue    : ${m.content}\n` +
        `  Fix      : ${m.resolution}` +
        (m.recurrenceCount > 1 ? `\n  ⚠ Recurred ${m.recurrenceCount} times.` : '')
      ).join('\n\n')
    : 'No past incidents match this query.';

  return `You are an AI Operations Manager — an intelligent assistant with perfect organizational memory.

Rules:
- If relevant past memory exists, LEAD with it. Format: "This matches [Employee]'s incident from [date]..."
- Be concise and action-oriented. Number your steps.
- Flag recurring issues explicitly.
- End memory-assisted replies with: "💾 Memory used — [Employee] · [date]"
- If no memory: answer from general knowledge and note it's a new case being logged.

Routing: ${routing.reason}

─── Organizational Memory ───────────────────
${memoryBlock}
─────────────────────────────────────────────`;
}

// ─── Gemini call (standard) ───────────────────────────────────────────────────
async function callGemini(modelId, systemPrompt, userMessage) {
  const model  = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    generationConfig:  { maxOutputTokens: 600, temperature: 0.3 },
  });
  const result = await model.generateContent(userMessage);
  const text   = result.response.text();
  const usage  = result.response.usageMetadata || {};
  return {
    text,
    promptTokens:     usage.promptTokenCount     || Math.ceil(systemPrompt.length / 4),
    completionTokens: usage.candidatesTokenCount || Math.ceil(text.length / 4),
  };
}

// ─── Gemini streaming generator ───────────────────────────────────────────────
async function* streamGemini(modelId, systemPrompt, userMessage) {
  const model  = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    generationConfig:  { maxOutputTokens: 600, temperature: 0.3 },
  });
  const result = await model.generateContentStream(userMessage);
  for await (const chunk of result.stream) {
    const token = chunk.text();
    if (token) yield token;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/chat  — full response
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  const userName = req.user.username; 
  
  if (!message?.trim()) return res.status(400).json({ error: 'Empty message.' });

  const t0               = Date.now();
  const relevantMemories = await searchMemory(message);
  const routing          = classifyQuery(message, relevantMemories);
  const systemPrompt     = buildSystemPrompt(relevantMemories, routing);

  try {
    const { text: answer, promptTokens, completionTokens } =
      await callGemini(routing.id, systemPrompt, `${userName ? `[${userName}] ` : ''}${message}`);

    const cost       = estimateCost(routing, promptTokens, completionTokens);
    const latencyMs  = Date.now() - t0;
    sessionSpend    += cost;

    const category   = detectCategory(message);
    const saveResult = await saveMemory({
      user: userName || 'Unknown', content: message,
      category, severity: detectSeverity(message),
      resolution: answer, tags: extractTags(message),
    });

    saveLog({
      user: userName || 'Unknown', message,
      model: routing.id, tier: routing.tier, flag: routing.flag,
      category, memoryUsed: relevantMemories.length > 0,
      memoryMatchCount: relevantMemories.length,
      isRecurrence: saveResult.isRecurrence,
      promptTokens, completionTokens, costUSD: cost, latencyMs,
    });

    res.json({
      answer,
      routing: { model: routing.id, label: routing.label, tier: routing.tier, color: routing.color, flag: routing.flag, reason: routing.reason },
      memory: {
        used: relevantMemories.length > 0, count: relevantMemories.length,
        matches: relevantMemories.map(m => ({
          date: m.date, user: m.user, summary: m.content,
          category: m.category, score: parseFloat((m._score*100).toFixed(1)),
          recurrence: m.recurrenceCount,
        })),
        isRecurrence: saveResult.isRecurrence,
      },
      cost:   { thisTurn: cost, sessionTotal: parseFloat(sessionSpend.toFixed(6)), budgetPct: parseFloat(((sessionSpend/SESSION_BUDGET)*100).toFixed(1)) },
      tokens: { prompt: promptTokens, completion: completionTokens },
      latencyMs,
    });

  } catch (err) {
    console.error('[/api/chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/chat/stream  — SSE token-by-token streaming
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/chat/stream', requireAuth, async (req, res) => {
  const { message } = req.body;
  const userName = req.user.username;
  if (!message?.trim()) return res.status(400).json({ error: 'Empty message.' });

  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const t0               = Date.now();
  const relevantMemories = await searchMemory(message);
  const routing          = classifyQuery(message, relevantMemories);
  const systemPrompt     = buildSystemPrompt(relevantMemories, routing);

  // Send routing + memory instantly — UI renders badges before AI starts typing
  send('routing', { model: routing.id, label: routing.label, tier: routing.tier, color: routing.color, flag: routing.flag, reason: routing.reason });
  send('memory_matches', {
    used: relevantMemories.length > 0, count: relevantMemories.length,
    matches: relevantMemories.map(m => ({
      date: m.date, user: m.user, summary: m.content,
      category: m.category, score: parseFloat((m._score*100).toFixed(1)),
      recurrence: m.recurrenceCount,
    })),
  });

  try {
    let fullAnswer = '';
    for await (const token of streamGemini(routing.id, systemPrompt, `${userName ? `[${userName}] ` : ''}${message}`)) {
      fullAnswer += token;
      send('token', { token });
    }

    const latencyMs     = Date.now() - t0;
    const estPrompt     = Math.ceil(systemPrompt.length / 4);
    const estCompletion = Math.ceil(fullAnswer.length / 4);
    const cost          = estimateCost(routing, estPrompt, estCompletion);
    sessionSpend       += cost;

    const category   = detectCategory(message);
    const saveResult = await saveMemory({
      user: userName || 'Unknown', content: message,
      category, severity: detectSeverity(message),
      resolution: fullAnswer, tags: extractTags(message),
    });

    saveLog({
      user: userName || 'Unknown', message,
      model: routing.id, tier: routing.tier, flag: routing.flag,
      category, memoryUsed: relevantMemories.length > 0,
      memoryMatchCount: relevantMemories.length,
      isRecurrence: saveResult.isRecurrence,
      promptTokens: estPrompt, completionTokens: estCompletion,
      costUSD: cost, latencyMs,
    });

    send('done', {
      isRecurrence: saveResult.isRecurrence,
      cost: { thisTurn: cost, sessionTotal: parseFloat(sessionSpend.toFixed(6)), budgetPct: parseFloat(((sessionSpend/SESSION_BUDGET)*100).toFixed(1)) },
      tokens: { prompt: estPrompt, completion: estCompletion },
      latencyMs,
    });

  } catch (err) {
    console.error('[/api/chat/stream]', err.message);
    send('error', { message: err.message });
  }

  res.end();
});

// ══════════════════════════════════════════════════════════════════════════════
// Analytics API
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/analytics', requireAuth, (req, res) => {
  res.json(getAnalytics());
});

app.get('/api/analytics/export', requireAuth, (req, res) => {
  const analytics = getAnalytics();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=ai_ops_report.json');
  res.send(JSON.stringify(analytics, null, 2));
});

// ══════════════════════════════════════════════════════════════════════════════
// Memory API
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/memory', requireAuth, async (req, res) => {
  const { loadMemory } = require('./memory_prisma');
  let memories = await loadMemory();
  
  if (req.query.category) memories = memories.filter(m => m.category === req.query.category);
  if (req.query.severity) memories = memories.filter(m => m.severity === req.query.severity);

  res.json({ memories: memories.reverse(), total: memories.length });
});

app.post('/api/memory', requireAuth, async (req, res) => {
  const { saveMemory } = require('./memory_prisma');
  const result = await saveMemory({
    user: req.user.username,
    content: req.body.content || 'Manual memory entry',
    category: req.body.category || 'General',
    severity: req.body.severity || 'low',
    resolution: req.body.resolution || '',
    tags: []
  });
  res.json(result);
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/webhooks/:source  — Automated Ingestion
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/webhooks/:source', async (req, res) => {
  const source = req.params.source.toLowerCase();
  const payload = req.body;
  const { saveMemory } = require('./memory_prisma');

  let entry = { user: `Webhook:${source}`, content: '', category: 'Incident', severity: 'low', resolution: '', tags: [source] };

  try {
    if (source === 'pagerduty') {
      const incident = payload.messages?.[0]?.incident || payload.incident || payload;
      entry.content = incident.title || incident.summary || JSON.stringify(incident);
      entry.severity = incident.urgency === 'high' ? 'HIGH' : 'MED';
      entry.category = 'IT';
    } else if (source === 'github') {
      const pr = payload.pull_request;
      if (pr) {
        entry.content = `PR: ${pr.title} in ${payload.repository?.full_name}`;
        entry.category = 'Deployment';
        entry.severity = 'LOW';
      } else {
        entry.content = `GitHub Event: ${JSON.stringify(payload).substring(0, 100)}...`;
      }
    } else {
      entry.content = `Generic Webhook: ${JSON.stringify(payload).substring(0, 150)}`;
    }

    const result = await saveMemory(entry);
    res.json({ success: true, result });
  } catch(e) {
    console.error(`Webhook error (${source}):`, e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/memory', requireAuth, (req, res) => {
  const { deleteAllMemories } = require('./memory_sqlite');
  try {
    deleteAllMemories();
    res.json({ success: true, remaining: 0 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/memory/:id', async (req, res) => {
  const { deleteMemory } = require('./memory_prisma');
  const success = await deleteMemory(req.params.id);
  res.json({ success });
});

app.get('/api/stats', (req, res) => {
  res.json({
    ...getStats(),
    session: { spend: parseFloat(sessionSpend.toFixed(6)), budgetPct: parseFloat(((sessionSpend/SESSION_BUDGET)*100).toFixed(1)), budget: SESSION_BUDGET },
  });
});

app.get('/api/settings', async (req, res) => {
  const { getSettings } = require('./memory_prisma');
  res.json(await getSettings());
});

app.post('/api/settings', async (req, res) => {
  const { saveSetting } = require('./memory_prisma');
  for (const [key, value] of Object.entries(req.body)) {
    await saveSetting(key, value);
  }
  res.json({ success: true });
});


app.get('/api/health', async (req, res) => {
  try {
    const { loadMemory } = require('./memory_prisma');
    const memories = await loadMemory();
    res.json({ status: 'ok', timestamp: new Date().toISOString(), memoryCount: (memories || []).length, sessionSpend: parseFloat(sessionSpend.toFixed(6)) });
  } catch(e) {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), memoryCount: 0, sessionSpend: parseFloat(sessionSpend.toFixed(6)) });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const key = process.env.GEMINI_API_KEY;
  const keyStatus = (!key || key === 'paste-your-gemini-key-here') ? '✗ MISSING — add to .env' : '✓ loaded';
  console.log(`\n🧠  AI Ops Manager  → http://localhost:${PORT}`);
  console.log(`🤖  AI Engine       → Google Gemini (FREE ✓)`);
  console.log(`📡  Streaming SSE   → POST /api/chat/stream`);
  console.log(`📊  Analytics       → GET  /api/analytics`);
  console.log(`❤️   Health check    → GET  /api/health`);
  console.log(`💰  Budget          → FREE (Gemini free tier)`);
  console.log(`🔑  Gemini key      → ${keyStatus}\n`);
});
