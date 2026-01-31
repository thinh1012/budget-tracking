const Tesseract = require('tesseract.js');

/**
 * Process a receipt image and extract potential transaction data
 */
async function processReceipt(imageBuffer) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng+vie', {
            // logger: m => console.log(m) // Optional: for debugging
        });

        console.log('OCR Output:', text);

        const extracted = parseReceiptText(text);
        return extracted;
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}

/**
 * Parse raw OCR text to find amount and potentially category/description
 */
function parseReceiptText(text) {
    const lines = text.split('\n');
    let amount = null;
    let description = '';

    // Common Vietnamese receipt patterns for total
    const totalKeywords = [
        'THÀNH TIỀN', 'THANH TOÁN', 'TỔNG CỘNG', 'TỔNG TIỀN',
        'TOTAL', 'AMOUNT', 'CASH', 'TIỀN MẶT', 'SUM'
    ];

    // Find the largest number that looks like a total, 
    // especially if it's near total keywords
    const amountRegex = /(\d{1,3}([,.]\d{3})+)|(\d{4,9})/g;

    let candidates = [];

    for (const line of lines) {
        const upperLine = line.toUpperCase();
        const hasKeyword = totalKeywords.some(k => upperLine.includes(k));

        const matches = line.match(amountRegex);
        if (matches) {
            for (const m of matches) {
                // Remove separators and convert to number
                const val = parseInt(m.replace(/[,.]/g, ''));
                if (val > 1000) { // Ignore small numbers
                    candidates.push({ val, hasKeyword, line: line.trim() });
                }
            }
        }

        // Try to get a store name (usually the first few lines)
        if (!description && line.trim().length > 3 && line.trim().length < 30) {
            description = line.trim();
        }
    }

    // Sort candidates: keywords first, then largest value
    candidates.sort((a, b) => {
        if (a.hasKeyword && !b.hasKeyword) return -1;
        if (!a.hasKeyword && b.hasKeyword) return 1;
        return b.val - a.val;
    });

    if (candidates.length > 0) {
        amount = candidates[0].val;
    }

    return {
        amount,
        textSnippet: text.substring(0, 200), // For debugging
        suggestedDescription: description
    };
}

module.exports = {
    processReceipt
};
