const fs = require('fs');
const path = require('path');
const { db } = require('./server/memory_sqlite');

const jsonPath = path.join(__dirname, 'data/memory.json');
if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Found ${data.length} records in memory.json`);
    
    const insert = db.prepare(`
        INSERT OR IGNORE INTO memories (id, date, category, severity, user, content, resolution, tags, recurrenceCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let count = 0;
    for (const m of data) {
        insert.run(
            m.id || Date.now().toString() + Math.random(),
            m.date || new Date().toISOString(),
            m.category || 'General',
            m.severity || 'low',
            m.user || 'Unknown',
            m.content || '',
            m.resolution || '',
            JSON.stringify(m.tags || []),
            m.recurrenceCount || 1
        );
        count++;
    }
    console.log(`Migrated ${count} records to SQLite!`);
} else {
    console.log('No memory.json found, skipping migration.');
}
