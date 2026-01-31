/**
 * Message Templates
 * Standardized bot response messages
 */

const { formatAmount } = require('./messageParser');
const { getCategoryEmoji } = require('./keyboards');

/**
 * Error message for missing amount
 */
function missingAmountError(examples = []) {
    const defaultExamples = examples.length > 0 ? examples : [
        '50k eating lunch',
        '100000 transport grab',
        '2m other shopping'
    ];

    return `❌ *Missing amount!*

You need to specify how much you spent.

*Try these:*
${defaultExamples.map(ex => `• \`${ex}\``).join('\n')}

*Format:* \`<amount> <category> [description]\``;
}

/**
 * Error message for invalid format
 */
function invalidFormatError() {
    return `❌ *Invalid format!*

*Correct format:*
\`<amount> <category> [description] [(contributor)]\`

*Examples:*
• \`50k eating pho\` - Food expense
• \`100k transport grab\` - Transport
• \`+2m income salary (duc)\` - Income with contributor
• \`1,000,000 shopping clothes\` - Shopping

*Amount formats:*
• \`50k\` = 50,000
• \`1m\` = 1,000,000
• \`+ prefix\` = income

Use /help for more info`;
}

/**
 * Ask for category selection
 */
function askForCategory(amount) {
    return `💭 *What did you spend ${formatAmount(amount)} ₫ on?*

Choose a category or type a custom one:`;
}

/**
 * Ask for contributor (income)
 */
function askForContributor(amount, description = null) {
    let message = `👤 *Who contributed this income?*\n\n`;
    message += `Amount: ${formatAmount(amount)} ₫\n`;
    if (description) {
        message += `Description: ${description}\n`;
    }
    message += `\nChoose a contributor or type a name:`;

    return message;
}

/**
 * Large transaction confirmation
 */
function largeTransactionConfirmation(transaction) {
    const emoji = transaction.category === 'income' ? '💰' : '💸';
    const sign = transaction.category === 'income' ? '+' : '-';

    let message = `${emoji} *Large Transaction Detected!*\n\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `💵 Amount: *${sign}${formatAmount(transaction.amount)} ₫*\n`;
    message += `📁 Category: ${getCategoryEmoji(transaction.category)} ${transaction.category}\n`;

    if (transaction.description) {
        message += `📝 Description: ${transaction.description}\n`;
    }
    if (transaction.contributor) {
        message += `👤 Contributor: ${transaction.contributor}\n`;
    }

    message += `━━━━━━━━━━━━━━━\n\n`;
    message += `Please confirm this transaction:`;

    return message;
}

/**
 * Transaction success message
 */
function transactionSuccess(transaction, wasInteractive = false) {
    const emoji = transaction.categoryType === 'income' ? '💰' : '💸';
    const sign = transaction.categoryType === 'income' ? '+' : '-';

    let message = `✅ *Transaction Recorded!*\n\n`;
    message += `${emoji} ${sign}${formatAmount(transaction.amount)} ₫\n`;
    message += `📁 ${getCategoryEmoji(transaction.category)} ${transaction.category}\n`;

    if (transaction.description) {
        message += `📝 ${transaction.description}\n`;
    }
    if (transaction.contributor) {
        message += `👤 From: ${transaction.contributor}\n`;
    }
    message += `✍️ By: ${transaction.user}\n\n`;

    if (wasInteractive) {
        // Build the equivalent one-liner format
        let formatString = `${transaction.categoryType === 'income' ? '+' : ''}${formatAmount(transaction.amount)} ${transaction.category}`;
        if (transaction.description) formatString += ` ${transaction.description}`;
        if (transaction.contributor) formatString += ` (${transaction.contributor})`;

        message += `💡 *Pro Tip:* You can type everything in one line next time:\n\`${formatString}\``;
    }

    return message;
}

/**
 * Transaction preview
 */
function transactionPreview(data) {
    const emoji = data.category === 'income' ? '💰' : '💸';
    const sign = data.category === 'income' ? '+' : '';

    let message = `📋 *Transaction Preview*\n\n`;
    message += `${emoji} Amount: ${sign}${formatAmount(data.amount)} ₫\n`;
    message += `📁 Category: ${getCategoryEmoji(data.category)} ${data.category}\n`;

    if (data.description) {
        message += `📝 Description: ${data.description}\n`;
    }
    if (data.contributor) {
        message += `👤 Contributor: ${data.contributor}\n`;
    }

    message += `\nReady to save?`;

    return message;
}

/**
 * Missing contributor warning
 */
function missingContributorWarning() {
    return `⚠️ *Missing contributor for income!*

For income transactions, please specify who contributed.

*Examples:*
• \`+2m income salary (duc)\`
• \`+500k income bonus (wife)\`
• \`2m income salary (husband)\`

Who contributed this income?`;
}

