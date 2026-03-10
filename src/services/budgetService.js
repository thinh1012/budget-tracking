const { getDatabase } = require('../database/database');
const { getOrCreateCategory, getOrCreateUser, getOrCreateChat } = require('./transactionService');

function setBudget(telegramUserId, categoryName, amount, month, telegramChatId) {
    const db = getDatabase();
    if (!month) month = new Date().toISOString().slice(0, 7);
    const user = getOrCreateUser({ id: telegramUserId });
    const category = getOrCreateCategory(categoryName);
    let chatRecord = null;
    if (telegramChatId) chatRecord = getOrCreateChat(telegramChatId);
    const result = db.prepare('INSERT INTO budgets (user_id, chat_id, category_id, amount, month) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, category_id, month) DO UPDATE SET amount = excluded.amount').run(user.id, chatRecord ? chatRecord.id : null, category.id, amount, month);
    return result.changes > 0;
}

function getBudgetStatus(telegramUserId, categoryId, month, telegramChatId) {
    const db = getDatabase();
    if (!month) month = new Date().toISOString().slice(0, 7);
    const user = getOrCreateUser({ id: telegramUserId });
    const budget = db.prepare('SELECT amount FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?').get(user.id, categoryId, month);
    if (!budget) return null;
    let q = "SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t WHERE t.user_id = ? AND t.category_id = ? AND strftime('%Y-%m', t.created_at) = ?";
    const p = [user.id, categoryId, month];
    if (telegramChatId) { q += ' AND t.chat_id = (SELECT id FROM chats WHERE telegram_chat_id = ?)'; p.push(telegramChatId); }
    const spending = db.prepare(q).get(...p);
    return { limit: budget.amount, spent: spending.total, remaining: budget.amount - spending.total, percent: (spending.total / budget.amount) * 100 };
}

function getUserBudgets(telegramUserId, month) {
    const db = getDatabase();
    if (!month) month = new Date().toISOString().slice(0, 7);
    const user = getOrCreateUser({ id: telegramUserId });
    return db.prepare("SELECT b.amount as limit_amount, c.name as category, COALESCE(SUM(t.amount), 0) as spent FROM budgets b JOIN categories c ON b.category_id = c.id LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = b.user_id AND strftime('%Y-%m', t.created_at) = b.month WHERE b.user_id = ? AND b.month = ? GROUP BY b.id").all(user.id, month);
}

module.exports = { setBudget, getBudgetStatus, getUserBudgets };
