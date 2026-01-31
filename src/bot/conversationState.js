/**
 * Conversation State Manager
 * Manages temporary state for multi-turn conversations with users
 */

const conversationStates = new Map();
const STATE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Set conversation state for a user
 */
function setState(chatId, state) {
    conversationStates.set(chatId, {
        ...state,
        timestamp: Date.now()
    });
}

/**
 * Get conversation state for a user
 */
function getState(chatId) {
    const state = conversationStates.get(chatId);
    
    if (!state) {
        return null;
    }
    
    // Check if state has expired
    if (Date.now() - state.timestamp > STATE_TIMEOUT) {
        conversationStates.delete(chatId);
        return null;
    }
    
    return state;
}

/**
 * Clear conversation state for a user
 */
function clearState(chatId) {
    conversationStates.delete(chatId);
}

/**
 * Update existing state
 */
function updateState(chatId, updates) {
    const currentState = getState(chatId);
    if (!currentState) {
        return false;
    }
    
    setState(chatId, {
        ...currentState,
        ...updates,
        timestamp: Date.now()
    });
    
    return true;
}

/**
 * Check if user is in a conversation
 */
function hasState(chatId) {
    return getState(chatId) !== null;
}

/**
 * Clean up expired states (run periodically)
 */
function cleanupExpiredStates() {
    const now = Date.now();
    for (const [chatId, state] of conversationStates.entries()) {
        if (now - state.timestamp > STATE_TIMEOUT) {
            conversationStates.delete(chatId);
        }
    }
}

// Run cleanup every minute
setInterval(cleanupExpiredStates, 60 * 1000);

module.exports = {
    setState,
    getState,
    clearState,
    updateState,
    hasState
};
