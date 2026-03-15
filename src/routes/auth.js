const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/database');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const db = getDatabase();
        const account = db.prepare('SELECT * FROM dashboard_accounts WHERE username = ?').get(username);
        if (!account) return res.status(401).json({ error: 'Invalid username or password' });
        const valid = await bcrypt.compare(password, account.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid username or password' });
        req.session.authenticated = true;
        req.session.username = account.username;
        req.session.isAdmin = !!account.is_admin;
        if (!account.is_admin && account.chat_id) {
            const chat = db.prepare('SELECT telegram_chat_id FROM chats WHERE id = ?').get(account.chat_id);
            req.session.telegramChatId = chat ? chat.telegram_chat_id : null;
        } else {
            req.session.telegramChatId = null;
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/register', async (req, res) => {
    const { username, password, telegram_chat_id } = req.body;
    if (!username || !password || !telegram_chat_id) {
        return res.status(400).json({ error: 'Username, password, and Telegram Chat ID are required' });
    }
    try {
        const db = getDatabase();

        // Chat ID must already exist (bot must have been active in that group)
        const chat = db.prepare('SELECT * FROM chats WHERE telegram_chat_id = ?').get(Number(telegram_chat_id));
        if (!chat) {
            return res.status(400).json({ error: 'Telegram Chat ID not found. Make sure the bot has been used in that group first.' });
        }

        // Check username not taken
        const existing = db.prepare('SELECT id FROM dashboard_accounts WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hash = await bcrypt.hash(password, 10);
        db.prepare('INSERT INTO dashboard_accounts (username, password_hash, chat_id, is_admin) VALUES (?, ?, ?, 0)')
            .run(username, hash, chat.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
router.get('/status', (req, res) => { res.json({ authenticated: !!req.session.authenticated, username: req.session.username || null, isAdmin: req.session.isAdmin || false }); });

module.exports = router;
