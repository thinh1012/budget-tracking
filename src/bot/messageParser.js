/**
 * Parse amount from various formats:
 * - 50k → 50000
 * - 1m → 1000000
 * - 1,000,000 → 1000000
 * - 1000000 → 1000000
 * - 50.5k → 50500
 */
function parseAmount(amountStr) {
    if (!amountStr) return null;

    // Remove spaces and convert to lowercase
    let cleaned = amountStr.toString().toLowerCase().trim();

    // Remove commas (1,000,000 → 1000000)
    cleaned = cleaned.replace(/,/g, '');

    // Check for multiplier suffixes
    let multiplier = 1;
    if (cleaned.endsWith('k')) {
        multiplier = 1000;
        cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('m')) {
        multiplier = 1000000;
        cleaned = cleaned.slice(0, -1);
    }

    // Parse the number
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;

    return Math.round(num * multiplier);
}

/**
 * Type keywords/aliases
 */
const TYPE_ALIASES = {
    'i': 'income',
    'in': 'income',
    'income': 'income',
    'e': 'expense',
    'exp': 'expense',
    'expense': 'expense'
};

/**
 * Known category keywords/aliases
 */
const CATEGORY_ALIASES = {
    // Income aliases
    'income': 'income',
    'salary': 'income',
    'lương': 'income',
    'luong': 'income',
    'thu nhập': 'income',
    'thu nhap': 'income',

    // Eating aliases
    'eating': 'eating',
    'eat': 'eating',
    'food': 'eating',
    'ăn': 'eating',
    'an': 'eating',
    'ăn uống': 'eating',
    'an uong': 'eating',

    // Other (default)
    'other': 'other',
    'khác': 'other',
    'khac': 'other'
};

/**
 * Parse a Telegram message into transaction data
 * 
 * Supports two formats:
 * 
 * NEW FORMAT (Preferred):
 * - "200k expense food both" → { amount: 200000, category: 'food', isIncome: false, contributor: 'both' }
 * - "300k income salary Nhi" → { amount: 300000, category: 'salary', isIncome: true, contributor: 'Nhi' }
 * - "50k e coffee" → { amount: 50000, category: 'coffee', isIncome: false }
 * - "2m i freelance" → { amount: 2000000, category: 'freelance', isIncome: true }
 * 
 * OLD FORMAT (Backward compatible):
 * - "+2m income salary" → { amount: 2000000, category: 'income', isIncome: true }
 * - "50k eating pho" → { amount: 50000, category: 'eating', isIncome: false }
 */
function parseMessage(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return { error: 'Empty message' };
    }

    const text = messageText.trim();

    // NEW FORMAT: <amount> <type> <category> [contributor]
    // Example: "200k expense food both" or "300k i salary Nhi"
    const newFormatPattern = /^(\d[\d,.]*[kmKM]?)\s+(i|in|income|e|exp|expense)\s+(\S+)(?:\s+(.+))?$/i;
    const newMatch = text.match(newFormatPattern);

    if (newMatch) {
        const [, amountStr, typeWord, categoryWord, contributor] = newMatch;

        // Parse amount
        const amount = parseAmount(amountStr);
        if (!amount || amount <= 0) {
            return { error: 'Invalid amount' };
        }

        // Resolve type
        const typeLower = typeWord.toLowerCase();
        const transactionType = TYPE_ALIASES[typeLower];
        if (!transactionType) {
            return { error: 'Invalid type. Use: i/in/income or e/exp/expense' };
        }

        const isIncome = transactionType === 'income';
        const categoryLower = categoryWord.toLowerCase();
        const category = CATEGORY_ALIASES[categoryLower] || categoryLower;

        return {
            amount,
            category,
            description: null,
            contributor: contributor?.trim() || null,
            isIncome
        };
    }

    // OLD FORMAT (Backward compatible): [+]<amount> <category> [description] [(contributor)]
    const oldFormatPattern = /^(\+)?(\d[\d,.]*[kmKM]?)\s+(\S+)(?:\s+(.+))?$/;
    const oldMatch = text.match(oldFormatPattern);

    if (!oldMatch) {
        return { error: 'Invalid format. Use: <amount> <type> <category> [contributor]\nExample: 200k expense food both' };
    }

    let [, plusSign, amountStr, categoryWord, restOfMessage] = oldMatch;

    // Parse amount
    const amount = parseAmount(amountStr);
    if (!amount || amount <= 0) {
        return { error: 'Invalid amount' };
    }

    // Extract contributor from parentheses (old format)
    let contributor = null;
    let description = restOfMessage;

    if (restOfMessage) {
        const contributorMatch = restOfMessage.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (contributorMatch) {
            description = contributorMatch[1].trim() || null;
            contributor = contributorMatch[2].trim();
        }
    }

    // Resolve category
    const categoryLower = categoryWord.toLowerCase();
    let category = CATEGORY_ALIASES[categoryLower];

    // If not a known alias, treat as a new category name
    if (!category) {
        category = categoryLower;
    }

    // If + prefix, force income category
    const isIncome = plusSign === '+' || category === 'income';
    if (isIncome && category !== 'income') {
        // If they wrote "+50k eating lunch", treat category as income with full description
        return {
            amount,
            category: 'income',
            description: `${categoryWord}${restOfMessage ? ' ' + restOfMessage : ''}`.trim() || null,
            contributor,
            isIncome: true
        };
    }

    return {
        amount,
        category,
        description: description?.trim() || null,
        contributor,
        isIncome: category === 'income'
    };
}

