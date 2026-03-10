const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db = null;

/**
 * Run migrations for columns added after initial schema
 */
function runMigrations(db) {
    // Add chat_id to transactions if missing
    const txCols = db.pragma('table_info(transactions)').map(c => c.name);
    if (!txCols.includes('chat_id')) {
        db.exec('ALTER TABLE transactions ADD COLUMN chat_id INTEGER REFERENCES chats(id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_chat_id ON transactions(chat_id)');
        console.log('[Migration] Added chat_id to transactions');
    }

    // Add chat_id to budgets if missing
    const budgetCols = db.pragma('table_info(budgets)').map(c => c.name);
    if (!budgetCols.includes('chat_id')) {
        db.exec('ALTER TABLE budgets ADD COLUMN chat_id INTEGER REFERENCES chats(id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_budgets_chat_month ON budgets(chat_id, month)');
        console.log('[Migration] Added chat_id to budgets');
    }
}

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

    // Run migrations for existing DBs
    runMigrations(db);

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
