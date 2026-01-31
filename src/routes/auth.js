const express = require('express');
const router = express.Router();

/**
 * Login endpoint
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Simple hardcoded credentials (change these!)
    const VALID_USERNAME = 'admin';
    const VALID_PASSWORD = 'budget2026';

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid username or password' });
    }
});

/**
 * Logout endpoint
 */
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

/**
 * Check auth status
 */
router.get('/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

module.exports = router;
