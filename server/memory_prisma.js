const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sqlite = require('./memory_sqlite');

let prisma = null;
try {
  prisma = new PrismaClient();
} catch (err) {
  console.warn('[Prisma] Client initialization failed, using SQLite fallback:', err.message);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let prismaAvailable = null;

async function checkPrisma() {
  if (prismaAvailable === false || !prisma) return false;
  if (prismaAvailable === true) return true;
  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaAvailable = true;
    return true;
  } catch (err) {
    console.warn('[Prisma] Database unreachable (' + err.message + '). Falling back to SQLite.');
    prismaAvailable = false;
    return false;
  }
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
      prismaAvailable = false;
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
      prismaAvailable = false;
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
      prismaAvailable = false;
    }
  }
  return sqlite.verifyToken(token);
}

async function getSettings() {
  if (await checkPrisma()) {
    try {
      const rows = await prisma.setting.findMany();
      const settings = {};
      rows.forEach(r => settings[r.key] = JSON.parse(r.value));
      return settings;
    } catch (e) {
      prismaAvailable = false;
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
      prismaAvailable = false;
    }
  }
  return sqlite.saveSetting(key, value);
}

async function searchMemory(query) {
  if (!query || query.trim() === '') return [];
  if (await checkPrisma()) {
    try {
      let queryEmbedding = null;
      try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(query);
        queryEmbedding = result.embedding.values;
      } catch(e) {}

      if (queryEmbedding) {
        const embeddingVector = `[${queryEmbedding.join(',')}]`;
        const scored = await prisma.$queryRaw`
          SELECT id, date, category, severity, "user", content, resolution, tags, "recurrenceCount",
          (1 - (embedding <=> ${embeddingVector}::vector)) as _score
          FROM "Memory"
          ORDER BY embedding <=> ${embeddingVector}::vector
          LIMIT 3;
        `;
        return scored.filter(m => m._score > 0.4);
      }
    } catch(e) {
      prismaAvailable = false;
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
      return { id, isRecurrence: false };
    } catch(e) {
      prismaAvailable = false;
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
      return rows.map(m => ({ ...m, severity: normalizeSeverity(m.severity) }));
    } catch(e) {
      prismaAvailable = false;
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
      prismaAvailable = false;
    }
  }
  return sqlite.deleteMemory(id);
}

async function deleteAllMemories() {
  let remaining = 0;
  if (await checkPrisma()) {
    try {
      await prisma.memory.deleteMany({});
    } catch(e) {
      prismaAvailable = false;
    }
  }
  sqlite.deleteAllMemories();
  if (await checkPrisma()) {
    try {
      remaining = await prisma.memory.count();
    } catch(e) { remaining = 0; }
  }
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
      prismaAvailable = false;
    }
  }
  return sqlite.getStats();
}

module.exports = {
  searchMemory, saveMemory, loadMemory, deleteMemory, deleteAllMemories,
  getStats, getSettings, saveSetting,
  registerUser, loginUser, verifyToken, prisma
};
