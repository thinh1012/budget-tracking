const { getDatabase } = require('../database/database');

function getOrCreateUser(telegramUser) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramUser.id);
    if (existing) return existing;
    const result = db.prepare('INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)').run(telegramUser.id, telegramUser.username || null, telegramUser.first_name || null);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

function getOrCreateChat(telegramChatId, title) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM chats WHERE telegram_chat_id = ?').get(telegramChatId);
    if (existing) return existing;
    const result = db.prepare('INSERT INTO chats (telegram_chat_id, title) VALUES (?, ?)').run(telegramChatId, title || null);
    return db.prepare('SELECT * FROM chats WHERE id = ?').get(result.lastInsertRowid);
}

function getOrCreateCategory(name, type) {
    const db = getDatabase();
    if (!type) type = 'expense';
    const normalized = name.toLowerCase().trim();
    const existing = db.prepare('SELECT * FROM categories WHERE name = ?').get(normalized);
    if (existing) return existing;
    const categoryType = (normalized === 'income') ? 'income' : type;
    const result = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)').run(normalized, categoryType);
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

function createTransaction({ amount, categoryName, categoryType, description, contributor, telegramUser, telegramChat, messageId, receiptFileId }) {
    const db = getDatabase();
    if (!categoryType) categoryType = 'expense';
    const user = getOrCreateUser(telegramUser);
    const category = getOrCreateCategory(categoryName, categoryType);
    let chatRecord = null;
    if (telegramChat) chatRecord = getOrCreateChat(telegramChat.id, telegramChat.title || telegramChat.first_name || null);
    if (messageId) {
        const existing = db.prepare('SELECT t.id, t.amount, c.name as category, c.type as category_type, t.description, t.contributor FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.telegram_message_id = ? AND t.user_id = ?').get(messageId, user.id);
        if (existing) {
            console.log('[IDEMPOTENCY] Duplicate for user ' + user.id + ', message ' + messageId);
            return { id: existing.id, amount: existing.amount, category: existing.category, categoryId: existing.category_id, categoryType: existing.category_type, description: existing.description, contributor: existing.contributor, user: user.first_name || user.username, isDuplicate: true };
        }
    }
    const result = db.prepare('INSERT INTO transactions (amount, category_id, description, contributor, user_id, chat_id, telegram_message_id, receipt_file_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(amount, category.id, description || null, contributor || null, user.id, chatRecord ? chatRecord.id : null, messageId || null, receiptFileId || null);
    return { id: result.lastInsertRowid, amount, category: category.name, categoryId: category.id, categoryType: category.type, description, contributor, user: user.first_name || user.username };
}

function getTransactions({ startDate, endDate, categoryId, chatId, limit, offset } = {}) {
    const db = getDatabase();
    if (!limit) limit = 50;
    if (!offset) offset = 0;
    let q = 'SELECT t.id, t.amount, t.description, t.contributor, t.created_at, c.name as category, c.type as category_type, u.first_name, u.username FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE 1=1';
    const p = [];
    if (chatId) { q += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    if (startDate) { q += ' AND t.created_at >= ?'; p.push(startDate); }
    if (endDate) { q += ' AND t.created_at <= ?'; p.push(endDate); }
    if (categoryId) { q += ' AND t.category_id = ?'; p.push(categoryId); }
    q += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    return db.prepare(q).all(...p);
}

function getSummary({ startDate, endDate, chatId } = {}) {
    const db = getDatabase();
    const cf = chatId ? ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)' : '';
    const base = chatId ? [chatId] : [];
    const extra = [...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])];
    const df = (startDate ? ' AND t.created_at >= ?' : '') + (endDate ? ' AND t.created_at <= ?' : '');
    const income = db.prepare("SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE c.type = 'income'" + cf + df).get(...base, ...extra);
    const expenses = db.prepare("SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE c.type = 'expense'" + cf + df).get(...base, ...extra);
    return { income: income.total, expenses: expenses.total, savings: income.total - expenses.total };
}

