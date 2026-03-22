const fs = require("fs");
const TelegramBot = require('node-telegram-bot-api');
const monitor = require('../../monitor-bridge-batch.js');
const { parseMessage, formatAmount, detectPartialInput, generateExamples } = require('./messageParser');
const { createTransaction, getSummary, getCategoryBreakdown, getUserCategories, getUserContributors, getCommonCategories, getUserRecentTransactions, deleteTransaction, searchTransactions, suggestCategoryFromHistory, getChatCategories, mergeCategories, findNearDuplicates } = require('../services/transactionService');
const { setBudget, getBudgetStatus } = require('../services/budgetService');
const { generateMonthlyReport } = require('../services/reportService');
const { initAlertTable, setThreshold, removeThreshold, getThreshold, checkAndNotify, initChatBudgetsTable, lookupKeyword } = require('../services/alertService');
const { processReceipt } = require('../services/ocrService');
const axios = require('axios'); // I'll need to install this or use fetch if available. 
// Actually, bot.getFileLink() might be enough if I can get the buffer.
const https = require('https');
const { setState, getState, clearState, hasState } = require('./conversationState');
const { categoryKeyboard, confirmationKeyboard, contributorKeyboard, getCategoryEmoji, successKeyboard } = require('./keyboards');
const templates = require('./messageTemplates');
const { getDatabase } = require('../database/database');

// In-memory forecast throttle (resets on restart — acceptable)
const forecastSentCache = new Set();

let bot = null;

// Large transaction threshold (10M VND)
const LARGE_TRANSACTION_THRESHOLD = 10000000;

/**
 * Initialize the Telegram bot
 */
