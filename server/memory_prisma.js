const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sqlite = require('./memory_sqlite');

// When DATABASE_URL points at Postgres we treat it as the source of truth and
// refuse to silently write to a separate local SQLite database (which would
// split the data). Set DB_FALLBACK_SQLITE=true to opt back into the fallback.
const PG_CONFIGURED = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '');
const ALLOW_SQLITE_FALLBACK = !PG_CONFIGURED || process.env.DB_FALLBACK_SQLITE === 'true';

let prisma = null;
try {
  prisma = new PrismaClient();
} catch (err) {
  console.warn('[Prisma] Client initialization failed:', err.message);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let prismaAvailable = null;

function degrade(reason) {
  if (!ALLOW_SQLITE_FALLBACK) {
    throw new Error(
      `Postgres backend unavailable (${reason}). SQLite fallback is disabled because ` +
      `DATABASE_URL points at Postgres. Set DB_FALLBACK_SQLITE=true to allow the fallback.`
    );
  }
  console.warn('[Prisma] ' + reason + ' — falling back to SQLite.');
  prismaAvailable = false;
}

async function checkPrisma() {
  if (!prisma) {
    degrade('Prisma client not initialized');
    return false;
  }
  if (prismaAvailable === true) return true;
  if (prismaAvailable === false) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaAvailable = true;
    return true;
  } catch (err) {
    degrade('Database unreachable: ' + err.message);
    return false;
  }
}

async function generateEmbedding(text) {
  const clean = (text || '').slice(0, 8000);
  const models = ['text-embedding-004', 'gemini-embedding-2'];
  for (const name of models) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.embedContent(clean);
      const values = result?.embedding?.values;
      if (values && values.length) return values;
    } catch (err) {
      console.warn(`[embedding] ${name} failed: ${err.message}`);
    }
  }
  return null;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function registerUser(username, password) {
  if (await checkPrisma()) {
    try {
      const check = await prisma.user.findUnique({ where: { username } });
      if (check) throw new Error("Username already exists");

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const token = crypto.randomBytes(32).toString('hex');
      const id = Date.now().toString() + Math.floor(Math.random()*1000);

      await prisma.user.create({
        data: { id, username, passwordHash, salt, token }
      });
      return { id, username, token };
    } catch (e) {
      if (e.message === "Username already exists") throw e;
      degrade(e.message);
    }
  }
  return sqlite.registerUser(username, password);
}

async function loginUser(username, password) {
  if (await checkPrisma()) {
    try {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) throw new Error("Invalid username or password");

      const hash = hashPassword(password, user.salt);
      if (hash !== user.passwordHash) throw new Error("Invalid username or password");

      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { token }
      });
      return { id: user.id, username: user.username, token };
    } catch (e) {
      if (e.message === "Invalid username or password") throw e;
      degrade(e.message);
    }
  }
  return sqlite.loginUser(username, password);
}

async function verifyToken(token) {
  if (!token) return null;
  if (await checkPrisma()) {
    try {
      const user = await prisma.user.findFirst({
        where: { token },
        select: { id: true, username: true }
      });
      if (user) return user;
    } catch (e) {
      degrade(e.message);
    }
  }
  return sqlite.verifyToken(token);
}

async function getSettings() {
  if (await checkPrisma()) {
    try {
      const rows = await prisma.setting.findMany();
      const settings = {};
      rows.forEach(r => { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } });
      return settings;
    } catch (e) {
      degrade(e.message);
    }
  }
  return sqlite.getSettings();
}

async function saveSetting(key, value) {
  if (await checkPrisma()) {
    try {
      await prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) }
      });
      return;
    } catch (e) {
      degrade(e.message);
    }
  }
  return sqlite.saveSetting(key, value);
}

async function searchMemory(query) {
  if (!query || query.trim() === '') return [];
  if (await checkPrisma()) {
    try {
      const queryEmbedding = await generateEmbedding(query);
      if (!queryEmbedding) return [];

      const embeddingVector = `[${queryEmbedding.join(',')}]`;
      const scored = await prisma.$queryRaw`
        SELECT id, date, category, severity, "user", content, resolution, tags, "recurrenceCount",
        (1 - (embedding <=> ${embeddingVector}::vector)) as _score
        FROM "Memory"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingVector}::vector
        LIMIT 3;
      `;
      return scored.filter(m => m._score > 0.4);
    } catch (e) {
      degrade(e.message);
    }
  }
  return await sqlite.searchMemory(query);
}

