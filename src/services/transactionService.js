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

function searchTransactions({ telegramUserId, categoryName, limit, days } = {}) {
    const db = getDatabase();
    if (!limit) limit = 5;
    const user = getOrCreateUser({ id: telegramUserId });
    let q = 'SELECT t.amount, t.description, t.contributor, t.created_at, c.name as category, c.type as category_type FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.user_id = ?';
    const p = [user.id];
    if (categoryName) { q += ' AND c.name = ?'; p.push(categoryName.toLowerCase().trim()); }
    if (days) { q += "AND t.created_at >= date('now', ?)"; p.push('-' + days + ' days'); }
    q += ' ORDER BY t.created_at DESC LIMIT ?';
    p.push(limit);
    return db.prepare(q).all(...p);
}

module.exports = { getOrCreateUser, getOrCreateChat, getOrCreateCategory, createTransaction, getTransactions, getSummary, getCategoryBreakdown, getMonthlyTrends, getCategories, getYearlySummary, getContributorBreakdown, getUserSpending, getUserCategories, getUserContributors, getCommonCategories, getUserRecentTransactions, deleteTransaction, searchTransactions };
