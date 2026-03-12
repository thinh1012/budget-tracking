/**
 * Budget Tracker Dashboard
 * Fetches data from API and renders charts and tables
 */

// API Base URL
const API_BASE = '/api';

// Chart instances
let categoryChart = null;
let trendsChart = null;
let yearlyChart = null;
let contributorChart = null;
let userSpendingChart = null;

// Current filter state
let currentFilters = {
    startDate: null,
    endDate: null
};

// Pagination state
let transactionOffset = 0;
const TRANSACTIONS_PER_PAGE = 20;

// Current tab
let currentTab = 'overview';

/**
 * Format amount for display (Vietnamese style)
 */
function formatAmount(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get date range based on period
 */
function getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper to get next day for inclusive date filtering
    const getNextDay = (date) => {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        return next.toISOString().split('T')[0];
    };

    switch (period) {
        case 'today':
            return {
                startDate: today.toISOString().split('T')[0],
                endDate: getNextDay(today)
            };
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return {
                startDate: weekStart.toISOString().split('T')[0],
                endDate: getNextDay(now)
            };
        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return {
                startDate: monthStart.toISOString().split('T')[0],
                endDate: getNextDay(now)
            };
        case 'all':
        default:
            return { startDate: null, endDate: null };
    }
}

/**
 * Fetch data from API
 */
