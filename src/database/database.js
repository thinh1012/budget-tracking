const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db = null;

/**
 * Initialize the database connection and schema
 */
function initDatabase(dbPath = './data/budget.db') {
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    console.log(`Database initialized at ${dbPath}`);
    return db;
}

/**
 * Get the database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase
};
