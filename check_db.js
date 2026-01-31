const { initDatabase, getDatabase } = require('./src/database/database');
initDatabase();
const db = getDatabase();

console.log('Recent Transactions:');
const transactions = db.prepare(`
    SELECT t.id, t.amount, c.name, c.type 
    FROM transactions t 
    JOIN categories c ON t.category_id = c.id 
    ORDER BY t.created_at DESC LIMIT 10
`).all();
console.table(transactions);

const summary = db.prepare(`
    SELECT 
        c.type,
        SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    GROUP BY c.type
`).all();
console.log('Summary by Type:');
console.table(summary);
