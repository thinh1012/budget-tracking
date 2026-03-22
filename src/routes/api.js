const express = require('express');
const XLSX = require('xlsx');
const { getTransactions, getSummary, getCategoryBreakdown, getMonthlyTrends, getCategories, getYearlySummary, getContributorBreakdown, getUserSpending, deleteTransaction, updateTransaction, getOrCreateCategory, mergeCategories } = require('../services/transactionService');
const { getThresholdByChatRowId, setThresholdByChatRowId, removeThresholdByChatRowId, getChatBudgetsByChatRowId, setChatBudgetByChatRowId, deleteChatBudgetByChatRowId, getKeywords, setKeyword, deleteKeyword } = require('../services/alertService');
const { getDatabase } = require('../database/database');

const router = express.Router();
const sessionChatId = (req) => req.session.telegramChatId || null;

router.get('/summary', (req, res) => {
    try { res.json(getSummary({ startDate: req.query.startDate, endDate: req.query.endDate, chatId: sessionChatId(req) })); }
    catch (e) { res.status(500).json({ error: 'Failed to get summary' }); }
});

router.get('/transactions', (req, res) => {
    try {
        const { startDate, endDate, categoryId, limit = 50, offset = 0 } = req.query;
        res.json(getTransactions({ startDate, endDate, categoryId: categoryId ? parseInt(categoryId) : undefined, chatId: sessionChatId(req), limit: parseInt(limit), offset: parseInt(offset) }));
    } catch (e) { res.status(500).json({ error: 'Failed to get transactions' }); }
});

router.get('/categories', (req, res) => {
    try { res.json(getCategoryBreakdown({ startDate: req.query.startDate, endDate: req.query.endDate, chatId: sessionChatId(req) })); }
    catch (e) { res.status(500).json({ error: 'Failed to get category breakdown' }); }
});

router.get('/categories/list', (req, res) => {
    try {
        const db = getDatabase();
        const cats = db.prepare(`
            SELECT c.id, c.name, c.type, COUNT(t.id) as tx_count
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id
            GROUP BY c.id ORDER BY c.type, c.name
        `).all();
        res.json(cats);
    }
    catch (e) { res.status(500).json({ error: 'Failed to get categories' }); }
});

router.post('/categories', (req, res) => {
    try {
        const { name, type } = req.body;
        if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
        const cat = getOrCreateCategory(name.trim(), type);
        res.json(cat);
    } catch (e) { res.status(500).json({ error: 'Failed to create category' }); }
});

router.post('/categories/merge', (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
        const result = mergeCategories(from, to, null);
        if (!result.ok) return res.status(400).json({ error: result.error });
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Failed to merge categories' }); }
});

