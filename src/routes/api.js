const express = require('express');
const {
    getTransactions,
    getSummary,
    getCategoryBreakdown,
    getMonthlyTrends,
    getCategories,
    getYearlySummary,
    getContributorBreakdown,
    getUserSpending
} = require('../services/transactionService');

const router = express.Router();

/**
 * GET /api/summary
 * Get total income, expenses, and savings
 */
router.get('/summary', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = getSummary({ startDate, endDate });
        res.json(summary);
    } catch (error) {
        console.error('Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

/**
 * GET /api/transactions
 * Get list of transactions with optional filters
 */
router.get('/transactions', (req, res) => {
    try {
        const { startDate, endDate, categoryId, limit = 50, offset = 0 } = req.query;
        const transactions = getTransactions({
            startDate,
            endDate,
            categoryId: categoryId ? parseInt(categoryId) : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json(transactions);
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

/**
 * GET /api/categories
 * Get spending breakdown by category
 */
router.get('/categories', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const breakdown = getCategoryBreakdown({ startDate, endDate });
        res.json(breakdown);
    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({ error: 'Failed to get category breakdown' });
    }
});

/**
 * GET /api/categories/list
 * Get all category names
 */
router.get('/categories/list', (req, res) => {
    try {
        const categories = getCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error getting category list:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

/**
 * GET /api/trends
 * Get monthly spending trends
 */
router.get('/trends', (req, res) => {
    try {
        const { months = 6 } = req.query;
        const trends = getMonthlyTrends(parseInt(months));
        res.json(trends);
    } catch (error) {
        console.error('Error getting trends:', error);
        res.status(500).json({ error: 'Failed to get trends' });
    }
});

/**
 * GET /api/analytics/yearly
 * Get yearly summary
 */
router.get('/analytics/yearly', (req, res) => {
    try {
        const summary = getYearlySummary();
        res.json(summary);
    } catch (error) {
        console.error('Error getting yearly summary:', error);
        res.status(500).json({ error: 'Failed to get yearly summary' });
    }
});

/**
 * GET /api/contributors
 * Get contributor breakdown (income by contributor)
 */
router.get('/contributors', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const contributors = getContributorBreakdown({ startDate, endDate });
        res.json(contributors);
    } catch (error) {
        console.error('Error getting contributors:', error);
        res.status(500).json({ error: 'Failed to get contributors' });
    }
});

/**
 * GET /api/users/spending
 * Get user spending breakdown
 */
router.get('/users/spending', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const spending = getUserSpending({ startDate, endDate });
        res.json(spending);
    } catch (error) {
        console.error('Error getting user spending:', error);
        res.status(500).json({ error: 'Failed to get user spending' });
    }
});

module.exports = router;
