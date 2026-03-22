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
            req.session.chatRowId = account.chat_id;
        } else {
            req.session.telegramChatId = null;
            req.session.chatRowId = null;
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

router.post('/forgot-password', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    try {
        const db = getDatabase();
        const account = db.prepare('SELECT * FROM dashboard_accounts WHERE username = ?').get(username);
        // Always return ok to not reveal whether username exists
        if (!account || !account.chat_id) return res.json({ ok: true });
        const chat = db.prepare('SELECT telegram_chat_id FROM chats WHERE id = ?').get(account.chat_id);
        if (!chat) return res.json({ ok: true });

        const tempPassword = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
        const hash = await bcrypt.hash(tempPassword, 10);
        db.prepare('UPDATE dashboard_accounts SET password_hash = ? WHERE id = ?').run(hash, account.id);

        const { getBot } = require('../bot/bot');
        const bot = getBot();
        if (bot) {
            await bot.sendMessage(chat.telegram_chat_id,
                `🔐 *Password Reset*\n\nNew temporary password for dashboard account *${username}*:\n\n\`${tempPassword}\`\n\n_Log in and change your password immediately._`,
                { parse_mode: 'Markdown' }
            );
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('Forgot password error:', e);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

router.post('/change-password', async (req, res) => {
    if (!req.session.authenticated) return res.status(401).json({ error: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    try {
        const db = getDatabase();
        const account = db.prepare('SELECT * FROM dashboard_accounts WHERE username = ?').get(req.session.username);
        if (!account) return res.status(404).json({ error: 'Account not found' });
        const valid = await bcrypt.compare(currentPassword, account.password_hash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
        const hash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE dashboard_accounts SET password_hash = ? WHERE id = ?').run(hash, account.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to change password' });
    }
});

router.post('/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
router.get('/status', (req, res) => {
    const payload = {
        authenticated: !!req.session.authenticated,
        username: req.session.username || null,
        isAdmin: req.session.isAdmin || false,
        telegramChatId: req.session.telegramChatId || null,
        chatTitle: null
    };
    if (req.session.chatRowId) {
        const db = getDatabase();
        const chat = db.prepare('SELECT title, telegram_chat_id FROM chats WHERE id = ?').get(req.session.chatRowId);
        if (chat) {
            payload.chatTitle = chat.title || null;
            payload.telegramChatId = chat.telegram_chat_id;
        }
    }
    res.json(payload);
});

module.exports = router;