function initBot(token) {
    if (!token) {
        console.error('TELEGRAM_BOT_TOKEN not provided. Bot will not start.');
        return null;
    }

    initAlertTable();
    initChatBudgetsTable();

    // Webhook mode: no polling, Express will receive updates from nginx
    bot = new TelegramBot(token, { webHook: false });

    // [MONITORING] Track inbound messages for Dashboard
    bot.on('message', () => monitor.recordInbound());

    console.log('🤖 Bot started successfully!');
    console.log('⚡ Mode: Webhook (real-time, zero idle polling)');

    // Register webhook with Telegram
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhook/budget`;
    bot.setWebHook(webhookUrl, { certificate: fs.createReadStream("/etc/nginx/ssl/na-bot/cert.pem") }).then(() => {
        console.log(`✅ Webhook registered: ${webhookUrl}`);
    }).catch((err) => {
        console.error('❌ Failed to register webhook:', err.message);
    });

    // Handle webhook errors
    bot.on('webhook_error', (error) => {
        console.error(`⚠️ [WEBHOOK_ERROR]: ${error.code} - ${error.message}`);
    });

    // Handle overall errors
    bot.on('error', (error) => {
        console.error('Telegram bot error:', error);
    });

    // Verify bot token and connection
    bot.getMe().then((me) => {
        console.log(`Telegram bot initialized as @${me.username} (${me.id})`);
    }).catch((error) => {
        console.error('Failed to verify Telegram bot token:', error.message);
    });

    // Handle incoming messages
    bot.on('message', async (msg) => {
        try {
            await handleMessage(msg);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Handle callback queries (inline button clicks)
    bot.on('callback_query', async (query) => {
        try {
            await handleCallbackQuery(query);
        } catch (error) {
            console.error('Error handling callback query:', error);
        }
    });

    // Handle photo messages (OCR Receipts)
    bot.on('photo', async (msg) => {
        try {
            await handlePhoto(msg);
        } catch (error) {
            console.error('Error handling photo:', error);
        }
    });

    console.log('Telegram bot started');
    return bot;
}

/**
 * Handle incoming message
 */
async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    // Handle commands
    if (text.startsWith('/')) {
        await handleCommand(msg);
        return;
    }

    // Check if user is in a conversation
    const state = getState(chatId);
    if (state) {
        await handleConversationReply(msg, state);
        return;
    }

    // Handle queries (e.g., "how much eating", "spending on eating")
    const queryMatch = text.toLowerCase().match(/^(?:how much|spending on|spent on)\s+(.+)$/);
    if (queryMatch) {
        await handleQuery(msg, queryMatch[1]);
        return;
    }

    // Handle smart search (e.g., "show last 5 eating", "last 10 transactions")
    const searchMatch = text.toLowerCase().match(/^(?:show\s+)?last\s+(\d+)?\s*(.+)?\s*transactions$|^(?:show\s+)?last\s+(\d+)\s*(.+)?$/);
    if (searchMatch) {
        const count = searchMatch[1] || searchMatch[3] || 5;
        const category = searchMatch[2] || searchMatch[4] || null;
        await handleSmartSearch(msg, category, parseInt(count));
        return;
    }

    // Parse as transaction
    const parsed = parseMessage(text);

    if (parsed.error) {
        // Only reply in private chats
        if (msg.chat.type === 'private') {
            await handleParseError(msg, text);
        }
        return;
    }

    // Smart auto-categorization: keyword table first, then history-based
    if (!parsed.isIncome) {
        const keywordMatch = lookupKeyword(chatId, parsed.category);
        if (keywordMatch && keywordMatch !== parsed.category) {
            parsed._originalCategory = parsed.category;
            parsed.category = keywordMatch;
        } else {
            const suggestion = suggestCategoryFromHistory(chatId, parsed.category);
            if (suggestion && suggestion !== parsed.category) {
                parsed._originalCategory = parsed.category;
                parsed.category = suggestion;
            }
        }
    }

    // Check for large transaction (requires confirmation)
    if (parsed.amount >= LARGE_TRANSACTION_THRESHOLD) {
        await handleLargeTransaction(msg, parsed);
        return;
    }

    // Create the transaction
    await saveTransaction(msg, parsed);
}

/**
 * Handle parse errors with helpful feedback
 */
async function handleParseError(msg, text) {
    const chatId = msg.chat.id;
    const partial = detectPartialInput(text);

    if (partial.type === 'missing_amount') {
        const examples = generateExamples(partial);
        await bot.sendMessage(chatId, templates.missingAmountError(examples), {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    } else if (partial.type === 'missing_category') {
        // Get user's common categories
        const commonCategories = getCommonCategories(msg.from.id, 5);
        const defaultCategories = commonCategories.length > 0 ? commonCategories : ['eating', 'transport', 'shopping', 'bills', 'other'];

        // Store state for category selection
        setState(chatId, {
            state: 'awaiting_category',
            transaction: {
                amount: partial.detected.amount,
                isIncome: partial.detected.isIncome
            },
            userId: msg.from.id,
            originalMsg: msg
        });

        await bot.sendMessage(chatId, templates.askForCategory(partial.detected.amount), {
            parse_mode: 'Markdown',
            reply_markup: categoryKeyboard(defaultCategories),
            reply_to_message_id: msg.message_id
        });
    } else if (partial.type === 'missing_contributor') {
        // Get user's known contributors
        const knownContributors = getUserContributors(msg.from.id);
        const defaultContributors = knownContributors.length > 0 ? knownContributors : ['duc', 'wife', 'husband'];

        // Store state for contributor selection
        setState(chatId, {
            state: 'awaiting_contributor',
            transaction: partial.detected,
            userId: msg.from.id,
            originalMsg: msg
        });

        await bot.sendMessage(chatId, templates.askForContributor(partial.detected.amount, partial.detected.description), {
            parse_mode: 'Markdown',
            reply_markup: contributorKeyboard(defaultContributors),
            reply_to_message_id: msg.message_id
        });
    } else {
        // General invalid format
        await bot.sendMessage(chatId, templates.invalidFormatError(), {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    }
}

/**
 * Handle large transaction confirmation
 */
async function handleLargeTransaction(msg, parsed) {
    const chatId = msg.chat.id;

    // Store state
    setState(chatId, {
        state: 'awaiting_confirmation',
        transaction: parsed,
        userId: msg.from.id,
        originalMsg: msg
    });

    await bot.sendMessage(chatId, templates.largeTransactionConfirmation(parsed), {
        parse_mode: 'Markdown',
        reply_markup: confirmationKeyboard(),
        reply_to_message_id: msg.message_id
    });
}

/**
 * Handle conversation reply (when user is in a state)
 */
async function handleConversationReply(msg, state) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (state.state === 'awaiting_category') {
        // User typed a custom category
        const category = text.toLowerCase().trim();
        clearState(chatId);

        const parsed = {
            amount: state.transaction.amount,
            category: category,
            description: null,
            contributor: null,
            isIncome: state.transaction.isIncome
        };

        await saveTransaction(msg, parsed, true);
    } else if (state.state === 'awaiting_contributor') {
        // User typed a custom contributor
        state.transaction.contributor = text.trim();
        clearState(chatId);

        await saveTransaction(msg, state.transaction, true);
    }
}

/**
 * Save transaction to database
 */
async function checkForecast(bot, chatId) {
    const today = new Date();
    const dayOfMonth = today.getDate();
    if (dayOfMonth < 7) return;

    const weekKey = `${chatId}_${today.getFullYear()}_w${Math.floor(dayOfMonth / 7)}`;
    if (forecastSentCache.has(weekKey)) return;

    const db = getDatabase();
    const currentMonth = today.toISOString().slice(0, 7);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);

    const cur = db.prepare(`SELECT COALESCE(SUM(t.amount),0) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE c.type='expense' AND t.chat_id=(SELECT id FROM chats WHERE telegram_chat_id=?) AND strftime('%Y-%m',t.created_at)=?`).get(chatId, currentMonth);
    const last = db.prepare(`SELECT COALESCE(SUM(t.amount),0) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE c.type='expense' AND t.chat_id=(SELECT id FROM chats WHERE telegram_chat_id=?) AND strftime('%Y-%m',t.created_at)=?`).get(chatId, lastMonth);

    if (!last || last.total === 0) return;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const projected = Math.round(cur.total / dayOfMonth * daysInMonth);
    const pct = Math.round((projected / last.total - 1) * 100);
    if (pct < 30) return;

    forecastSentCache.add(weekKey);
    await bot.sendMessage(chatId, templates.forecastWarning(projected, last.total, pct, dayOfMonth, daysInMonth), { parse_mode: 'Markdown' });
}

async function saveTransaction(msg, parsed, wasInteractive = false) {
    const chatId = msg.chat.id;

    // Duplicate check
    if (!parsed.skipDuplicateCheck && !parsed.isIncome) {
        const db = getDatabase();
        const chatRow = db.prepare('SELECT id FROM chats WHERE telegram_chat_id = ?').get(chatId);
        if (chatRow) {
            const catRow = db.prepare('SELECT id FROM categories WHERE LOWER(name) = ?').get((parsed.category || '').toLowerCase());
            if (catRow) {
                const recent = db.prepare(`SELECT id FROM transactions WHERE amount=? AND category_id=? AND chat_id=? AND created_at >= datetime('now','-5 minutes') LIMIT 1`).get(parsed.amount, catRow.id, chatRow.id);
                if (recent) {
                    setState(chatId, { state: 'awaiting_confirmation', isDuplicateCheck: true, transaction: { ...parsed, skipDuplicateCheck: true }, userId: msg.from.id, originalMsg: msg });
                    await bot.sendMessage(chatId, templates.duplicateWarning(parsed), { parse_mode: 'Markdown', reply_markup: confirmationKeyboard(), reply_to_message_id: msg.message_id });
                    return;
                }
            }
        }
    }

    try {
        const transaction = createTransaction({
            amount: parsed.amount,
            categoryName: parsed.category,
            categoryType: parsed.isIncome ? 'income' : 'expense',
            description: parsed.description,
            contributor: parsed.contributor,
            telegramUser: msg.from,
            telegramChat: msg.chat,
            messageId: msg.message_id,
            receiptFileId: parsed.receiptFileId
        });

        // [IDEMPOTENCY] If this was a duplicate, skip the reply to prevent spamming the user on restart
        if (transaction.isDuplicate) {
            console.log(`[IDEMPOTENCY] Silently skipping reply for duplicate transaction ${transaction.id}`);
            return;
        }

        // Build success message — note if auto-categorized
        let successMsg = templates.transactionSuccess(transaction, wasInteractive);
        if (parsed._originalCategory) {
            successMsg += `\n\n🧠 _Auto-categorized from "${parsed._originalCategory}" → "${transaction.category}" based on your history._`;
        }

        // Reply with success
        await bot.sendMessage(chatId, successMsg, {
            parse_mode: 'Markdown',
            reply_markup: successKeyboard(transaction.id),
            reply_to_message_id: msg.message_id
        });

        // Check budget status (only for expenses)
        if (transaction.categoryType === 'expense') {
            const budgetStatus = getBudgetStatus(msg.from.id, transaction.categoryId, null, chatId);
            if (budgetStatus && budgetStatus.percent >= 80) {
                setTimeout(async () => {
                    await bot.sendMessage(chatId, templates.budgetAlert(transaction.category, budgetStatus), { parse_mode: 'Markdown' });
                }, 1000);
            }
            setTimeout(() => checkAndNotify(bot, chatId), 1200);
            setTimeout(() => checkForecast(bot, chatId), 2500);
        }
    } catch (error) {
        console.error('Error creating transaction:', error);
        await bot.sendMessage(chatId, '❌ Failed to record transaction. Please try again.', {
            reply_to_message_id: msg.message_id
        });
    }
}

/**
 * Handle callback queries (inline button clicks)
 */
async function handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const state = getState(chatId);

    // Answer callback to remove loading state.
    // For undo_, we answer inside the branch (after the delete) so we can handle expired queries gracefully.
    if (!data.startsWith('undo_')) {
        try { await bot.answerCallbackQuery(query.id); } catch (e) { /* ignore if query expired */ }
    }

    // Handle category selection
    if (data.startsWith('cat_')) {
        if (!state || (state.state !== 'awaiting_category' && state.state !== 'awaiting_ocr_confirmation')) {
            await bot.sendMessage(chatId, templates.timeout());
            return;
        }

        if (data === 'cat_custom') {
            await bot.sendMessage(chatId, '📝 Please type your custom category name:');
            return;
        }

        const category = data.replace('cat_', '');
        state.transaction.category = category;
        clearState(chatId);

        // Delete the keyboard message first
        try {
            await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {
            console.error('Error deleting message:', e.message);
        }

        const parsed = {
            amount: state.transaction.amount,
            category,
            description: state.transaction.description || null,
            contributor: state.transaction.contributor || null,
            isIncome: state.transaction.isIncome,
            receiptFileId: state.transaction.receiptFileId || null
        };

        // Save and reply to ORIGINAL message, not the deleted keyboard
        await saveTransaction(state.originalMsg, parsed, true);
    }

    // Handle contributor selection
    else if (data.startsWith('contrib_')) {
        if (!state || state.state !== 'awaiting_contributor') {
            await bot.sendMessage(chatId, templates.timeout());
            return;
        }

        if (data === 'contrib_custom') {
            await bot.sendMessage(chatId, '📝 Please type the contributor name:');
            return;
        }

        const contributor = data.replace('contrib_', '');
        state.transaction.contributor = contributor;
        clearState(chatId);

        // Delete the keyboard message first
        try {
            await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {
            console.error('Error deleting message:', e.message);
        }

        // Save and reply to ORIGINAL message
        await saveTransaction(state.originalMsg, state.transaction, true);
    }

    // Handle confirmation
    else if (data.startsWith('confirm_')) {
        if (!state || state.state !== 'awaiting_confirmation') {
            await bot.sendMessage(chatId, templates.timeout());
            return;
        }

        if (data === 'confirm_yes') {
            clearState(chatId);

            // Delete the keyboard message
            try {
                await bot.deleteMessage(chatId, query.message.message_id);
            } catch (e) {
                console.error('Error deleting message:', e.message);
            }

            await saveTransaction(state.originalMsg, state.transaction, true);
        } else {
            clearState(chatId);

            // Delete the keyboard message
            try {
                await bot.deleteMessage(chatId, query.message.message_id);
            } catch (e) {
                console.error('Error deleting message:', e.message);
            }

            await bot.sendMessage(chatId, templates.canceled(), {
                reply_to_message_id: state.originalMsg.message_id
            });
        }
    }

    // Handle undo
    else if (data.startsWith('undo_')) {
        const transactionId = data.replace('undo_', '');
        const success = deleteTransaction(transactionId);

        if (success) {
            try {
                await bot.editMessageText('⏮️ *Transaction reverted and deleted successfully!*', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [] }
                });
            } catch (e) {
                console.error('Error editing undo success message:', e.message);
            }
            try { await bot.answerCallbackQuery(query.id, { text: 'Transaction undone.' }); } catch (e) { /* query expired after restart */ }
        } else {
            // Transaction already deleted (e.g. double-click or post-restart replay)
            try {
                await bot.editMessageText('↩️ *Already undone.* (Transaction was already deleted)', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [] }
                });
            } catch (e) {
                await bot.sendMessage(chatId, '↩️ Already undone.');
            }
            try { await bot.answerCallbackQuery(query.id); } catch (e) { /* query expired */ }
        }
    }
}

/**
 * Handle bot commands
 */
async function handleCommand(msg) {
    const chatId = msg.chat.id;
    const command = msg.text.split(' ')[0].toLowerCase();

    switch (command) {
        case '/help':
        case '/start':
            await handleHelpCommand(msg);
            break;
        case '/ping':
            await bot.sendMessage(chatId, `🏓 PONG!\n\nStatus: Online\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })}`);
            break;
        case '/summary':
            await handleSummaryCommand(msg);
            break;
        case '/cancel':
            if (hasState(chatId)) {
                clearState(chatId);
                await bot.sendMessage(chatId, templates.canceled());
            }
            break;
        case '/setbudget':
            await handleSetBudgetCommand(msg);
            break;
        case '/setlimit':
            await handleSetLimitCommand(msg);
            break;
        case '/report':
            await handleReportCommand(msg);
            break;
        case '/categories':
            await handleCategoriesCommand(msg);
            break;
        case '/merge':
            await handleMergeCommand(msg);
            break;
        default:
            // Ignore unknown commands silently
            break;
    }
}

/**
 * Handle /help command
 */
async function handleHelpCommand(msg) {
    const chatId = msg.chat.id;

    // Get user's data for personalized help
    const userCategories = getUserCategories(msg.from.id);
    const userExamples = getUserRecentTransactions(msg.from.id, 3);

    const helpText = templates.enhancedHelp(userExamples, userCategories);

    await bot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id
    });
}

/**
 * Handle /summary command
 */
async function handleSummaryCommand(msg) {
    const chatId = msg.chat.id;

    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDate = monthStart.toISOString().split('T')[0];
        const endDate = monthEnd.toISOString().split('T')[0];
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const summary = getSummary({ startDate, endDate, chatId });
        const breakdown = getCategoryBreakdown({ startDate, endDate, chatId });

        const savingsEmoji = summary.savings >= 0 ? '✅' : '⚠️';

        const topExpenses = breakdown
            .filter(c => c.category_type === 'expense')
            .slice(0, 3)
            .map(c => `  • ${c.category}: *${formatAmount(c.total)} ₫*`)
            .join('\n');

        let text = `📊 *${monthName}*\n\n`;
        text += `💵 Income: *${formatAmount(summary.income)} ₫*\n`;
        text += `💸 Spent: *${formatAmount(summary.expenses)} ₫*\n`;
        text += `${savingsEmoji} Balance: *${formatAmount(summary.savings)} ₫*`;
        if (topExpenses) text += `\n\n📈 Top expenses:\n${topExpenses}`;

        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    } catch (error) {
        console.error('Error getting summary:', error);
        await bot.sendMessage(chatId, '❌ Failed to get summary.', {
            reply_to_message_id: msg.message_id
        });
    }
}

/**
 * Handle spending queries
 */
async function handleQuery(msg, categoryQuery) {
    const chatId = msg.chat.id;

    try {
        // Get this month's breakdown
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const breakdown = getCategoryBreakdown({
            startDate: monthStart.toISOString().split('T')[0],
            chatId
        });

        // Find matching category
        const category = categoryQuery.toLowerCase().trim();
        const match = breakdown.find(c => c.category.toLowerCase() === category);

        if (!match) {
            await bot.sendMessage(chatId, `❌ No spending found for "${category}" this month.`, {
                reply_to_message_id: msg.message_id
            });
            return;
        }

        const emoji = match.category_type === 'income' ? '💰' : '💸';
        const resultText = `
