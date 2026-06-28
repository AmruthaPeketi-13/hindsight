const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'memory.sqlite');
const db = new Database(dbPath);

// Initialize schema
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    date TEXT,
    category TEXT,
    severity TEXT,
    user TEXT,
    content TEXT,
    resolution TEXT,
    tags TEXT,
    recurrenceCount INTEGER DEFAULT 1,
    embedding TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    passwordHash TEXT,
    salt TEXT,
    token TEXT
  );
`);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function registerUser(username, password) {
  const check = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (check) throw new Error("Username already exists");

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const token = crypto.randomBytes(32).toString('hex');
  const id = Date.now().toString() + Math.floor(Math.random()*1000);

  const stmt = db.prepare('INSERT INTO users (id, username, passwordHash, salt, token) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, username, passwordHash, salt, token);
  
  return { id, username, token };
}

function loginUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) throw new Error("Invalid username or password");

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("Invalid username or password");

  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);
  
  return { id: user.id, username: user.username, token };
}

function verifyToken(token) {
  if (!token) return null;
  return db.prepare('SELECT id, username FROM users WHERE token = ?').get(token);
}

// Add column if it doesn't exist (for migration of older db)
try {
  db.exec("ALTER TABLE memories ADD COLUMN embedding TEXT");
} catch(e) {
  // Column already exists
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getSettings() {
  const stmt = db.prepare('SELECT * FROM settings');
  const rows = stmt.all();
  const settings = {};
  rows.forEach(r => settings[r.key] = JSON.parse(r.value));
  return settings;
}

function saveSetting(key, value) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  stmt.run(key, JSON.stringify(value));
}

async function searchMemory(query) {
  if (!query || query.trim() === '') return [];
  
  // Try to generate embedding
  let queryEmbedding = null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent(query);
    queryEmbedding = result.embedding.values;
  } catch(e) {
    console.error('Embedding failed for search, falling back to keywords', e.message);
  }

  const stmt = db.prepare(`SELECT * FROM memories ORDER BY date DESC LIMIT 100`);
  const all = stmt.all();
  
  let scored = all.map(m => {
    let score = 0;
    if (queryEmbedding && m.embedding) {
      try {
        const memEmbedding = JSON.parse(m.embedding);
        score = cosineSimilarity(queryEmbedding, memEmbedding);
      } catch(err) {}
    } else {
      // Fallback keyword match
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const txt = (m.content + ' ' + m.resolution + ' ' + m.tags).toLowerCase();
      keywords.forEach(kw => { if (txt.includes(kw)) score += 0.2; });
    }
    m._score = score;
    return m;
  }).filter(m => m._score > 0.4) // Threshold for semantic match
    .sort((a,b) => b._score - a._score)
    .slice(0, 3);
    
  return scored;
}

async function saveMemory(entry) {
  // Check for recurrence using basic string matching on the first word for speed
  const recentStmt = db.prepare(`SELECT * FROM memories WHERE category = ? ORDER BY date DESC LIMIT 5`);
  const recents = recentStmt.all(entry.category || 'General');
  
  let isRecurrence = false;
  let recurredId = null;
  
  for (const m of recents) {
    if (m.user === entry.user && entry.content.includes(m.content.split(' ')[0])) {
      isRecurrence = true;
      recurredId = m.id;
      break;
    }
  }

  if (isRecurrence && recurredId) {
    const update = db.prepare(`UPDATE memories SET recurrenceCount = recurrenceCount + 1, date = ? WHERE id = ?`);
    update.run(new Date().toISOString(), recurredId);
    return { id: recurredId, isRecurrence: true };
  } else {
    // Generate embedding
    let embeddingStr = null;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
      const textToEmbed = `${entry.category} | ${entry.severity} | ${entry.content} | ${entry.resolution || ''} | ${(entry.tags||[]).join(' ')}`;
      const result = await model.embedContent(textToEmbed);
      embeddingStr = JSON.stringify(result.embedding.values);
    } catch(e) {
      console.error('Embedding failed for save', e.message);
    }

    const id = Date.now().toString() + Math.floor(Math.random()*1000);
    const insert = db.prepare(`
      INSERT INTO memories (id, date, category, severity, user, content, resolution, tags, recurrenceCount, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      id,
      new Date().toISOString(),
      entry.category || 'General',
      entry.severity || 'low',
      entry.user || 'Unknown',
      entry.content,
      entry.resolution || '',
      JSON.stringify(entry.tags || []),
      1,
      embeddingStr
    );
    return { id, isRecurrence: false };
  }
}

function loadMemory() {
  const stmt = db.prepare(`SELECT * FROM memories ORDER BY date DESC`);
  return stmt.all().map(m => {
    try { m.tags = JSON.parse(m.tags); } catch(e) { m.tags = []; }
    return m;
  });
}

function getStats() {
  const all = loadMemory();
  const cats = {};
  let recs = 0;
  all.forEach(m => {
    cats[m.category] = (cats[m.category] || 0) + 1;
    if (m.recurrenceCount > 1) recs++;
  });
  return {
    total: all.length,
    byCategory: cats,
    recurrentIssues: recs,
    topRecurrent: all.filter(m => m.recurrenceCount > 1).sort((a,b) => b.recurrenceCount - a.recurrenceCount).slice(0,5)
  };
}

function deleteMemory(id) {
  const stmt = db.prepare(`DELETE FROM memories WHERE id = ?`);
  const info = stmt.run(id);
  return info.changes > 0;
}

module.exports = {
  loadMemory,
  saveMemory,
  searchMemory,
  getSettings,
  saveSetting,
  registerUser,
  loginUser,
  verifyToken,
  deleteMemory,
  db
};
