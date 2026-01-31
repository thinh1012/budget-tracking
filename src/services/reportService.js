const QuickChart = require('quickchart-js');
const { getCategoryBreakdown, getSummary } = require('./transactionService');

/**
 * Generate a spending pie chart for a given date range
 */
async function generateSpendingPieChart({ startDate, endDate, title = 'Spending by Category' }) {
    const breakdown = getCategoryBreakdown({ startDate, endDate });
    const expenses = breakdown.filter(b => b.category_type === 'expense');

    if (expenses.length === 0) return null;

    const chart = new QuickChart();

    chart.setConfig({
        type: 'pie',
        data: {
            labels: expenses.map(e => e.category),
            datasets: [{
                data: expenses.map(e => e.total),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                ]
            }]
        },
        options: {
            title: {
                display: true,
                text: title
            }
        }
    });

    return await chart.toBinary();
}

/**
 * Generate a summary report for the current month
 */
async function generateMonthlyReport() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDate = now.toISOString();

    const summary = getSummary({ startDate, endDate });
    const chartBuffer = await generateSpendingPieChart({
        startDate,
        endDate,
        title: `Spending: ${now.toLocaleString('vi-VN', { month: 'long', year: 'numeric' })}`
    });

    return {
        summary,
        chartBuffer,
        monthName: now.toLocaleString('vi-VN', { month: 'long' })
    };
}

module.exports = {
    generateSpendingPieChart,
    generateMonthlyReport
};