${emoji} *${match.category.charAt(0).toUpperCase() + match.category.slice(1)}*

Amount: *${formatAmount(match.total)}* ₫
Transactions: ${match.count}

_This month_
        `.trim();

        await bot.sendMessage(chatId, resultText, {
            parse_mode: 'Markdown',
            reply_to_message_id: msg.message_id
        });
    } catch (error) {
        console.error('Error handling query:', error);
        await bot.sendMessage(chatId, '❌ Failed to process query.', {
            reply_to_message_id: msg.message_id
        });
    }
}

/**
 * Get the bot instance
 */
function getBot() {
    return bot;
}

/**
 * Stop the bot
 */
function stopBot() {
    if (bot) {
        bot.stopPolling();
        bot = null;
    }
}


/**
 * Handle /setbudget command
 */
async function handleSetBudgetCommand(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Format: /setbudget <category> <amount>
    const match = text.match(/^\/setbudget\s+(\S+)\s+(\d+[kKmM]?|\d+)/);

    if (!match) {
        await bot.sendMessage(chatId, '❌ *Invalid format!*\n\nUse: `/setbudget <category> <amount>`\nExample: `/setbudget eating 5m`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    const category = match[1].toLowerCase();
    const amountStr = match[2];

    // Parse amount using messageParser's logic (I'll need to export it or replicate)
    // For now, let's just do a simple replicate or use the exported one if available
    const { parseMessage } = require('./messageParser');
    const parsed = parseMessage(`${amountStr} temp`);

    if (parsed.error) {
        await bot.sendMessage(chatId, '❌ Invalid amount format.');
        return;
    }

    const success = setBudget(msg.from.id, category, parsed.amount);

    if (success) {
        await bot.sendMessage(chatId, templates.budgetLimitSet(category, parsed.amount), {
            parse_mode: 'Markdown'
        });
    } else {
        await bot.sendMessage(chatId, '❌ Failed to set budget.');
    }
}

/**
 * Handle /setlimit command
 */
async function handleSetLimitCommand(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // /setlimit off — remove limit
    if (/^\/setlimit\s+off$/i.test(text)) {
        removeThreshold(chatId);
        await bot.sendMessage(chatId, '✅ Monthly spending limit removed.', { parse_mode: 'Markdown' });
        return;
    }

    // /setlimit — show current
    if (/^\/setlimit$/.test(text)) {
        const current = getThreshold(chatId);
        if (!current) {
            await bot.sendMessage(chatId,
                '📊 No spending limit set.\n\nUse `/setlimit <amount>` to set one.\nExample: `/setlimit 10m`',
                { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId,
                `📊 *Current spending limit:* ${formatAmount(current.threshold)} ₫\n\nUse \`/setlimit <amount>\` to change, or \`/setlimit off\` to remove.`,
                { parse_mode: 'Markdown' });
        }
        return;
    }

    // /setlimit <amount>
    const match = text.match(/^\/setlimit\s+(\S+)/);
    if (!match) {
        await bot.sendMessage(chatId,
            '❌ *Invalid format!*\n\nUse: `/setlimit <amount>`\nExamples: `/setlimit 10m` · `/setlimit 5000000`\n\nTo remove: `/setlimit off`',
            { parse_mode: 'Markdown' });
        return;
    }

    const parsed = parseMessage(`${match[1]} temp`);
    if (parsed.error) {
        await bot.sendMessage(chatId, '❌ Invalid amount. Try `/setlimit 10m` or `/setlimit 5000000`', { parse_mode: 'Markdown' });
        return;
    }

    const success = setThreshold(chatId, parsed.amount);
    if (success) {
        await bot.sendMessage(chatId,
            `✅ *Spending limit set to ${formatAmount(parsed.amount)} ₫*\n\nYou'll get a warning when your total monthly expenses cross this amount.\n\nUse \`/setlimit off\` to remove it.`,
            { parse_mode: 'Markdown' });
    } else {
        await bot.sendMessage(chatId, '❌ Could not set limit. Make sure you\'ve logged at least one transaction first.');
    }
}

