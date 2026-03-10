const express = require('express');
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

module.exports = router;
