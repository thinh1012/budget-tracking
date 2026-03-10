-- Users table (Telegram users)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chats table (Telegram chats/groups = households)
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_chat_id INTEGER UNIQUE NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard accounts (web login, linked to a chat household)
CREATE TABLE IF NOT EXISTS dashboard_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    chat_id INTEGER,  -- NULL = admin (sees all chats)
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id)
);

-- Categories table (dynamic, user can add more)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount INTEGER NOT NULL,  -- Stored in smallest unit (VND)
    category_id INTEGER NOT NULL,
    description TEXT,
    contributor TEXT,  -- Who contributed (for income tracking)
    user_id INTEGER NOT NULL,
    chat_id INTEGER,  -- Telegram chat/group (household isolation)
    telegram_message_id INTEGER,
    receipt_file_id TEXT,  -- Telegram file ID for receipts (nice-to-have)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (chat_id) REFERENCES chats(id)
);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, type) VALUES ('income', 'income');
INSERT OR IGNORE INTO categories (name, type) VALUES ('eating', 'expense');
INSERT OR IGNORE INTO categories (name, type) VALUES ('other', 'expense');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
-- Budgets table (monthly limits per category per chat)
CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    chat_id INTEGER,
    category_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    month TEXT NOT NULL, -- Format: YYYY-MM
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id, month),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (chat_id) REFERENCES chats(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
