#!/usr/bin/env node
/**
 * manage-accounts.js - CLI tool to manage dashboard login accounts
 *
 * Usage (run from budget-tracking/ folder on Ubuntu):
 *   node manage-accounts.js add <username> <password> <telegram_chat_id>
 *   node manage-accounts.js add-admin <username> <password>
 *   node manage-accounts.js list
 *   node manage-accounts.js delete <username>
 *
 * How to find your Telegram chat ID:
 *   Add @userinfobot or @getmyid_bot to your group, then send /start.
 *   Group IDs are negative numbers (e.g. -100123456789).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, getDatabase } = require('./src/database/database');

const DB_PATH = process.env.DATABASE_PATH || './data/budget.db';
initDatabase(DB_PATH);
const db = getDatabase();

const [,, command, ...args] = process.argv;

async function addAccount(username, password, telegramChatId, isAdmin) {
    const hash = await bcrypt.hash(password, 10);
    let chatRecord = null;
    if (!isAdmin && telegramChatId) {
        const existing = db.prepare('SELECT * FROM chats WHERE telegram_chat_id = ?').get(Number(telegramChatId));
        if (existing) {
            chatRecord = existing;
        } else {
            const result = db.prepare('INSERT INTO chats (telegram_chat_id, title) VALUES (?, ?)').run(Number(telegramChatId), username + ' household');
            chatRecord = db.prepare('SELECT * FROM chats WHERE id = ?').get(result.lastInsertRowid);
            console.log('Created new chat record for telegram_chat_id: ' + telegramChatId);
        }
    }
    try {
        db.prepare('INSERT INTO dashboard_accounts (username, password_hash, chat_id, is_admin) VALUES (?, ?, ?, ?)').run(username, hash, chatRecord ? chatRecord.id : null, isAdmin ? 1 : 0);
        console.log('Account "' + username + '" created successfully.');
        if (isAdmin) console.log('  Role: Admin (sees all chats)');
        else console.log('  Linked to telegram_chat_id: ' + telegramChatId);
    } catch (err) {
        if (err.message.includes('UNIQUE')) console.error('Username "' + username + '" already exists.');
        else throw err;
    }
}

function listAccounts() {
    const accounts = db.prepare('SELECT a.username, a.is_admin, a.created_at, c.telegram_chat_id, c.title FROM dashboard_accounts a LEFT JOIN chats c ON a.chat_id = c.id ORDER BY a.created_at').all();
    if (accounts.length === 0) { console.log('No accounts found.'); return; }
    console.log('\nDashboard Accounts:');
    console.log('-'.repeat(60));
    for (const acc of accounts) {
        const role = acc.is_admin ? 'ADMIN (all data)' : ('chat: ' + (acc.telegram_chat_id || 'unlinked'));
        console.log('  ' + acc.username.padEnd(20) + ' ' + role);
    }
    console.log('-'.repeat(60));
}

function deleteAccount(username) {
    const result = db.prepare('DELETE FROM dashboard_accounts WHERE username = ?').run(username);
    if (result.changes > 0) console.log('Account "' + username + '" deleted.');
    else console.log('Account "' + username + '" not found.');
}

(async () => {
    switch (command) {
        case 'add':
            if (args.length < 3) { console.error('Usage: node manage-accounts.js add <username> <password> <telegram_chat_id>'); process.exit(1); }
            await addAccount(args[0], args[1], args[2], false); break;
        case 'add-admin':
            if (args.length < 2) { console.error('Usage: node manage-accounts.js add-admin <username> <password>'); process.exit(1); }
            await addAccount(args[0], args[1], null, true); break;
        case 'list': listAccounts(); break;
        case 'delete':
            if (args.length < 1) { console.error('Usage: node manage-accounts.js delete <username>'); process.exit(1); }
            deleteAccount(args[0]); break;
        default:
            console.log('\nBudget Bot - Account Manager\n\nCommands:\n  add <username> <password> <telegram_chat_id>  Add a user linked to a Telegram chat\n  add-admin <username> <password>               Add an admin (sees all data)\n  list                                          List all accounts\n  delete <username>                             Delete an account\n');
    }
    process.exit(0);
})();
