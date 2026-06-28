const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '../data/memory.json');

// ─── Load / Save ─────────────────────────────────────────────────────────────

function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMemory(entry) {
  const memories = loadMemory();

  // Detect recurrence — if the same user has a similar problem, bump the count
  const duplicate = memories.find(m =>
    m.user === entry.user &&
    scoreSimilarity(m.content, entry.content) > 0.4
  );

  if (duplicate) {
    duplicate.recurrenceCount = (duplicate.recurrenceCount || 1) + 1;
    duplicate.lastSeen = entry.date;
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
    return { isRecurrence: true, original: duplicate };
  }

  entry.id = Date.now();
  entry.date = new Date().toISOString().split('T')[0];
  entry.recurrenceCount = 1;
  memories.push(entry);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
  return { isRecurrence: false };
}

// ─── TF-IDF Inspired Scoring ──────────────────────────────────────────────────
// Better than naive word matching. Words that appear in fewer records score higher.

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had',
  'her','was','one','our','out','day','get','has','him','his',
  'how','man','new','now','old','see','two','way','who','its',
  'did','let','put','say','she','too','use','with','this','that',
  'have','from','they','will','been','each','when','were','what',
  'your','also','into','very','just','then','than','some','even',
  'most','such','take','well','much','over','back','only','come',
  'its', 'my', 'me', 'is', 'in', 'it', 'of', 'to', 'a', 'an',
  'after', 'again', 'any', 'because', 'does', 'each', 'few',
  'more', 'other', 'same', 'should', 'through', 'under', 'while'
]);

function scoreSimilarity(text1, text2) {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  const intersection = [...tokens1].filter(t => tokens2.has(t));
  // Jaccard similarity
  const union = new Set([...tokens1, ...tokens2]);
  return intersection.length / union.size;
}

function searchMemory(query) {
  const memories = loadMemory();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = memories.map(m => {
    const corpus = `${m.content} ${m.tags.join(' ')} ${m.resolution} ${m.user}`;
    const corpusTokens = tokenize(corpus);

    // Term frequency: how many query tokens appear in this record
    const matches = queryTokens.filter(qt => corpusTokens.includes(qt));

    // Tag bonus: exact tag hits score higher
    const tagMatches = queryTokens.filter(qt => m.tags.includes(qt));

    // Recurrence penalty/bonus: recurring issues are more relevant
    const recurrenceBoost = Math.log1p(m.recurrenceCount || 1) * 0.1;

    // Recency boost: more recent = more relevant (decay over 365 days)
    const daysSince = (Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - daysSince / 365) * 0.2;

    const score =
      (matches.length / queryTokens.length) * 0.6 +
      (tagMatches.length / Math.max(queryTokens.length, 1)) * 0.3 +
      recurrenceBoost +
      recencyBoost;

    return { ...m, _score: score };
  });

  return scored
    .filter(m => m._score > 0.15)      // minimum relevance threshold
    .sort((a, b) => b._score - a._score)
    .slice(0, 3);
}

function getStats() {
  const memories = loadMemory();
  const byCategory = {};
  const recurrent = memories.filter(m => m.recurrenceCount > 1);
  memories.forEach(m => {
    byCategory[m.category || 'General'] = (byCategory[m.category || 'General'] || 0) + 1;
  });
  return {
    total: memories.length,
    byCategory,
    recurrentIssues: recurrent.length,
    topRecurrent: recurrent.sort((a, b) => b.recurrenceCount - a.recurrenceCount).slice(0, 3)
  };
}

module.exports = { searchMemory, saveMemory, loadMemory, getStats };