/**
 * Handle natural language smart search
 */
async function handleSmartSearch(msg, category, count) {
    const chatId = msg.chat.id;

    const results = searchTransactions({
        chatId,
        categoryName: category,
        limit: count
    });

    const query = category ? `last ${count} ${category}` : `last ${count}`;
    await bot.sendMessage(chatId, templates.searchResult(results, query), {
        parse_mode: 'Markdown'
    });
}

/**
 * Handle /report command
 */
async function handleReportCommand(msg) {
    const chatId = msg.chat.id;

    // Send loading message
    const loadingMsg = await bot.sendMessage(chatId, '📊 Generating your report...');

    try {
        const { summary, chartBuffer, monthName } = await generateMonthlyReport();

        let caption = `📊 *Budget Report: ${monthName}*\n\n`;
        caption += `💰 Total Income: ${formatAmount(summary.income)} ₫\n`;
        caption += `💸 Total Expenses: ${formatAmount(summary.expenses)} ₫\n`;
        caption += `✨ Ending Balance: ${formatAmount(summary.savings)} ₫`;

        if (chartBuffer) {
            await bot.sendPhoto(chatId, chartBuffer, {
                caption: caption,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.sendMessage(chatId, caption + '\n\n_(No expenses recorded yet to show chart)_', {
                parse_mode: 'Markdown'
            });
        }

        // Delete loading message
        await bot.deleteMessage(chatId, loadingMsg.message_id);
    } catch (error) {
        console.error('Error generating report:', error);
        await bot.editMessageText('❌ Failed to generate report. Please try again later.', {
            chat_id: chatId,
            message_id: loadingMsg.message_id
        });
    }
}

/**
 * Handle photo message (OCR)
 */
async function handlePhoto(msg) {
    const chatId = msg.chat.id;

    // Send feedback
    const processMsg = await bot.sendMessage(chatId, '📷 *Reading receipt...* Please wait.', { parse_mode: 'Markdown' });

    try {
        // Get the largest photo (best quality)
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        // Get download link
        const fileLink = await bot.getFileLink(fileId);

        // Download into buffer
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Process OCR
        const result = await processReceipt(buffer);

        if (!result.amount) {
            await bot.editMessageText('❌ I couldn\'t find a clear amount on this receipt. Could you try typing it manually or send a clearer photo?', {
                chat_id: chatId,
                message_id: processMsg.message_id
            });
            return;
        }

        // Store state for confirmation
        setState(chatId, {
            state: 'awaiting_ocr_confirmation',
            transaction: {
                amount: result.amount,
                category: 'other', // Default to other, user can change
                description: result.suggestedDescription || 'Receipt scan',
                receiptFileId: fileId,
                isIncome: false
            },
            userId: msg.from.id,
            originalMsg: msg
        });

        // Delete processing message
        await bot.deleteMessage(chatId, processMsg.message_id);

        // Send preview with confirmation keyboard
        await bot.sendMessage(chatId, templates.transactionPreview({
            amount: result.amount,
            category: 'other',
            description: result.suggestedDescription
        }), {
            parse_mode: 'Markdown',
            reply_markup: categoryKeyboard(['eating', 'transport', 'shopping', 'bills', 'health', 'other']),
            reply_to_message_id: msg.message_id
        });

    } catch (error) {
        console.error('Error in handlePhoto:', error);
        await bot.editMessageText('❌ Failed to process photo. Please try again.', {
            chat_id: chatId,
            message_id: processMsg.message_id
        });
    }
}

async function handleCategoriesCommand(msg) {
    const chatId = msg.chat.id;
    try {
        const categories = getChatCategories(chatId);
        if (!categories.length) {
            await bot.sendMessage(chatId, '📁 No categories found. Log some transactions first!', { reply_to_message_id: msg.message_id });
            return;
        }
        const names = categories.map(c => c.name);
        const nearDupes = findNearDuplicates(names);
        await bot.sendMessage(chatId, templates.categoriesList(categories, nearDupes), { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
    } catch (e) {
        console.error('Error in /categories:', e);
        await bot.sendMessage(chatId, '❌ Failed to load categories.');
    }
}

async function handleMergeCommand(msg) {
    const chatId = msg.chat.id;
    const parts = msg.text.trim().split(/\s+/);

    if (parts.length < 3) {
        await bot.sendMessage(chatId, '❌ Usage: `/merge <from> <to>`\nExample: `/merge eat eating`', { parse_mode: 'Markdown' });
        return;
    }

    const [, from, to] = parts;
    const result = mergeCategories(from, to, chatId);

    if (!result.ok) {
        await bot.sendMessage(chatId, `❌ ${result.error}`, { reply_to_message_id: msg.message_id });
        return;
    }

    await bot.sendMessage(chatId, templates.mergeDone(from, result.toName, result.count), { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
}

module.exports = {
    initBot,
    getBot,
    stopBot,
    handleMessage
};