function getCategoryBreakdown({ startDate, endDate, chatId } = {}) {
    const db = getDatabase();
    let f = '1=1'; const p = [];
    if (chatId) { f += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    if (startDate) { f += ' AND t.created_at >= ?'; p.push(startDate); }
    if (endDate) { f += ' AND t.created_at <= ?'; p.push(endDate); }
    return db.prepare('SELECT c.name as category, c.type as category_type, SUM(t.amount) as total, COUNT(*) as count FROM transactions t JOIN categories c ON t.category_id = c.id WHERE ' + f + ' GROUP BY c.id ORDER BY total DESC').all(...p);
}

function getMonthlyTrends(months, chatId) {
    const db = getDatabase();
    if (!months) months = 6;
    let cf = ''; const p = [];
    if (chatId) { cf = 'AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    return db.prepare("SELECT strftime('%Y-%m', t.created_at) as month, c.type as category_type, SUM(t.amount) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.created_at >= date('now', '-" + months + " months') " + cf + " GROUP BY month, c.type ORDER BY month ASC").all(...p);
}

function getCategories() { return getDatabase().prepare('SELECT * FROM categories ORDER BY type, name').all(); }

function getYearlySummary(chatId) {
    const db = getDatabase();
    let cf = ''; const p = [];
    if (chatId) { cf = 'AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    return db.prepare("SELECT strftime('%Y', t.created_at) as year, c.type as category_type, SUM(t.amount) as total, COUNT(*) as count FROM transactions t JOIN categories c ON t.category_id = c.id WHERE 1=1 " + cf + " GROUP BY year, c.type ORDER BY year DESC").all(...p);
}

function getContributorBreakdown({ startDate, endDate, chatId } = {}) {
    const db = getDatabase();
    let f = "c.type = 'income' AND t.contributor IS NOT NULL"; const p = [];
    if (chatId) { f += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    if (startDate) { f += ' AND t.created_at >= ?'; p.push(startDate); }
    if (endDate) { f += ' AND t.created_at <= ?'; p.push(endDate); }
    return db.prepare('SELECT t.contributor, SUM(t.amount) as total, COUNT(*) as count FROM transactions t JOIN categories c ON t.category_id = c.id WHERE ' + f + ' GROUP BY t.contributor ORDER BY total DESC').all(...p);
}

function getUserSpending({ startDate, endDate, chatId } = {}) {
    const db = getDatabase();
    let f = '1=1'; const p = [];
    if (chatId) { f += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    if (startDate) { f += ' AND t.created_at >= ?'; p.push(startDate); }
    if (endDate) { f += ' AND t.created_at <= ?'; p.push(endDate); }
    return db.prepare('SELECT COALESCE(u.first_name, u.username) as user, c.type as category_type, SUM(t.amount) as total, COUNT(*) as count FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE ' + f + ' GROUP BY u.id, c.type ORDER BY total DESC').all(...p);
}

function getUserCategories(tid) { return getDatabase().prepare("SELECT DISTINCT c.name FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE u.telegram_id = ? AND c.type = 'expense' ORDER BY c.name").all(tid).map(r => r.name); }
function getUserContributors(tid) { return getDatabase().prepare("SELECT DISTINCT t.contributor FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE u.telegram_id = ? AND c.type = 'income' AND t.contributor IS NOT NULL ORDER BY t.contributor").all(tid).map(r => r.contributor); }
function getCommonCategories(tid, limit) { if (!limit) limit = 5; return getDatabase().prepare("SELECT c.name, COUNT(*) as usage_count FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE u.telegram_id = ? AND c.type = 'expense' GROUP BY c.id ORDER BY usage_count DESC LIMIT ?").all(tid, limit).map(r => r.name); }
function getUserRecentTransactions(tid, limit) { if (!limit) limit = 3; return getDatabase().prepare('SELECT t.amount, t.description, c.name as category, c.type as category_type, t.contributor FROM transactions t JOIN categories c ON t.category_id = c.id JOIN users u ON t.user_id = u.id WHERE u.telegram_id = ? ORDER BY t.created_at DESC LIMIT ?').all(tid, limit); }
function deleteTransaction(id) { const result = getDatabase().prepare('DELETE FROM transactions WHERE id = ?').run(id); return result.changes > 0; }

function updateTransaction(id, { amount, categoryName, categoryType, description, contributor, date }) {
    const db = getDatabase();
    const category = getOrCreateCategory(categoryName, categoryType || 'expense');
    const result = db.prepare(
        'UPDATE transactions SET amount=?, category_id=?, description=?, contributor=?, created_at=? WHERE id=?'
    ).run(amount, category.id, description || null, contributor || null, date, id);
    return result.changes > 0;
}

function searchTransactions({ telegramUserId, categoryName, limit, days, chatId } = {}) {
    const db = getDatabase();
    if (!limit) limit = 5;
    let q = 'SELECT t.amount, t.description, t.contributor, t.created_at, c.name as category, c.type as category_type FROM transactions t JOIN categories c ON t.category_id = c.id WHERE 1=1';
    const p = [];
    if (telegramUserId) {
        const user = getOrCreateUser({ id: telegramUserId });
        q += ' AND t.user_id = ?'; p.push(user.id);
    }
    if (chatId) { q += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(chatId); }
    if (categoryName) { q += ' AND c.name = ?'; p.push(categoryName.toLowerCase().trim()); }
    if (days) { q += " AND t.created_at >= date('now', ?)"; p.push('-' + days + ' days'); }
    q += ' ORDER BY t.created_at DESC LIMIT ?';
    p.push(limit);
    return db.prepare(q).all(...p);
}

// ─── Smart categorization ─────────────────────────────────────────────────────
function suggestCategoryFromHistory(telegramChatId, keyword) {
    if (!keyword || keyword.length < 2) return null;
    const db = getDatabase();
    const kw = keyword.toLowerCase();
    // If this keyword is already a well-established category in this chat, don't override
    const asCategory = db.prepare(`SELECT COUNT(*) as c FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?) AND LOWER(c.name) = ?`).get(telegramChatId, kw);
    if (asCategory && asCategory.c >= 5) return null;
    // Check if keyword appears as description under a different, more common category
    const suggestion = db.prepare(`SELECT c.name, COUNT(*) as freq FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?) AND c.type = 'expense' AND LOWER(c.name) != ? AND (LOWER(t.description) LIKE ? OR LOWER(t.description) = ?) GROUP BY c.id ORDER BY freq DESC LIMIT 1`).get(telegramChatId, kw, `%${kw}%`, kw);
    return (suggestion && suggestion.freq >= 2) ? suggestion.name : null;
}

// ─── Category management ──────────────────────────────────────────────────────
function getChatCategories(telegramChatId, month) {
    if (!month) month = new Date().toISOString().slice(0, 7);
    const db = getDatabase();
    return db.prepare(`SELECT c.name, c.type, COALESCE(SUM(CASE WHEN strftime('%Y-%m', t.created_at) = ? THEN t.amount ELSE 0 END), 0) as this_month, COUNT(DISTINCT t.id) as total_tx FROM categories c JOIN transactions t ON t.category_id = c.id AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?) GROUP BY c.id ORDER BY this_month DESC, total_tx DESC`).all(month, telegramChatId);
}

function mergeCategories(fromName, toName, telegramChatId) {
    const db = getDatabase();
    const fromCat = db.prepare('SELECT id FROM categories WHERE LOWER(name) = ?').get(fromName.toLowerCase());
    const toCat = db.prepare('SELECT id, name FROM categories WHERE LOWER(name) = ?').get(toName.toLowerCase());
    if (!fromCat) return { ok: false, error: `Category "${fromName}" not found` };
    if (!toCat) return { ok: false, error: `Category "${toName}" not found` };
    if (fromCat.id === toCat.id) return { ok: false, error: 'Same category' };
    const chatRow = telegramChatId ? db.prepare('SELECT id FROM chats WHERE telegram_chat_id = ?').get(telegramChatId) : null;
    let q = 'UPDATE transactions SET category_id = ? WHERE category_id = ?';
    const p = [toCat.id, fromCat.id];
    if (chatRow) { q += ' AND chat_id = ?'; p.push(chatRow.id); }
    const result = db.prepare(q).run(...p);
    const remaining = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE category_id = ?').get(fromCat.id);
    if (remaining.c === 0) db.prepare('DELETE FROM categories WHERE id = ?').run(fromCat.id);
    return { ok: true, count: result.changes, toName: toCat.name };
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}

function findNearDuplicates(categoryNames) {
    const pairs = [];
    for (let i = 0; i < categoryNames.length; i++) {
        for (let j = i + 1; j < categoryNames.length; j++) {
            const a = categoryNames[i], b = categoryNames[j];
            if (Math.min(a.length, b.length) < 3) continue;
            if (a.includes(b) || b.includes(a) || (levenshtein(a, b) <= 2 && Math.min(a.length, b.length) >= 4)) pairs.push([a, b]);
        }
    }
    return pairs;
}

module.exports = { getOrCreateUser, getOrCreateChat, getOrCreateCategory, createTransaction, getTransactions, getSummary, getCategoryBreakdown, getMonthlyTrends, getCategories, getYearlySummary, getContributorBreakdown, getUserSpending, getUserCategories, getUserContributors, getCommonCategories, getUserRecentTransactions, deleteTransaction, updateTransaction, searchTransactions, suggestCategoryFromHistory, getChatCategories, mergeCategories, findNearDuplicates };
