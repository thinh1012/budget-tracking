const express = require('express');
const XLSX = require('xlsx');
const { getTransactions, getSummary, getCategoryBreakdown, getMonthlyTrends, getCategories, getYearlySummary, getContributorBreakdown, getUserSpending } = require('../services/transactionService');

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
    try { res.json(getCategories()); }
    catch (e) { res.status(500).json({ error: 'Failed to get categories' }); }
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

module.exports = router;
