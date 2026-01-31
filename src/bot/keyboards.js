/**
 * Telegram Inline Keyboard Helpers
 * Builders for consistent inline keyboards
 */

/**
 * Create category selection keyboard
 */
function categoryKeyboard(categories) {
    const buttons = categories.map(cat => [{
        text: `${getCategoryEmoji(cat)} ${capitalize(cat)}`,
        callback_data: `cat_${cat}`
    }]);

    // Add "Other" option
    buttons.push([{
        text: '📝 Type custom category',
        callback_data: 'cat_custom'
    }]);

    return { inline_keyboard: buttons };
}

/**
 * Create confirmation keyboard
 */
function confirmationKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '✅ Confirm', callback_data: 'confirm_yes' },
                { text: '❌ Cancel', callback_data: 'confirm_no' }
            ]
        ]
    };
}

/**
 * Create help keyboard
 */
function helpKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '📚 Show Examples', callback_data: 'help_examples' },
                { text: '❓ Format Help', callback_data: 'help_format' }
            ],
            [
                { text: '🔄 Try Again', callback_data: 'help_retry' }
            ]
        ]
    };
}

/**
 * Create contributor selection keyboard
 */
function contributorKeyboard(contributors) {
    const buttons = contributors.map(name => [{
        text: `👤 ${capitalize(name)}`,
        callback_data: `contrib_${name}`
    }]);

    // Add custom option
    buttons.push([{
        text: '📝 Type custom name',
        callback_data: 'contrib_custom'
    }]);

    return { inline_keyboard: buttons };
}

/**
 * Get emoji for category
 */
function getCategoryEmoji(category) {
    const emojiMap = {
        'eating': '🍜',
        'food': '🍜',
        'transport': '🚗',
        'shopping': '🛒',
        'bills': '💡',
        'entertainment': '🎬',
        'health': '⚕️',
        'education': '📚',
        'income': '💰',
        'other': '🏠'
    };

    return emojiMap[category.toLowerCase()] || '📁';
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Create success keyboard with Undo button
 */
function successKeyboard(transactionId) {
    return {
        inline_keyboard: [
            [
                { text: '⏮️ Undo / Revert', callback_data: `undo_${transactionId}` }
            ]
        ]
    };
}

module.exports = {
    categoryKeyboard,
    confirmationKeyboard,
    helpKeyboard,
    contributorKeyboard,
    getCategoryEmoji,
    capitalize,
    successKeyboard
};
