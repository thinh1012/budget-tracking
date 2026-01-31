const { getDatabase } = require('../database/database');

/**
 * Get or create a user from Telegram data
 */
function getOrCreateUser(telegramUser) {
    const db = getDatabase();

    const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramUser.id);
    if (existing) {
        return existing;
    }

    const insert = db.prepare(`
        INSERT INTO users (telegram_id, username, first_name)
        VALUES (?, ?, ?)
    `);
    const result = insert.run(telegramUser.id, telegramUser.username || null, telegramUser.first_name || null);

    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Get or create a category by name
 */
function getOrCreateCategory(name, type = 'expense') {
    const db = getDatabase();
    const normalized = name.toLowerCase().trim();

    const existing = db.prepare('SELECT * FROM categories WHERE name = ?').get(normalized);
    if (existing) {
        // If type is explicitly provided and doesn't match, we could update or log.
        // For now, we trust the first creation.
        return existing;
    }

    // Determine type: explicitly provided or based on name
    const categoryType = (normalized === 'income') ? 'income' : type;

    const insert = db.prepare(`
        INSERT INTO categories (name, type)
        VALUES (?, ?)
    `);
    const result = insert.run(normalized, categoryType);

    return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Create a new transaction
 */
function createTransaction({ amount, categoryName, categoryType = 'expense', description, contributor, telegramUser, messageId, receiptFileId }) {
    const db = getDatabase();

    const user = getOrCreateUser(telegramUser);
    const category = getOrCreateCategory(categoryName, categoryType);

    // [IDEMPOTENCY] Check if message ID has already been processed for this user
    if (messageId) {
        const existing = db.prepare(`
            SELECT t.id, t.amount, c.name as category, c.type as category_type, t.description, t.contributor
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.telegram_message_id = ? AND t.user_id = ?
        `).get(messageId, user.id);

        if (existing) {
            console.log(`[IDEMPOTENCY] Duplicate detected for user ${user.id}, message ${messageId}. Returning existing.`);
            return {
                id: existing.id,
                amount: existing.amount,
                category: existing.category,
                categoryId: existing.category_id,
                categoryType: existing.category_type,
                description: existing.description,
                contributor: existing.contributor,
                user: user.first_name || user.username,
                isDuplicate: true
            };
        }
    }

    const insert = db.prepare(`
        INSERT INTO transactions (amount, category_id, description, contributor, user_id, telegram_message_id, receipt_file_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
        amount,
        category.id,
        description || null,
        contributor || null,
        user.id,
        messageId || null,
        receiptFileId || null
    );

    return {
        id: result.lastInsertRowid,
        amount,
        category: category.name,
        categoryId: category.id,
        categoryType: category.type,
        description,
        contributor,
        user: user.first_name || user.username
    };
}

/**
 * Get transactions with optional filters
 */
function getTransactions({ startDate, endDate, categoryId, limit = 50, offset = 0 } = {}) {
    const db = getDatabase();

    let query = `
        SELECT 
            t.id,
            t.amount,
            t.description,
            t.contributor,
            t.created_at,
            c.name as category,
            c.type as category_type,
            u.first_name,
            u.username
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (startDate) {
        query += ' AND t.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND t.created_at <= ?';
        params.push(endDate);
    }
    if (categoryId) {
        query += ' AND t.category_id = ?';
        params.push(categoryId);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
}

/**
 * Get summary (total income, expenses, savings)
 */
function getSummary({ startDate, endDate } = {}) {
    const db = getDatabase();

    let dateFilter = '';
    const params = [];

    if (startDate) {
        dateFilter += ' AND t.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND t.created_at <= ?';
        params.push(endDate);
    }

    const income = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.type = 'income' ${dateFilter}
    `).get(...params);

    const expenses = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.type = 'expense' ${dateFilter}
    `).get(...params);

    return {
        income: income.total,
        expenses: expenses.total,
        savings: income.total - expenses.total
    };
}

/**
 * Get spending breakdown by category
 */
function getCategoryBreakdown({ startDate, endDate } = {}) {
    const db = getDatabase();

    let dateFilter = '';
    const params = [];

    if (startDate) {
        dateFilter += ' AND t.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND t.created_at <= ?';
        params.push(endDate);
    }

    return db.prepare(`
        SELECT 
            c.name as category,
            c.type as category_type,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE 1=1 ${dateFilter}
        GROUP BY c.id
        ORDER BY total DESC
    `).all(...params);
}

/**
 * Get monthly trends
 */
function getMonthlyTrends(months = 6) {
    const db = getDatabase();

    return db.prepare(`
        SELECT 
            strftime('%Y-%m', t.created_at) as month,
            c.type as category_type,
            SUM(t.amount) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.created_at >= date('now', '-${months} months')
        GROUP BY month, c.type
        ORDER BY month ASC
    `).all();
}

/**
 * Get all categories
 */
function getCategories() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories ORDER BY type, name').all();
}

/**
 * Get yearly summary
 */
function getYearlySummary() {
    const db = getDatabase();

    return db.prepare(`
        SELECT 
            strftime('%Y', t.created_at) as year,
            c.type as category_type,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        GROUP BY year, c.type
        ORDER BY year DESC
    `).all();
}

/**
 * Get contributor breakdown (income by contributor)
 */
function getContributorBreakdown({ startDate, endDate } = {}) {
    const db = getDatabase();

    let dateFilter = '';
    const params = [];

    if (startDate) {
        dateFilter += ' AND t.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND t.created_at <= ?';
        params.push(endDate);
    }

    return db.prepare(`
        SELECT 
            t.contributor,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.type = 'income' 
        AND t.contributor IS NOT NULL
        ${dateFilter}
        GROUP BY t.contributor
        ORDER BY total DESC
    `).all(...params);
}

/**
 * Get user spending breakdown (expenses by user)
 */
function getUserSpending({ startDate, endDate } = {}) {
    const db = getDatabase();

    let dateFilter = '';
    const params = [];

    if (startDate) {
        dateFilter += ' AND t.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND t.created_at <= ?';
        params.push(endDate);
    }

    return db.prepare(`
        SELECT 
            COALESCE(u.first_name, u.username) as user,
            c.type as category_type,
            SUM(t.amount) as total,
            COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE 1=1 ${dateFilter}
        GROUP BY u.id, c.type
        ORDER BY total DESC
    `).all(...params);
}

/**
 * Get all unique categories used by a specific user
 */
function getUserCategories(telegramUserId) {
    const db = getDatabase();

    return db.prepare(`
        SELECT DISTINCT c.name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE u.telegram_id = ?
        AND c.type = 'expense'
        ORDER BY c.name
    `).all(telegramUserId).map(row => row.name);
}

/**
 * Get all contributors used by a specific user
 */
function getUserContributors(telegramUserId) {
    const db = getDatabase();

    return db.prepare(`
        SELECT DISTINCT t.contributor
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE u.telegram_id = ?
        AND c.type = 'income'
        AND t.contributor IS NOT NULL
        ORDER BY t.contributor
    `).all(telegramUserId).map(row => row.contributor);
}

/**
 * Get most common categories for a user
 */
function getCommonCategories(telegramUserId, limit = 5) {
    const db = getDatabase();

    return db.prepare(`
        SELECT 
            c.name,
            COUNT(*) as usage_count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE u.telegram_id = ?
        AND c.type = 'expense'
        GROUP BY c.id
        ORDER BY usage_count DESC
        LIMIT ?
    `).all(telegramUserId, limit).map(row => row.name);
}

/**
 * Get recent transactions for a user (for examples)
 */
function getUserRecentTransactions(telegramUserId, limit = 3) {
    const db = getDatabase();

    return db.prepare(`
        SELECT 
            t.amount,
            t.description,
            c.name as category,
            c.type as category_type,
            t.contributor
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.user_id = u.id
        WHERE u.telegram_id = ?
        ORDER BY t.created_at DESC
        LIMIT ?
    `).all(telegramUserId, limit);
}

/**
 * Delete a transaction by ID
 */
function deleteTransaction(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return result.changes > 0;
}

/**
 * Search/Filter transactions (Smart Search)
 */
function searchTransactions({ telegramUserId, categoryName, limit = 5, days = null } = {}) {
    const db = getDatabase();
    const user = getOrCreateUser({ id: telegramUserId });

    let query = `
        SELECT 
            t.amount,
            t.description,
            t.contributor,
            t.created_at,
            c.name as category,
            c.type as category_type
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
    `;

    const params = [user.id];

    if (categoryName) {
        query += " AND c.name = ?";
        params.push(categoryName.toLowerCase().trim());
    }

    if (days) {
        query += " AND t.created_at >= date('now', ?)";
        params.push(`-${days} days`);
    }

    query += " ORDER BY t.created_at DESC LIMIT ?";
    params.push(limit);

    return db.prepare(query).all(...params);
}

module.exports = {
    getOrCreateUser,
    getOrCreateCategory,
    createTransaction,
    getTransactions,
    getSummary,
    getCategoryBreakdown,
    getMonthlyTrends,
    getCategories,
    getYearlySummary,
    getContributorBreakdown,
    getUserSpending,
    getUserCategories,
    getUserContributors,
    getCommonCategories,
    getUserRecentTransactions,
    deleteTransaction,
    searchTransactions
};