async function fetchAPI(endpoint, params = {}) {
    const url = new URL(API_BASE + endpoint, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

/**
 * Load and display summary
 */
async function loadSummary() {
    try {
        const summary = await fetchAPI('/summary', currentFilters);

        document.getElementById('incomeAmount').textContent = formatAmount(summary.income) + ' ₫';
        document.getElementById('expensesAmount').textContent = formatAmount(summary.expenses) + ' ₫';
        document.getElementById('savingsAmount').textContent = formatAmount(summary.savings) + ' ₫';

        // Update balance color based on value
        const savingsEl = document.getElementById('savingsAmount');
        if (summary.savings < 0) {
            savingsEl.style.color = 'var(--accent-expense)';
        } else {
            savingsEl.style.color = 'var(--accent-savings)';
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

/**
 * Load and display category breakdown chart
 */
async function loadCategoryChart() {
    try {
        const categories = await fetchAPI('/categories', currentFilters);

        // Filter to only expenses for pie chart
        const expenses = categories.filter(c => c.category_type === 'expense');

        const labels = expenses.map(c => c.category.charAt(0).toUpperCase() + c.category.slice(1));
        const data = expenses.map(c => c.total);

        // Generate colors
        const colors = [
            '#f43f5e', '#8b5cf6', '#6366f1', '#3b82f6',
            '#10b981', '#f59e0b', '#ec4899', '#14b8a6'
        ];

        const ctx = document.getElementById('categoryChart').getContext('2d');

        if (categoryChart) {
            categoryChart.destroy();
        }

        if (data.length === 0) {
            // Show empty state
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No expense data', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 12, family: 'Inter' },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 36, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${formatAmount(context.raw)} ₫`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    } catch (error) {
        console.error('Error loading category chart:', error);
    }
}

/**
 * Load and display trends chart
 */
async function loadTrendsChart() {
    try {
        const trends = await fetchAPI('/trends', { months: 6 });

        // Process data for chart
        const months = [...new Set(trends.map(t => t.month))].sort();
        const incomeData = months.map(m => {
            const entry = trends.find(t => t.month === m && t.category_type === 'income');
            return entry ? entry.total : 0;
        });
        const expenseData = months.map(m => {
            const entry = trends.find(t => t.month === m && t.category_type === 'expense');
            return entry ? entry.total : 0;
        });

        // Format month labels
        const labels = months.map(m => {
            const [year, month] = m.split('-');
            return new Date(year, month - 1).toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
        });

        const ctx = document.getElementById('trendsChart').getContext('2d');

        if (trendsChart) {
            trendsChart.destroy();
        }

        if (months.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No trend data yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        trendsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(244, 63, 94, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 12, family: 'Inter' },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 36, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${formatAmount(context.raw)} ₫`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            callback: function (value) {
                                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading trends chart:', error);
    }
}

/**
 * Load and display transactions
 */
async function loadTransactions(append = false) {
    try {
        if (!append) {
            transactionOffset = 0;
        }

        const transactions = await fetchAPI('/transactions', {
            ...currentFilters,
            limit: TRANSACTIONS_PER_PAGE,
            offset: transactionOffset
        });

        const tbody = document.getElementById('transactionsBody');

        if (!append) {
            tbody.innerHTML = '';
        }

        if (transactions.length === 0 && !append) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <p>No transactions yet. Send a message via Telegram to get started!</p>
                    </td>
                </tr>
            `;
            document.getElementById('transactionCount').textContent = '0 transactions';
            document.getElementById('loadMoreBtn').style.display = 'none';
            return;
        }

        transactions.forEach(t => {
            const row = document.createElement('tr');
            const isIncome = t.category_type === 'income';
            const amountClass = isIncome ? 'amount-income' : 'amount-expense';
            const sign = isIncome ? '+' : '-';

            row.innerHTML = `
                <td>${formatDate(t.created_at)}</td>
                <td><span class="category-badge">${t.category}</span></td>
                <td>${t.description || '-'}</td>
                <td>${t.contributor ? `<span class="contributor-badge">${t.contributor}</span>` : '-'}</td>
                <td>${t.first_name || t.username || 'Unknown'}</td>
                <td class="text-right ${amountClass}">${sign}${formatAmount(t.amount)} ₫</td>
            `;
            tbody.appendChild(row);
        });

        transactionOffset += transactions.length;

        // Update count
        const totalRows = tbody.querySelectorAll('tr').length;
        document.getElementById('transactionCount').textContent = `${totalRows} transactions`;

        // Show/hide load more button
        document.getElementById('loadMoreBtn').style.display =
            transactions.length < TRANSACTIONS_PER_PAGE ? 'none' : 'inline-flex';

    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

/**
 * Load all data
 */
async function loadAllData() {
    await Promise.all([
        loadSummary(),
        loadCategoryChart(),
        loadTrendsChart(),
        loadTransactions()
    ]);
}

/**
 * Apply date filter
 */
function applyFilter() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    currentFilters.startDate = startDate || null;
    currentFilters.endDate = endDate || null;

    // Clear active quick filter
    document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.remove('active'));

    loadAllData();
}

/**
 * Clear date filter
 */
function clearFilter() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    currentFilters.startDate = null;
    currentFilters.endDate = null;

    // Set "All Time" as active
    document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.quick-filter[data-period="all"]').classList.add('active');

    loadAllData();
}

/**
 * Handle quick filter click
 */
function handleQuickFilter(event) {
    const period = event.target.dataset.period;
    const range = getDateRange(period);

    currentFilters.startDate = range.startDate;
    currentFilters.endDate = range.endDate;

    // Update date inputs
    document.getElementById('startDate').value = range.startDate || '';
    document.getElementById('endDate').value = range.endDate || '';

    // Update active state
    document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    loadAllData();
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });

    // Load tab-specific data
    if (tabName === 'analytics') {
        loadAnalytics();
    } else if (tabName === 'contributors') {
        loadContributors();
    } else if (tabName === 'monthly') {
        loadMonthlyTab();
    }
}

/**
 * Load analytics data
 */
async function loadAnalytics() {
    await Promise.all([
        loadYearlyChart(),
        loadYearlyStats()
    ]);
}

/**
 * Load yearly summary chart
 */
async function loadYearlyChart() {
    try {
        const data = await fetchAPI('/analytics/yearly');

        // Group by year
        const years = [...new Set(data.map(d => d.year))].sort().reverse();
        const incomeData = years.map(y => {
            const entry = data.find(d => d.year === y && d.category_type === 'income');
            return entry ? entry.total : 0;
        });
        const expenseData = years.map(y => {
            const entry = data.find(d => d.year === y && d.category_type === 'expense');
            return entry ? entry.total : 0;
        });

        const ctx = document.getElementById('yearlyChart').getContext('2d');

        if (yearlyChart) {
            yearlyChart.destroy();
        }

        if (years.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No yearly data yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        yearlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(244, 63, 94, 0.8)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 12, family: 'Inter' },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 36, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${formatAmount(context.raw)} ₫`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            callback: function (value) {
                                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading yearly chart:', error);
    }
}

/**
 * Load yearly stats
 */
async function loadYearlyStats() {
    try {
        const data = await fetchAPI('/analytics/yearly');
        const currentYear = new Date().getFullYear().toString();
        const lastYear = (currentYear - 1).toString();

        // This year stats
        const thisYearIncome = data.find(d => d.year === currentYear && d.category_type === 'income');
        const thisYearExpenses = data.find(d => d.year === currentYear && d.category_type === 'expense');

        const thisYearStats = document.getElementById('thisYearStats');
        thisYearStats.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Income</span>
                <span class="stat-value" style="color: var(--accent-income)">${formatAmount(thisYearIncome?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Expenses</span>
                <span class="stat-value" style="color: var(--accent-expense)">${formatAmount(thisYearExpenses?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Balance</span>
                <span class="stat-value">${formatAmount((thisYearIncome?.total || 0) - (thisYearExpenses?.total || 0))} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Transactions</span>
                <span class="stat-value">${(thisYearIncome?.count || 0) + (thisYearExpenses?.count || 0)}</span>
            </div>
        `;

        // Last year stats
        const lastYearIncome = data.find(d => d.year === lastYear && d.category_type === 'income');
        const lastYearExpenses = data.find(d => d.year === lastYear && d.category_type === 'expense');

        const lastYearStats = document.getElementById('lastYearStats');
        lastYearStats.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Income</span>
                <span class="stat-value" style="color: var(--accent-income)">${formatAmount(lastYearIncome?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Expenses</span>
                <span class="stat-value" style="color: var(--accent-expense)">${formatAmount(lastYearExpenses?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Balance</span>
                <span class="stat-value">${formatAmount((lastYearIncome?.total || 0) - (lastYearExpenses?.total || 0))} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Transactions</span>
                <span class="stat-value">${(lastYearIncome?.count || 0) + (lastYearExpenses?.count || 0)}</span>
            </div>
        `;
    } catch (error) {
        console.error('Error loading yearly stats:', error);
    }
}

/**
 * Load contributors data
 */
async function loadContributors() {
    await Promise.all([
        loadContributorChart(),
        loadUserSpendingChart(),
        loadContributorBreakdown(),
        loadUserBreakdown()
    ]);
}

/**
 * Load contributor chart
 */
async function loadContributorChart() {
    try {
        const data = await fetchAPI('/contributors', currentFilters);

        const labels = data.map(d => d.contributor || 'Unknown');
        const values = data.map(d => d.total);
        const colors = ['#10b981', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899'];

        const ctx = document.getElementById('contributorChart').getContext('2d');

        if (contributorChart) {
            contributorChart.destroy();
        }

        if (data.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No contributor data', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        contributorChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, values.length),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 12, family: 'Inter' },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 36, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${formatAmount(context.raw)} ₫`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    } catch (error) {
        console.error('Error loading contributor chart:', error);
    }
}

/**
 * Load user spending chart
 */
async function loadUserSpendingChart() {
    try {
        const data = await fetchAPI('/users/spending', currentFilters);

        // Group by user and type
        const users = [...new Set(data.map(d => d.user))];
        const incomeData = users.map(u => {
            const entry = data.find(d => d.user === u && d.category_type === 'income');
            return entry ? entry.total : 0;
        });
        const expenseData = users.map(u => {
            const entry = data.find(d => d.user === u && d.category_type === 'expense');
            return entry ? entry.total : 0;
        });

        const ctx = document.getElementById('userSpendingChart').getContext('2d');

        if (userSpendingChart) {
            userSpendingChart.destroy();
        }

        if (users.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No user data', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        userSpendingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: users,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(244, 63, 94, 0.8)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 12, family: 'Inter' },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 36, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${formatAmount(context.raw)} ₫`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            callback: function (value) {
                                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading user spending chart:', error);
    }
}

/**
 * Load contributor breakdown table
 */
async function loadContributorBreakdown() {
    try {
        const data = await fetchAPI('/contributors', currentFilters);
        const total = data.reduce((sum, d) => sum + d.total, 0);

        const container = document.getElementById('contributorBreakdown');

        if (data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No contributors yet</p>';
            return;
        }

        container.innerHTML = data.map(d => {
            const percentage = total > 0 ? ((d.total / total) * 100).toFixed(1) : 0;
            return `
                <div class="breakdown-item">
                    <span class="breakdown-name">${d.contributor || 'Unknown'}</span>
                    <div class="breakdown-stats">
                        <span class="breakdown-amount">${formatAmount(d.total)} ₫</span>
                        <span class="breakdown-percentage">${percentage}%</span>
                        <span class="breakdown-count">${d.count} transactions</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading contributor breakdown:', error);
    }
}

/**
 * Load user breakdown table
 */
async function loadUserBreakdown() {
    try {
        const data = await fetchAPI('/users/spending', currentFilters);

        // Group by user, summing income and expenses
        const userMap = {};
        data.forEach(d => {
            if (!userMap[d.user]) {
                userMap[d.user] = { income: 0, expense: 0, count: 0 };
            }
            if (d.category_type === 'income') {
                userMap[d.user].income += d.total;
            } else {
                userMap[d.user].expense += d.total;
            }
            userMap[d.user].count += d.count;
        });

        const container = document.getElementById('userBreakdown');

        if (Object.keys(userMap).length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No user data yet</p>';
            return;
        }

        container.innerHTML = Object.entries(userMap).map(([user, stats]) => {
            return `
                <div class="breakdown-item">
                    <span class="breakdown-name">${user}</span>
                    <div class="breakdown-stats">
                        <span class="breakdown-amount" style="color: var(--accent-expense)">${formatAmount(stats.expense)} ₫</span>
                        <span class="breakdown-count">${stats.count} transactions</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading user breakdown:', error);
    }
}

/**
 * Initialize the dashboard
 */
function init() {
    // Set default filter to "This Month"
    const monthRange = getDateRange('month');
    currentFilters.startDate = monthRange.startDate;
    currentFilters.endDate = monthRange.endDate;
    document.getElementById('startDate').value = monthRange.startDate || '';
    document.getElementById('endDate').value = monthRange.endDate || '';

    // Load initial data
    loadAllData();

    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', loadAllData);
    document.getElementById('applyFilter').addEventListener('click', applyFilter);
    document.getElementById('clearFilter').addEventListener('click', clearFilter);
    document.getElementById('loadMoreBtn').addEventListener('click', () => loadTransactions(true));

    // Quick filters
    document.querySelectorAll('.quick-filter').forEach(btn => {
        btn.addEventListener('click', handleQuickFilter);
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.currentTarget.dataset.tab);
        });
    });

    // Auto-refresh every 30 seconds
    setInterval(loadAllData, 30000);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// ─── Export ───────────────────────────────────────────────────────────────────
function buildExportUrl(format) {
    const params = new URLSearchParams({ format });
    if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
    if (currentFilters.endDate) params.set('endDate', currentFilters.endDate);
    return '/api/export?' + params.toString();
}

document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportBtn');
    const exportMenu = document.getElementById('exportMenu');

    // Toggle dropdown
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('open');
    });

    // Close when clicking outside
    document.addEventListener('click', () => exportMenu.classList.remove('open'));

    // CSV download
    document.getElementById('exportCsv').addEventListener('click', () => {
        window.location.href = buildExportUrl('csv');
        exportMenu.classList.remove('open');
    });

    // Excel download
    document.getElementById('exportXlsx').addEventListener('click', () => {
        window.location.href = buildExportUrl('xlsx');
        exportMenu.classList.remove('open');
    });
});


// ─── Theme Toggle ─────────────────────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    if (saved === 'light') applyTheme('light');
})();

function applyTheme(mode) {
    if (mode === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('iconSun').style.display = 'block';
        document.getElementById('iconMoon').style.display = 'none';
    } else {
        document.body.classList.remove('light-mode');
        document.getElementById('iconSun').style.display = 'none';
        document.getElementById('iconMoon').style.display = 'block';
    }
    localStorage.setItem('theme', mode);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('themeToggle').addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-mode');
        applyTheme(isLight ? 'dark' : 'light');
    });
});

