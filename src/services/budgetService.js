const { getDatabase } = require('../database/database');
const { getOrCreateCategory, getOrCreateUser } = require('./transactionService');

/**
 * Set a budget for a category
 */
function setBudget(telegramUserId, categoryName, amount, month = null) {
    const db = getDatabase();

    // Default to current month if not provided
    if (!month) {
        month = new Date().toISOString().slice(0, 7); // YYYY-MM
    }

    const user = getOrCreateUser({ id: telegramUserId });
    const category = getOrCreateCategory(categoryName);

    const stmt = db.prepare(`
        INSERT INTO budgets (user_id, category_id, amount, month)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, category_id, month) DO UPDATE SET amount = EXCLUDED.amount
    `);

    const result = stmt.run(user.id, category.id, amount, month);
    return result.changes > 0;
}

/**
 * Get current month budget status for a category
 */
function getBudgetStatus(telegramUserId, categoryId, month = null) {
    const db = getDatabase();

    if (!month) {
        month = new Date().toISOString().slice(0, 7);
    }

    const user = getOrCreateUser({ id: telegramUserId });

    // Get the budget limit
    const budget = db.prepare(`
        SELECT amount FROM budgets 
        WHERE user_id = ? AND category_id = ? AND month = ?
    `).get(user.id, categoryId, month);

    if (!budget) return null;

    // Get the current spending in this month for this category
    const spending = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        WHERE t.user_id = ? AND t.category_id = ? AND strftime('%Y-%m', t.created_at) = ?
    `).get(user.id, categoryId, month);

    return {
        limit: budget.amount,
        spent: spending.total,
        remaining: budget.amount - spending.total,
        percent: (spending.total / budget.amount) * 100
    };
}

/**
 * Get all budgets for a user in a specific month
 */
function getUserBudgets(telegramUserId, month = null) {
    const db = getDatabase();

    if (!month) {
        month = new Date().toISOString().slice(0, 7);
    }

    const user = getOrCreateUser({ id: telegramUserId });

    return db.prepare(`
        SELECT 
            b.amount as limit_amount,
            c.name as category,
            COALESCE(SUM(t.amount), 0) as spent
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        LEFT JOIN transactions t ON t.category_id = c.id 
            AND t.user_id = b.user_id 
            AND strftime('%Y-%m', t.created_at) = b.month
        WHERE b.user_id = ? AND b.month = ?
        GROUP BY b.id
    `).all(user.id, month);
}

module.exports = {
    setBudget,
    getBudgetStatus,
    getUserBudgets
};