function normalizeSeverity(sev) {
  const s = (sev || 'low').toLowerCase();
  if (s === 'high' || s === 'critical') return 'HIGH';
  if (s === 'med' || s === 'medium') return 'MED';
  return 'LOW';
}

async function saveMemory({ user, content, category, severity, resolution, tags }) {
  if (await checkPrisma()) {
    try {
      const existingMatches = await searchMemory(content);
      if (existingMatches.length > 0 && existingMatches[0]._score > 0.85) {
        const parentId = existingMatches[0].id;
        await prisma.memory.update({
          where: { id: parentId },
          data: {
            recurrenceCount: { increment: 1 },
            date: new Date().toISOString()
          }
        });
        return { id: parentId, isRecurrence: true };
      }

      const id = Date.now().toString() + Math.floor(Math.random()*1000);
      const now = new Date().toISOString();
      const safeCategory = category || 'General';
      const safeSeverity = normalizeSeverity(severity);
      const safeUser = user || 'System';
      const safeContent = content || '';
      const safeResolution = resolution || '';
      const safeTags = JSON.stringify(tags || []);

      await prisma.memory.create({
        data: {
          id, date: now, category: safeCategory, severity: safeSeverity,
          user: safeUser, content: safeContent, resolution: safeResolution, tags: safeTags, recurrenceCount: 1
        }
      });

      // Prisma can't write an Unsupported("vector") column directly — use raw SQL.
      const embedding = await generateEmbedding(
        `${safeCategory} | ${safeSeverity} | ${safeContent} | ${safeResolution} | ${(tags || []).join(' ')}`
      );
      if (embedding && embedding.length) {
        const vec = `[${embedding.join(',')}]`;
        await prisma.$executeRaw`UPDATE "Memory" SET embedding = ${vec}::vector WHERE id = ${id}`;
      }

      return { id, isRecurrence: false };
    } catch (e) {
      degrade(e.message);
    }
  }
  return await sqlite.saveMemory({ user, content, category, severity, resolution, tags });
}

async function loadMemory() {
  if (await checkPrisma()) {
    try {
      const rows = await prisma.memory.findMany({
        orderBy: { date: 'desc' }
      });
      return rows.map(m => {
        let parsedTags = m.tags;
        try { parsedTags = JSON.parse(m.tags); } catch { parsedTags = m.tags; }
        return { ...m, tags: parsedTags, severity: normalizeSeverity(m.severity) };
      });
    } catch (e) {
      degrade(e.message);
    }
  }
  return sqlite.loadMemory();
}

async function deleteMemory(id) {
  if (await checkPrisma()) {
    try {
      await prisma.memory.delete({ where: { id } });
      return true;
    } catch(e) {
      if (e.code === 'P2025') return false;
      degrade(e.message);
    }
  }
  return sqlite.deleteMemory(id);
}

async function deleteAllMemories() {
  let remaining = 0;
  if (await checkPrisma()) {
    try {
      await prisma.memory.deleteMany({});
      remaining = await prisma.memory.count();
      return remaining;
    } catch(e) {
      degrade(e.message);
    }
  }
  sqlite.deleteAllMemories();
  return remaining;
}

function computeStats(all) {
  const cats = {};
  let recs = 0;
  all.forEach(m => {
    const cat = m.category || 'General';
    cats[cat] = (cats[cat] || 0) + 1;
    if (m.recurrenceCount > 1) recs++;
  });
  return {
    total: all.length,
    totalQueries: all.length,
    activeHits: `${all.length > 0 ? (all.length * 1.5).toFixed(1) : 0}k`,
    orphaned: 0,
    recurrent: recs,
    byCategory: cats,
    recurrentIssues: recs,
    topRecurrent: all.filter(m => m.recurrenceCount > 1).sort((a,b) => b.recurrenceCount - a.recurrenceCount).slice(0,5)
  };
}

async function getStats() {
  if (await checkPrisma()) {
    try {
      return computeStats(await prisma.memory.findMany());
    } catch(e) {
      degrade(e.message);
    }
  }
  return sqlite.getStats();
}

module.exports = {
  searchMemory, saveMemory, loadMemory, deleteMemory, deleteAllMemories,
  getStats, getSettings, saveSetting,
  registerUser, loginUser, verifyToken, prisma
};