/**
 * Enhanced help with user's recent examples
 */
function enhancedHelp(userExamples = [], userCategories = []) {
    let message = `💰 *Budget Tracker Bot*\n\n`;
    message += `📝 *Add Transaction*\n`;
    message += `\`<amount> <type> <category> [contributor]\`\n`;
    message += `Type: \`i\`/\`in\`/\`income\` or \`e\`/\`exp\`/\`expense\`\n\n`;

    if (userExamples.length > 0) {
        message += `*Your Recent Transactions:*\n`;
        userExamples.forEach(ex => {
            const emoji = ex.category_type === 'income' ? '💰' : '💸';
            const sign = ex.category_type === 'income' ? '+' : '';
            message += `• ${emoji} \`${sign}${formatAmount(ex.amount)} ${ex.category}${ex.description ? ' ' + ex.description : ''}\`\n`;
        });
        message += `\n`;
    }

    message += `*Common Examples:*\n`;
    message += `• \`50k e food\` - Expense\n`;
    message += `• \`300k income salary Nhi\` - Income from Nhi\n`;
    message += `• \`100k exp transport\` - Transport expense\n`;
    message += `• \`2m i freelance Thinh\` - Income from Thinh\n`;
    message += `• \`200k expense shopping both\` - Shared expense\n\n`;

    if (userCategories.length > 0) {
        message += `*Your Categories:*\n`;
        message += userCategories.map(cat => `${getCategoryEmoji(cat)} ${cat}`).join(', ');
        message += `\n\n`;
    }

    message += `💡 *Amount Formats:*\n`;
    message += `• \`50k\` = 50,000\n`;
    message += `• \`1m\` = 1,000,000\n`;
    message += `• \`1,000,000\` = 1,000,000\n\n`;

    message += `📊 *Commands:*\n`;
    message += `• \`/help\` - Show this message\n`;
    message += `• \`/summary\` - Monthly summary\n`;
    message += `• \`/setbudget <category> <amount>\` - Set budget\n`;
    message += `• \`/report\` - Visual spending report\n`;
    message += `• \`how much <category>\` - Check spending\n`;
    message += `• \`last 5 <category>\` - Search history\n\n`;



    return message;
}

/**
 * Budget alert/warning message
 */
function budgetAlert(category, status) {
    const emoji = status.percent >= 100 ? '🔴' : '🟡';
    const title = status.percent >= 100 ? '*Budget Exceeded!*' : '*Budget Warning (80%)*';

    let message = `${emoji} ${title}\n\n`;
    message += `Category: ${getCategoryEmoji(category)} ${category}\n`;
    message += `Spent: ${formatAmount(status.spent)} ₫ / Limit: ${formatAmount(status.limit)} ₫\n`;
    message += `Usage: *${Math.round(status.percent)}%*\n\n`;

    if (status.percent >= 100) {
        message += `⚠️ You have spent ${formatAmount(Math.abs(status.remaining))} ₫ over your limit.`;
    } else {
        message += `💡 You have ${formatAmount(status.remaining)} ₫ left for this month.`;
    }

    return message;
}

/**
 * Budget limit set confirmation
 */
function budgetLimitSet(category, amount) {
    return `✅ *Budget Set!*\n\n${getCategoryEmoji(category)} ${category}: ${formatAmount(amount)} ₫ per month.`;
}

/**
 * Format search results (Smart Search)
 */
function searchResult(transactions, query = '') {
    if (transactions.length === 0) {
        return `🔍 No transactions found for "${query}".`;
    }

    let message = `🔍 *Search Results${query ? ' for "' + query + '"' : ''}*\n\n`;

    transactions.forEach(t => {
        const emoji = t.category_type === 'income' ? '💰' : '💸';
        const date = new Date(t.created_at).toLocaleDateString('vi-VN');
        const sign = t.category_type === 'income' ? '+' : '-';

        message += `• ${emoji} \`${sign}${formatAmount(t.amount)}\` ${t.category}${t.description ? ' _' + t.description + '_' : ''} (${date})\n`;
    });

    return message;
}

/**
 * Canceled message
 */
function canceled() {
    return `❌ Transaction canceled.`;
}

/**
 * Timeout message
 */
function timeout() {
    return `⏱️ Conversation timed out. Please start over.`;
}

module.exports = {
    missingAmountError,
    invalidFormatError,
    askForCategory,
    askForContributor,
    largeTransactionConfirmation,
    transactionSuccess,
    transactionPreview,
    missingContributorWarning,
    enhancedHelp,
    budgetAlert,
    budgetLimitSet,
    searchResult,
    canceled,
    timeout
};