// ─── Search Bar ───────────────────────────────────────────────────────────────
let allLoadedTransactions = [];

function applySearch() {
    const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('#transactionsBody tr');
    rows.forEach(row => {
        if (!q) { row.style.display = ''; return; }
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
    document.getElementById('searchClear').classList.toggle('visible', !!q);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', applySearch);
    document.getElementById('searchClear').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        applySearch();
    });
});

// ─── Monthly Tab ──────────────────────────────────────────────────────────────
let monthlyChart = null;

async function loadMonthlyTab() {
    try {
        // Fetch 36 months of trend data (no date filter — always show all time)
        const trends = await fetchAPI('/trends', { months: 36 });

        const months = [...new Set(trends.map(t => t.month))].sort();

        const rows = months.map(m => {
            const inc = (trends.find(t => t.month === m && t.category_type === 'income') || {}).total || 0;
            const exp = (trends.find(t => t.month === m && t.category_type === 'expense') || {}).total || 0;
            return { month: m, income: inc, expenses: exp, balance: inc - exp };
        }).reverse(); // newest first

        // ── Chart ──
        const chartLabels = [...rows].reverse().map(r => {
            const [yr, mo] = r.month.split('-');
            return new Date(yr, mo - 1).toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
        });
        const chartIncome   = [...rows].reverse().map(r => r.income);
        const chartExpenses = [...rows].reverse().map(r => r.expenses);
        const chartBalance  = [...rows].reverse().map(r => r.balance);

        const ctx = document.getElementById('monthlyChart').getContext('2d');
        if (monthlyChart) monthlyChart.destroy();

        monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    { label: 'Income',   data: chartIncome,   borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: false, pointRadius: 3 },
                    { label: 'Expenses', data: chartExpenses, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)',  tension: 0.3, fill: false, pointRadius: 3 },
                    { label: 'Balance',  data: chartBalance,  borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', tension: 0.3, fill: true,  pointRadius: 3 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { color: '#94a3b8', font: { size: 12, family: 'Inter' }, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: {
                        backgroundColor: 'rgba(26,26,36,0.95)', titleColor: '#f8fafc', bodyColor: '#94a3b8',
                        borderColor: 'rgba(148,163,184,0.1)', borderWidth: 1, padding: 12,
                        callbacks: { label: ctx => ctx.dataset.label + ': ' + formatAmount(ctx.raw) + ' ₫' }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 11 } } },
                    y: { grid: { color: 'rgba(148,163,184,0.06)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: v => (v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : (v/1000).toFixed(0) + 'k') } }
                }
            }
        });

        // ── Table ──
        const tbody = document.getElementById('monthlyTableBody');
        const tfoot = document.getElementById('monthlyTableFoot');
        tbody.innerHTML = '';

        let totIncome = 0, totExpenses = 0;
        rows.forEach(r => {
            totIncome   += r.income;
            totExpenses += r.expenses;
            const bal = r.balance;
            const rate = r.income > 0 ? Math.round((r.income - r.expenses) / r.income * 100) : null;
            const [yr, mo] = r.month.split('-');
            const label = new Date(yr, mo - 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

            let badgeClass = 'zero', badgeText = 'N/A';
            if (rate !== null) { badgeClass = rate >= 0 ? 'good' : 'bad'; badgeText = rate + '%'; }

            tbody.insertAdjacentHTML('beforeend',
                '<tr>' +
                '<td>' + label + '</td>' +
                '<td class="text-right" style="color:var(--accent-income)">' + formatAmount(r.income) + ' ₫</td>' +
                '<td class="text-right" style="color:var(--accent-expense)">' + formatAmount(r.expenses) + ' ₫</td>' +
                '<td class="text-right ' + (bal >= 0 ? 'positive' : 'negative') + '">' + formatAmount(bal) + ' ₫</td>' +
                '<td class="text-right"><span class="savings-badge ' + badgeClass + '">' + badgeText + '</span></td>' +
                '</tr>'
            );
        });

        const totBal = totIncome - totExpenses;
        const totRate = totIncome > 0 ? Math.round(totBal / totIncome * 100) : null;
        tfoot.innerHTML =
            '<tr>' +
            '<td>Total (' + rows.length + ' months)</td>' +
            '<td class="text-right" style="color:var(--accent-income)">' + formatAmount(totIncome) + ' ₫</td>' +
            '<td class="text-right" style="color:var(--accent-expense)">' + formatAmount(totExpenses) + ' ₫</td>' +
            '<td class="text-right ' + (totBal >= 0 ? 'positive' : 'negative') + '">' + formatAmount(totBal) + ' ₫</td>' +
            '<td class="text-right"><span class="savings-badge ' + (totRate !== null ? (totRate >= 0 ? 'good' : 'bad') : 'zero') + '">' + (totRate !== null ? totRate + '%' : 'N/A') + '</span></td>' +
            '</tr>';

    } catch (err) {
        console.error('Error loading monthly tab:', err);
    }
}