router.delete('/categories/:name', (req, res) => {
    try {
        const db = getDatabase();
        const cat = db.prepare('SELECT id FROM categories WHERE LOWER(name) = ?').get(req.params.name.toLowerCase());
        if (!cat) return res.status(404).json({ error: 'Category not found' });
        const count = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE category_id = ?').get(cat.id);
        if (count.c > 0) return res.status(400).json({ error: `Cannot delete: ${count.c} transaction(s) use this category. Merge it first.` });
        db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete category' }); }
});

router.get('/trends', (req, res) => {
    try { res.json(getMonthlyTrends(parseInt(req.query.months || 6), sessionChatId(req))); }
    catch (e) { res.status(500).json({ error: 'Failed to get trends' }); }
});

router.get('/analytics/yearly', (req, res) => {
    try { res.json(getYearlySummary(sessionChatId(req))); }
    catch (e) { res.status(500).json({ error: 'Failed to get yearly summary' }); }
});

router.get('/contributors', (req, res) => {
    try { res.json(getContributorBreakdown({ startDate: req.query.startDate, endDate: req.query.endDate, chatId: sessionChatId(req) })); }
    catch (e) { res.status(500).json({ error: 'Failed to get contributors' }); }
});

router.get('/users/spending', (req, res) => {
    try { res.json(getUserSpending({ startDate: req.query.startDate, endDate: req.query.endDate, chatId: sessionChatId(req) })); }
    catch (e) { res.status(500).json({ error: 'Failed to get user spending' }); }
});

router.get('/export', (req, res) => {
    try {
        const { startDate, endDate, format = 'csv' } = req.query;

        // Fetch all transactions (no limit) for the current filter
        const rows = getTransactions({ startDate, endDate, chatId: sessionChatId(req), limit: 99999, offset: 0 });

        // Shape data for export
        const data = rows.map(r => ({
            Date: r.created_at ? r.created_at.slice(0, 10) : '',
            Type: r.category_type,
            Category: r.category,
            Amount: r.amount,
            Description: r.description || '',
            Contributor: r.contributor || '',
            User: r.first_name || r.username || ''
        }));

        const filename = `budget-export-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buf);
        }

        // Default: CSV
        const header = Object.keys(data[0] || { Date:'', Type:'', Category:'', Amount:'', Description:'', Contributor:'', User:'' });
        const csv = [
            header.join(','),
            ...data.map(r => header.map(k => JSON.stringify(r[k] ?? '')).join(','))
        ].join('\n');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);

    } catch (e) {
        console.error('Export error:', e);
        res.status(500).json({ error: 'Export failed' });
    }
});

router.put('/transactions/:id', (req, res) => {
    try {
        const { amount, categoryName, categoryType, description, contributor, date } = req.body;
        if (!amount || !categoryName || !date) return res.status(400).json({ error: 'amount, categoryName, and date are required' });
        const success = updateTransaction(req.params.id, { amount: parseInt(amount), categoryName, categoryType, description, contributor, date });
        if (!success) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to update transaction' }); }
});

router.delete('/transactions/:id', (req, res) => {
    try {
        const success = deleteTransaction(req.params.id);
        if (!success) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete transaction' }); }
});

// Spending limit (threshold) — scoped to session's chat
router.get('/alert', (req, res) => {
    try {
        const chatId = req.session.chatRowId || null;
        if (!chatId) return res.json({ threshold: null });
        const alert = getThresholdByChatRowId(chatId);
        res.json({ threshold: alert ? alert.threshold : null });
    } catch (e) { res.status(500).json({ error: 'Failed to get alert' }); }
});

router.post('/alert', (req, res) => {
    try {
        const chatId = req.session.chatRowId || null;
        if (!chatId) return res.status(403).json({ error: 'Admin accounts cannot set a limit here' });
        const { threshold } = req.body;
        if (threshold === null || threshold === undefined || threshold === '') {
            removeThresholdByChatRowId(chatId);
        } else {
            setThresholdByChatRowId(chatId, parseInt(threshold));
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to set alert' }); }
});

// ─── Category budgets ─────────────────────────────────────────────────────────
router.get('/cat-budgets', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        const chatId = sessionChatId(req);
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const spending = getCategoryBreakdown({ startDate: monthStart, chatId });

        const budgets = chatRowId ? getChatBudgetsByChatRowId(chatRowId) : [];
        const budgetMap = {};
        budgets.forEach(b => { budgetMap[b.category] = b.amount; });

        const result = spending
            .filter(s => s.category_type === 'expense')
            .map(s => ({
                category: s.category,
                spent: s.total,
                limit: budgetMap[s.category] || null,
                percent: budgetMap[s.category] ? Math.round((s.total / budgetMap[s.category]) * 100) : null
            }));

        // Include budgeted categories with zero spending this month
        budgets.forEach(b => {
            if (!result.find(r => r.category === b.category)) {
                result.push({ category: b.category, spent: 0, limit: b.amount, percent: 0 });
            }
        });

        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Failed to get category budgets' }); }
});

router.post('/cat-budgets', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        if (!chatRowId) return res.status(403).json({ error: 'Admin accounts cannot set category budgets' });
        const { category, amount } = req.body;
        if (!category || !amount || parseInt(amount) <= 0) return res.status(400).json({ error: 'Invalid category or amount' });
        setChatBudgetByChatRowId(chatRowId, category, parseInt(amount));
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to set budget' }); }
});

router.delete('/cat-budgets/:category', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        if (!chatRowId) return res.status(403).json({ error: 'Forbidden' });
        deleteChatBudgetByChatRowId(chatRowId, req.params.category);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete budget' }); }
});

// ─── Admin overview ───────────────────────────────────────────────────────────
router.get('/admin/overview', (req, res) => {
    if (!req.session.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const db = getDatabase();
        const users = db.prepare('SELECT COUNT(*) as c FROM dashboard_accounts WHERE is_admin = 0').get();
        const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions').get();
        const income = db.prepare("SELECT COALESCE(SUM(t.amount),0) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE c.type = 'income'").get();
        const expenses = db.prepare("SELECT COALESCE(SUM(t.amount),0) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE c.type = 'expense'").get();
        res.json({ users: users.c, transactions: txCount.c, income: income.total, expenses: expenses.total });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ─── Category keyword mappings ────────────────────────────────────────────────
router.get('/keywords', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        if (!chatRowId) return res.json([]);
        res.json(getKeywords(chatRowId));
    } catch (e) { res.status(500).json({ error: 'Failed to get keywords' }); }
});

router.post('/keywords', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        if (!chatRowId) return res.status(403).json({ error: 'Forbidden' });
        const { keyword, category } = req.body;
        if (!keyword || !category) return res.status(400).json({ error: 'keyword and category are required' });
        setKeyword(chatRowId, keyword, category);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to set keyword' }); }
});

router.delete('/keywords/:keyword', (req, res) => {
    try {
        const chatRowId = req.session.chatRowId || null;
        if (!chatRowId) return res.status(403).json({ error: 'Forbidden' });
        deleteKeyword(chatRowId, req.params.keyword);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete keyword' }); }
});

module.exports = router;