/**
 * Detect partial/incomplete input and provide helpful feedback
 */
function detectPartialInput(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return { type: 'empty', message: messageText };
    }

    const text = messageText.trim();

    // Check if it looks like it has an amount
    const hasAmount = /^\+?(\d[\d,.]*[kmKM]?)(\s|$)/.test(text);

    // Check if it's just words (no amount)
    const onlyWords = /^[a-zA-Z\s]+$/.test(text);

    // Try to extract any amount-like pattern
    const amountMatch = text.match(/^(\+)?(\d[\d,.]*[kmKM]?)/);
    let detectedAmount = null;
    let isIncome = false;

    if (amountMatch) {
        isIncome = amountMatch[1] === '+';
        detectedAmount = parseAmount(amountMatch[2]);
    }

    // Case 1: Only words, no amount
    if (onlyWords) {
        return {
            type: 'missing_amount',
            detected: { possibleCategory: text.split(/\s+/)[0] },
            missing: ['amount']
        };
    }

    // Case 2: Only amount, no category
    if (hasAmount && text.split(/\s+/).length === 1) {
        return {
            type: 'missing_category',
            detected: { amount: detectedAmount, isIncome },
            missing: ['category']
        };
    }

    // Case 3: Amount with words but invalid format
    if (hasAmount) {
        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
            // Has amount and category, check if it's income without contributor
            const categoryWord = parts[1].toLowerCase();
            const restParts = parts.slice(2).join(' ');

            // Check if it's income
            const isIncomeCategory = isIncome || categoryWord === 'income' || categoryWord === 'salary';

            // Check if contributor is missing
            const hasContributor = /\([^)]+\)/.test(text);

            if (isIncomeCategory && !hasContributor) {
                return {
                    type: 'missing_contributor',
                    detected: {
                        amount: detectedAmount,
                        category: categoryWord === 'salary' ? 'income' : categoryWord,
                        description: restParts || null,
                        isIncome: true
                    },
                    missing: ['contributor']
                };
            }
        }
    }

    return { type: 'unknown', message: text };
}

/**
 * Generate example based on what's missing
 */
function generateExamples(partialData) {
    const examples = [];

    if (partialData.type === 'missing_amount') {
        const category = partialData.detected.possibleCategory || 'eating';
        examples.push(`50k ${category} lunch`);
        examples.push(`100000 ${category} at restaurant`);
        examples.push(`2m ${category} party`);
    } else if (partialData.type === 'missing_category') {
        const amt = partialData.detected.amount;
        if (amt) {
            const amtStr = amt >= 1000000 ? `${amt / 1000000}m` : `${amt / 1000}k`;
            examples.push(`${amtStr} eating lunch`);
            examples.push(`${amtStr} transport grab`);
            examples.push(`${amtStr} shopping clothes`);
        } else {
            examples.push(`50k eating lunch`);
            examples.push(`100k transport`);
        }
    } else if (partialData.type === 'missing_contributor') {
        const { amount, category, description } = partialData.detected;
        const amtStr = amount >= 1000000 ? `+${amount / 1000000}m` : `+${amount / 1000}k`;
        const desc = description || 'salary';
        examples.push(`${amtStr} ${category} ${desc} (duc)`);
        examples.push(`${amtStr} ${category} ${desc} (wife)`);
        examples.push(`${amtStr} ${category} ${desc} (husband)`);
    }

    return examples;
}

/**
 * Format amount for display (Vietnamese style)
 * - 50000 → "50,000"
 * - 1000000 → "1,000,000"
 */
function formatAmount(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

/**
 * Format transaction for Telegram reply
 */
function formatTransactionReply(transaction) {
    const emoji = transaction.categoryType === 'income' ? '💰' : '💸';
    const sign = transaction.categoryType === 'income' ? '+' : '-';

    let reply = `${emoji} ${sign}${formatAmount(transaction.amount)} VND`;
    reply += `\n📁 ${transaction.category}`;
    if (transaction.description) {
        reply += `\n📝 ${transaction.description}`;
    }
    if (transaction.contributor) {
        reply += `\n👤 From: ${transaction.contributor}`;
    }
    reply += `\n✍️ By: ${transaction.user}`;

    return reply;
}

module.exports = {
    parseAmount,
    parseMessage,
    formatAmount,
    formatTransactionReply,
    CATEGORY_ALIASES,
    detectPartialInput,
    generateExamples
};
