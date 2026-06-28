// ─── CascadeFlow Router ───────────────────────────────────────────────────────
// Intelligently routes every query to the cheapest model that can handle it.
// Tier 1 → gpt-3.5-turbo   (simple, fast, cheap)
// Tier 2 → gpt-4o-mini      (medium complexity, balanced)
// Tier 3 → gpt-4o           (complex reasoning, full power)

const MODELS = {
  tier1: { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', costPer1k: 0.0000, color: 'green'  },
  tier2: { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', costPer1k: 0.0000, color: 'yellow' },
  tier3: { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   costPer1k: 0.0000, color: 'purple' },
};

// Keywords that signal high cognitive load
const COMPLEX_SIGNALS = [
  'explain why', 'how does', 'compare', 'analyze', 'design', 'architect',
  'difference between', 'pros and cons', 'trade-off', 'best approach',
  'root cause', 'deep dive', 'strategy', 'recommendation', 'evaluate'
];

const MEDIUM_SIGNALS = [
  'why', 'how', 'what causes', 'should i', 'help me', 'troubleshoot',
  'debug', 'not working', 'issue with', 'problem with', 'steps to',
  'guide', 'process', 'workflow'
];

// Sensitive data patterns — always bump to max tier
const SENSITIVE_PATTERNS = [
  /salary|compensation|payroll/i,
  /password|credential|secret|token/i,
  /legal|lawsuit|compliance|gdpr|hipaa/i,
  /confidential|classified/i,
  /ssn|social security|date of birth/i
];

function classifyQuery(message, memoryHits = []) {
  const wordCount = message.trim().split(/\s+/).length;
  const lower = message.toLowerCase();

  // Sensitive data override → always Tier 3
  if (SENSITIVE_PATTERNS.some(p => p.test(message))) {
    return {
      ...MODELS.tier3,
      tier: 3,
      reason: 'Sensitive data detected — using highest-trust model',
      flag: 'sensitive'
    };
  }

  // Score complexity signals
  const complexScore = COMPLEX_SIGNALS.filter(k => lower.includes(k)).length;
  const mediumScore  = MEDIUM_SIGNALS.filter(k => lower.includes(k)).length;

  // Long messages or many memory hits suggest more context needed
  const lengthSignal = wordCount > 20 ? 1 : 0;
  const memorySignal = memoryHits.length > 1 ? 1 : 0;

  const totalComplexity = complexScore * 2 + mediumScore + lengthSignal + memorySignal;

  if (totalComplexity >= 4 || complexScore >= 2) {
    return {
      ...MODELS.tier3,
      tier: 3,
      reason: `Complex reasoning required (score: ${totalComplexity})`,
      flag: 'complex'
    };
  }

  if (totalComplexity >= 2 || mediumScore >= 2 || wordCount > 12) {
    return {
      ...MODELS.tier2,
      tier: 2,
      reason: `Medium complexity (score: ${totalComplexity})`,
      flag: 'medium'
    };
  }

  return {
    ...MODELS.tier1,
    tier: 1,
    reason: `Simple/FAQ query (score: ${totalComplexity})`,
    flag: 'simple'
  };
}

function estimateCost(model, promptTokens, completionTokens) {
  const totalTokens = promptTokens + completionTokens;
  return parseFloat(((totalTokens / 1000) * model.costPer1k).toFixed(6));
}

module.exports = { classifyQuery, estimateCost, MODELS };
