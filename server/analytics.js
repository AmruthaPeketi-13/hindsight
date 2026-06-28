const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../data/analytics.json');

function loadLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
  catch { return []; }
}

function saveLog(entry) {
  const logs = loadLogs();
  logs.push({
    id:               Date.now(),
    timestamp:        new Date().toISOString(),
    user:             entry.user      || 'Unknown',
    message:          entry.message,
    model:            entry.model,
    tier:             entry.tier,
    flag:             entry.flag,
    category:         entry.category  || 'General',
    memoryUsed:       entry.memoryUsed,
    memoryMatchCount: entry.memoryMatchCount || 0,
    isRecurrence:     entry.isRecurrence || false,
    promptTokens:     entry.promptTokens     || 0,
    completionTokens: entry.completionTokens || 0,
    costUSD:          entry.costUSD   || 0,
    latencyMs:        entry.latencyMs || 0,
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function getAnalytics() {
  const logs = loadLogs();
  if (!logs.length) return emptyAnalytics();

  // ── Totals ────────────────────────────────────────────────
  const totalQueries  = logs.length;
  const totalCost     = logs.reduce((s, l) => s + l.costUSD, 0);
  const totalPrompt   = logs.reduce((s, l) => s + l.promptTokens, 0);
  const totalCompletion = logs.reduce((s, l) => s + l.completionTokens, 0);
  const memoryHits    = logs.filter(l => l.memoryUsed).length;
  const memoryHitRate = totalQueries > 0 ? parseFloat(((memoryHits / totalQueries) * 100).toFixed(1)) : 0;
  const avgLatency    = totalQueries > 0 ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / totalQueries) : 0;

  // ── Per-tier breakdown ────────────────────────────────────
  const tierBreakdown = { 1: { queries: 0, cost: 0 }, 2: { queries: 0, cost: 0 }, 3: { queries: 0, cost: 0 } };
  logs.forEach(l => {
    const t = l.tier || 1;
    if (tierBreakdown[t]) {
      tierBreakdown[t].queries++;
      tierBreakdown[t].cost = parseFloat((tierBreakdown[t].cost + l.costUSD).toFixed(6));
    }
  });

  // ── Per-category breakdown ────────────────────────────────
  const categoryBreakdown = {};
  logs.forEach(l => {
    const c = l.category || 'General';
    categoryBreakdown[c] = (categoryBreakdown[c] || 0) + 1;
  });

  // ── Cost over time (last 20 queries) ─────────────────────
  const costOverTime = logs.slice(-20).map((l, i) => ({
    index:     i + 1,
    timestamp: l.timestamp,
    cost:      l.costUSD,
    model:     l.model,
    tier:      l.tier,
  }));

  // ── Model usage ───────────────────────────────────────────
  const modelUsage = {};
  logs.forEach(l => {
    if (!modelUsage[l.model]) modelUsage[l.model] = { queries: 0, cost: 0, tier: l.tier };
    modelUsage[l.model].queries++;
    modelUsage[l.model].cost = parseFloat((modelUsage[l.model].cost + l.costUSD).toFixed(6));
  });

  // ── Recurrence detection rate ─────────────────────────────
  const recurrences = logs.filter(l => l.isRecurrence).length;

  return {
    summary: {
      totalQueries,
      totalCost:      parseFloat(totalCost.toFixed(6)),
      totalTokens:    totalPrompt + totalCompletion,
      memoryHitRate,
      avgLatencyMs:   avgLatency,
      recurrences,
    },
    tierBreakdown,
    categoryBreakdown,
    modelUsage,
    costOverTime,
    recentLogs: logs.slice(-10).reverse(),
  };
}

function emptyAnalytics() {
  return {
    summary:           { totalQueries:0, totalCost:0, totalTokens:0, memoryHitRate:0, avgLatencyMs:0, recurrences:0 },
    tierBreakdown:     { 1:{queries:0,cost:0}, 2:{queries:0,cost:0}, 3:{queries:0,cost:0} },
    categoryBreakdown: {},
    modelUsage:        {},
    costOverTime:      [],
    recentLogs:        [],
  };
}

module.exports = { saveLog, getAnalytics };
