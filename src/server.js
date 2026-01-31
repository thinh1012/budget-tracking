const monitor = require('../monitor-bridge-batch.js');

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database/database');
const { initBot } = require('./bot/bot');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { requireAuth, redirectIfAuthenticated } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3110; // Changed to 3110 to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'budget-tracker-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Auth API routes (must be public for login to work)
app.use('/api/auth', authRoutes);

// Public static files for login page
const publicFiles = ['/login.html', '/styles.css'];
app.use((req, res, next) => {
    if (publicFiles.includes(req.path)) {
        return next();
    }
    requireAuth(req, res, next);
});

// Static files (login.html accessible, others protected by middleware above)
app.use(express.static(path.join(__dirname, '../public')));

// Dashboard route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Protected API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * [GET] /api/health/budget
 * [MONITORING] Detailed health endpoint for monitoring services.
 * Returns Budget service status and bot connectivity.
 */
app.get('/api/health/budget', (req, res) => {
    try {
        // Check database (basic check - if we got this far, DB is initialized)
        const dbConnected = true;

        // Check if bot is configured
        const botConfigured = !!process.env.TELEGRAM_BOT_TOKEN;

        const isHealthy = dbConnected && botConfigured;

        res.json({
            status: isHealthy ? 'healthy' : 'degraded',
            service: 'budget-tracking',
            timestamp: Date.now(),
            uptime: Math.round(process.uptime()),
            details: {
                database: dbConnected ? 'connected' : 'disconnected',
                botConfigured: botConfigured,
                port: PORT
            }
        });
    } catch (e) {
        res.status(500).json({
            status: 'error',
            service: 'budget-tracking',
            error: e.message
        });
    }
});

// Start server
async function start() {
    try {
        // Initialize database
        const dbPath = process.env.DATABASE_PATH || './data/budget.db';
        initDatabase(dbPath);

        // Initialize Telegram bot
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken) {
            initBot(botToken);

            monitor.init('budget_bot', '/root/server-monitor/monitor.db');
        } else {
            console.warn('TELEGRAM_BOT_TOKEN not set. Bot will not start.');
        }

        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Dashboard: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

// [STABILITY]: Global Error Handlers
process.on('uncaughtException', (error) => {
    console.error('🔥 FATAL: Uncaught Exception:', error);
    setTimeout(() => {
        process.exit(1); // Force PM2 to restart the process
    }, 100);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🌊 FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => {
        process.exit(1);
    }, 100);
});

module.exports = app;
