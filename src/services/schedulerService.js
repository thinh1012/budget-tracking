const { getSummary, getCategoryBreakdown } = require('./transactionService');
const { getDatabase } = require('../database/database');
const { formatAmount } = require('../bot/messageParser');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

function vnNow() {
    return new Date(Date.now() + VN_OFFSET_MS);
}

function getAllActiveChats() {
    const db = getDatabase();
    return db.prepare(`
        SELECT DISTINCT c.telegram_chat_id
        FROM chats c
        JOIN transactions t ON t.chat_id = c.id
    `).all();
}

function buildSummaryText(chatId, year, month) {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const summary = getSummary({ startDate, endDate, chatId });
    const breakdown = getCategoryBreakdown({ startDate, endDate, chatId });

    const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const savingsEmoji = summary.savings >= 0 ? '✅' : '⚠️';

    const topExpenses = breakdown
        .filter(c => c.category_type === 'expense')
        .slice(0, 3)
        .map(c => `  • ${c.category}: ${formatAmount(c.total)} ₫`)
        .join('\n');

    let text = `📅 *Monthly Wrap-up: ${monthName}*\n\n`;
    text += `💰 Earned: *${formatAmount(summary.income)} ₫*\n`;
    text += `💸 Spent: *${formatAmount(summary.expenses)} ₫*\n`;
    text += `${savingsEmoji} Balance: *${formatAmount(summary.savings)} ₫*`;
    if (topExpenses) text += `\n\n📊 Top expenses:\n${topExpenses}`;

    return text;
}

async function sendMonthlySummaries(bot) {
    const vn = vnNow();
    // We fire on the last day of the month, so report for current month
    const year = vn.getUTCFullYear();
    const month = vn.getUTCMonth();

    const chats = getAllActiveChats();
    console.log(`[Scheduler] Sending monthly summary to ${chats.length} chat(s)`);

    for (const { telegram_chat_id } of chats) {
        try {
            const text = buildSummaryText(telegram_chat_id, year, month);
            await bot.sendMessage(telegram_chat_id, text, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(`[Scheduler] Failed for chat ${telegram_chat_id}:`, e.message);
        }
    }
}

function msUntilTrigger() {
    const vn = vnNow();
    const y = vn.getUTCFullYear();
    const m = vn.getUTCMonth();

    // Last day of current month at 21:00 VN time
    const lastDay = new Date(Date.UTC(y, m + 1, 0, 21 - 7, 0, 0)); // 21:00 VN = 14:00 UTC

    let ms = lastDay.getTime() - Date.now();

    if (ms <= 0) {
        // Already passed — schedule for next month's last day
        const lastDayNext = new Date(Date.UTC(y, m + 2, 0, 14, 0, 0));
        ms = lastDayNext.getTime() - Date.now();
    }

    return ms;
}

function scheduleMonthlyReport(bot) {
    const ms = msUntilTrigger();
    const hours = Math.round(ms / 1000 / 60 / 60);
    console.log(`[Scheduler] Monthly summary scheduled in ~${hours}h`);

    setTimeout(async () => {
        try {
            await sendMonthlySummaries(bot);
        } catch (e) {
            console.error('[Scheduler] Error sending monthly summaries:', e);
        }
        scheduleMonthlyReport(bot); // reschedule for next month
    }, ms);
}

// ─── Spending Spike Alert ─────────────────────────────────────────────────────
const SPIKE_THRESHOLD = 1.5;   // 50% above average triggers alert
const SPIKE_MIN_AMOUNT = 200000; // ignore categories with < 200k spending

function initSpikeTable() {
    getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS spike_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            month TEXT NOT NULL,
            UNIQUE(chat_id, category, month)
        )
    `);
}

async function checkSpikes(bot) {
    const db = getDatabase();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const chats = getAllActiveChats();
    for (const { telegram_chat_id } of chats) {
        try {
            const chatRow = db.prepare('SELECT id FROM chats WHERE telegram_chat_id = ?').get(telegram_chat_id);
            if (!chatRow) continue;

            // Current month spending per expense category
            const current = db.prepare(`
                SELECT c.name as category, SUM(t.amount) as total
                FROM transactions t
                JOIN categories c ON t.category_id = c.id
                WHERE c.type = 'expense'
                  AND t.chat_id = ?
                  AND strftime('%Y-%m', t.created_at) = ?
                GROUP BY c.id
            `).all(chatRow.id, currentMonth);

            // 3-month rolling average per category (excluding current month)
            const averages = db.prepare(`
                SELECT category_name as category, AVG(monthly_total) as avg_total
                FROM (
                    SELECT c.name as category_name, strftime('%Y-%m', t.created_at) as month,
                           SUM(t.amount) as monthly_total
                    FROM transactions t
                    JOIN categories c ON t.category_id = c.id
                    WHERE c.type = 'expense'
                      AND t.chat_id = ?
                      AND t.created_at >= date('now', '-4 months')
                      AND strftime('%Y-%m', t.created_at) != ?
                    GROUP BY c.id, strftime('%Y-%m', t.created_at)
                )
                GROUP BY category_name
            `).all(chatRow.id, currentMonth);

            const avgMap = {};
            averages.forEach(a => { avgMap[a.category] = a.avg_total; });

            for (const { category, total } of current) {
                if (total < SPIKE_MIN_AMOUNT) continue;
                const avg = avgMap[category];
                if (!avg || avg < SPIKE_MIN_AMOUNT) continue;
                if (total < avg * SPIKE_THRESHOLD) continue;

                // Check if already alerted this month
                const existing = db.prepare('SELECT id FROM spike_alerts WHERE chat_id = ? AND category = ? AND month = ?').get(chatRow.id, category, currentMonth);
                if (existing) continue;

                // Send alert
                const pct = Math.round((total / avg - 1) * 100);
                const text =
                    `📈 *Spending Spike Detected*\n\n` +
                    `Category *${category}* is *${pct}% above* your usual amount this month.\n\n` +
                    `This month: *${formatAmount(total)} ₫*\n` +
                    `3-month avg: *${formatAmount(Math.round(avg))} ₫*\n\n` +
                    `_Use /summary to see your full breakdown._`;

                await bot.sendMessage(telegram_chat_id, text, { parse_mode: 'Markdown' });
                db.prepare('INSERT OR IGNORE INTO spike_alerts (chat_id, category, month) VALUES (?, ?, ?)').run(chatRow.id, category, currentMonth);
            }
        } catch (e) {
            console.error(`[Spike] Error for chat ${telegram_chat_id}:`, e.message);
        }
    }
}

function scheduleSpikeChecks(bot) {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    console.log('[Scheduler] Spike check will run now and every 7 days');

    const run = async () => {
        try { await checkSpikes(bot); } catch (e) { console.error('[Spike] Check error:', e); }
        setTimeout(run, SEVEN_DAYS_MS);
    };

    // Delay first run by 10s to let DB settle on startup
    setTimeout(run, 10000);
}

module.exports = { scheduleMonthlyReport, initSpikeTable, scheduleSpikeChecks };
