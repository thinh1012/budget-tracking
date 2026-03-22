const { getDatabase } = require('../database/database');

function initAlertTable() {
    getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS spending_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL UNIQUE,
            threshold INTEGER NOT NULL,
            last_notified_month TEXT
        )
    `);
}

function getChatRecord(telegramChatId) {
    return getDatabase().prepare('SELECT id FROM chats WHERE telegram_chat_id = ?').get(telegramChatId);
}

function setThreshold(telegramChatId, amount) {
    const chat = getChatRecord(telegramChatId);
    if (!chat) return false;
    getDatabase().prepare(`
        INSERT INTO spending_alerts (chat_id, threshold) VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET threshold = excluded.threshold
    `).run(chat.id, amount);
    return true;
}

function removeThreshold(telegramChatId) {
    const chat = getChatRecord(telegramChatId);
    if (!chat) return false;
    getDatabase().prepare('DELETE FROM spending_alerts WHERE chat_id = ?').run(chat.id);
    return true;
}

function getThreshold(telegramChatId) {
    const chat = getChatRecord(telegramChatId);
    if (!chat) return null;
    return getDatabase().prepare('SELECT threshold, last_notified_month FROM spending_alerts WHERE chat_id = ?').get(chat.id);
}

function getThresholdByChatRowId(chatRowId) {
    return getDatabase().prepare('SELECT threshold, last_notified_month FROM spending_alerts WHERE chat_id = ?').get(chatRowId);
}

function setThresholdByChatRowId(chatRowId, amount) {
    getDatabase().prepare(`
        INSERT INTO spending_alerts (chat_id, threshold) VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET threshold = excluded.threshold
    `).run(chatRowId, amount);
}

function removeThresholdByChatRowId(chatRowId) {
    getDatabase().prepare('DELETE FROM spending_alerts WHERE chat_id = ?').run(chatRowId);
}

function checkAndNotify(bot, telegramChatId) {
    const db = getDatabase();
    const chat = getChatRecord(telegramChatId);
    if (!chat) return;

    const alert = db.prepare('SELECT threshold, last_notified_month FROM spending_alerts WHERE chat_id = ?').get(chat.id);
    if (!alert) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (alert.last_notified_month === currentMonth) return;

    const monthStart = `${currentMonth}-01`;
    const { total } = db.prepare(`
        SELECT COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE c.type = 'expense' AND t.chat_id = ? AND t.created_at >= ?
    `).get(chat.id, monthStart);

    if (total >= alert.threshold) {
        const { formatAmount } = require('../bot/messageParser');
        const text =
            `⚠️ *Budget Limit Reached!*\n\n` +
            `Total spending this month hit *${formatAmount(total)} ₫*, ` +
            `crossing your limit of *${formatAmount(alert.threshold)} ₫*.\n\n` +
            `_Use /summary to see your full breakdown._`;

        bot.sendMessage(telegramChatId, text, { parse_mode: 'Markdown' });
        db.prepare('UPDATE spending_alerts SET last_notified_month = ? WHERE chat_id = ?').run(currentMonth, chat.id);
    }
}

// ─── Chat-level category budgets ─────────────────────────────────────────────
function initChatBudgetsTable() {
    getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS chat_budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            amount INTEGER NOT NULL,
            UNIQUE(chat_id, category)
        )
    `);
}

function getChatBudgetsByChatRowId(chatRowId) {
    return getDatabase().prepare('SELECT category, amount FROM chat_budgets WHERE chat_id = ? ORDER BY category').all(chatRowId);
}

function setChatBudgetByChatRowId(chatRowId, category, amount) {
    getDatabase().prepare(`
        INSERT INTO chat_budgets (chat_id, category, amount) VALUES (?, ?, ?)
        ON CONFLICT(chat_id, category) DO UPDATE SET amount = excluded.amount
    `).run(chatRowId, category.toLowerCase(), amount);
}

function deleteChatBudgetByChatRowId(chatRowId, category) {
    getDatabase().prepare('DELETE FROM chat_budgets WHERE chat_id = ? AND category = ?').run(chatRowId, category);
}

// ─── Category keyword mappings ────────────────────────────────────────────────
function initKeywordsTable() {
    getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS category_keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            keyword TEXT NOT NULL,
            category TEXT NOT NULL,
            UNIQUE(chat_id, keyword)
        )
    `);
}

function getKeywords(chatRowId) {
    return getDatabase().prepare('SELECT keyword, category FROM category_keywords WHERE chat_id = ? ORDER BY keyword').all(chatRowId);
}

function setKeyword(chatRowId, keyword, category) {
    getDatabase().prepare(`
        INSERT INTO category_keywords (chat_id, keyword, category) VALUES (?, ?, ?)
        ON CONFLICT(chat_id, keyword) DO UPDATE SET category = excluded.category
    `).run(chatRowId, keyword.toLowerCase().trim(), category.toLowerCase().trim());
}

function deleteKeyword(chatRowId, keyword) {
    getDatabase().prepare('DELETE FROM category_keywords WHERE chat_id = ? AND keyword = ?').run(chatRowId, keyword.toLowerCase().trim());
}

function lookupKeyword(telegramChatId, keyword) {
    const db = getDatabase();
    const chat = db.prepare('SELECT id FROM chats WHERE telegram_chat_id = ?').get(telegramChatId);
    if (!chat) return null;
    const row = db.prepare('SELECT category FROM category_keywords WHERE chat_id = ? AND keyword = ?').get(chat.id, keyword.toLowerCase().trim());
    return row ? row.category : null;
}

module.exports = { initAlertTable, setThreshold, removeThreshold, getThreshold, getThresholdByChatRowId, setThresholdByChatRowId, removeThresholdByChatRowId, checkAndNotify, initChatBudgetsTable, getChatBudgetsByChatRowId, setChatBudgetByChatRowId, deleteChatBudgetByChatRowId, initKeywordsTable, getKeywords, setKeyword, deleteKeyword, lookupKeyword };
