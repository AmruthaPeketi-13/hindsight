require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = new Database(path.join(__dirname, 'data/memory.sqlite'));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fix() {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  const mems = db.prepare('SELECT * FROM memories WHERE embedding IS NULL').all();
  console.log(`Found ${mems.length} memories without embeddings.`);
  
  for (const entry of mems) {
    try {
      const textToEmbed = `${entry.category} | ${entry.severity} | ${entry.content} | ${entry.resolution || ''} | ${(JSON.parse(entry.tags||'[]')).join(' ')}`;
      const result = await model.embedContent(textToEmbed);
      const embeddingStr = JSON.stringify(result.embedding.values);
      
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(embeddingStr, entry.id);
      console.log(`Successfully embedded: ${entry.content}`);
    } catch (e) {
      console.error(`Failed to embed: ${entry.content}`, e.message);
    }
  }
}
fix();
