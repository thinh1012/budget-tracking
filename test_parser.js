const { parseMessage } = require('./src/bot/messageParser');

console.log('=== Testing New Format ===\n');

const testCases = [
    '200k expense food both',
    '300k income salary Nhi',
    '500k income income Thinh',
    '50k e coffee',
    '2m i freelance',
    '100k exp transport',

    // Edge cases
    '1,000,000 expense shopping',
    '50k in salary',

    // Old format (backward compatibility)
    '+2m income salary',
    '50k eating pho',
];

testCases.forEach(test => {
    console.log(`Input: "${test}"`);
    const result = parseMessage(test);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('---\n');
});
