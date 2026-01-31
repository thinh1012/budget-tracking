const { initDatabase, getDatabase } = require('./src/database/database');
const { createTransaction, getSummary } = require('./src/services/transactionService');

initDatabase();

const before = getSummary();
console.log('Before Summary:', before);

const user = { id: 12345, username: 'tester', first_name: 'Tester' };
const tx = createTransaction({
    amount: 200,
    categoryName: 'income',
    description: 'test income',
    telegramUser: user
});

console.log('Created Transaction:', tx);

const after = getSummary();
console.log('After Summary:', after);

console.log('Difference:');
console.log('Income Diff:', after.income - before.income);
console.log('Expense Diff:', after.expenses - before.expenses);

if (after.expenses - before.expenses !== 0) {
    console.error('BUG DETECTED: Expenses increased by ' + (after.expenses - before.expenses));
} else {
    console.log('No bug detected in simple createTransaction + getSummary flow.');
}
