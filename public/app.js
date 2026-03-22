/**
 * Budget Tracker Dashboard
 * Fetches data from API and renders charts and tables
 */

// API Base URL
const API_BASE = '/api';

// ─── i18n ─────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
    en: {
        'logo': 'Budget Tracker',
        'chat-admin': 'Admin (all chats)',
        'label-from': 'From', 'label-to': 'To',
        'btn-apply': 'Apply', 'btn-clear': 'Clear',
        'filter-today': 'Today', 'filter-week': 'This Week',
        'filter-month': 'This Month', 'filter-all': 'All Time',
        'tab-overview': ' Overview', 'tab-analytics': ' Analytics',
        'tab-contributors': ' Contributors', 'tab-monthly': ' Monthly',
        'card-income': 'Income', 'card-expenses': 'Expenses', 'card-balance': 'Balance',
        'limit-label': 'Monthly Spending Limit', 'limit-edit': 'Edit', 'limit-remove': 'Remove',
        'limit-unset': 'No spending limit set', 'limit-set': 'Set Limit',
        'limit-save': 'Save', 'limit-cancel': 'Cancel',
        'limit-placeholder': 'Amount in ₫ e.g. 10000000',
        'chart-category': 'Spending by Category', 'chart-trends': 'Monthly Trends',
        'tx-title': 'Recent Transactions',
        'search-placeholder': 'Search by description, category, contributor…',
        'th-date': 'Date', 'th-category': 'Category', 'th-description': 'Description',
        'th-contributor': 'Contributor', 'th-user': 'User', 'th-amount': 'Amount',
        'btn-load-more': 'Load More',
        'chart-yearly': 'Yearly Summary', 'stat-this-year': 'This Year', 'stat-last-year': 'Last Year',
        'chart-income-contrib': 'Income by Contributor', 'chart-user-spending': 'Spending by User',
        'breakdown-income': '💰 Income Contributors', 'breakdown-spending': '💸 User Spending',
        'monthly-overview': 'Monthly Overview', 'monthly-breakdown': 'Month-by-Month Breakdown',
        'th-month': 'Month', 'th-savings-rate': 'Savings Rate',
        'modal-title': 'Edit Transaction', 'modal-label-date': 'Date', 'modal-label-type': 'Type',
        'modal-opt-expense': 'Expense', 'modal-opt-income': 'Income',
        'modal-label-category': 'Category', 'modal-label-amount': 'Amount (₫)',
        'modal-label-desc': 'Description', 'modal-label-contrib': 'Contributor',
        'modal-category-placeholder': 'e.g. eating, transport',
        'modal-desc-placeholder': 'Optional', 'modal-contrib-placeholder': 'Optional',
        'btn-delete': 'Delete', 'btn-cancel': 'Cancel', 'btn-save-changes': 'Save Changes',
        'export-csv': '📄 Export CSV', 'export-xlsx': '📊 Export Excel',
        'footer-send': 'Send transactions via Telegram:',
        'footer-examples': 'Examples:',
        'stat-income': 'Income', 'stat-expenses': 'Expenses',
        'stat-balance': 'Balance', 'stat-transactions': 'Transactions',
        'monthly-total': (n) => `Total (${n} months)`,
        'tx-count': (n) => `${n} transaction${n !== 1 ? 's' : ''}`,
        'cat-budgets-title': 'Category Limits',
        'cat-budget-add': '+ Add Limit',
        'cat-budget-no-limit': 'no limit',
        'keywords-title': 'Keyword → Category Mappings',
        'keyword-add': '+ Add Mapping',
        'keyword-placeholder': 'Keyword (e.g. grab, shopee)',
        'keyword-empty': 'No keyword mappings yet. Add one to help the bot categorize automatically.',
        'catmgr-title': 'Categories',
        'catmgr-add': '+ New Category',
        'catmgr-expense': 'Expense',
        'catmgr-income': 'Income',
        'catmgr-rename': 'Rename',
        'catmgr-delete': 'Delete',
        'catmgr-tx': (n) => `${n} tx`,
        'chpwd-title': 'Change Password',
        'chpwd-toggle': 'Change',
        'date-locale': 'en-GB',
    },
    vi: {
        'logo': 'Quản Lý Chi Tiêu',
        'chat-admin': 'Quản trị (tất cả)',
        'label-from': 'Từ', 'label-to': 'Đến',
        'btn-apply': 'Áp dụng', 'btn-clear': 'Xóa',
        'filter-today': 'Hôm nay', 'filter-week': 'Tuần này',
        'filter-month': 'Tháng này', 'filter-all': 'Tất cả',
        'tab-overview': ' Tổng quan', 'tab-analytics': ' Phân tích',
        'tab-contributors': ' Đóng góp', 'tab-monthly': ' Hàng tháng',
        'card-income': 'Thu nhập', 'card-expenses': 'Chi tiêu', 'card-balance': 'Số dư',
        'limit-label': 'Giới hạn chi tiêu tháng', 'limit-edit': 'Sửa', 'limit-remove': 'Xóa',
        'limit-unset': 'Chưa đặt giới hạn chi tiêu', 'limit-set': 'Đặt giới hạn',
        'limit-save': 'Lưu', 'limit-cancel': 'Hủy',
        'limit-placeholder': 'Số tiền ₫ vd: 10000000',
        'chart-category': 'Chi tiêu theo danh mục', 'chart-trends': 'Xu hướng theo tháng',
        'tx-title': 'Giao dịch gần đây',
        'search-placeholder': 'Tìm theo mô tả, danh mục, người đóng góp…',
        'th-date': 'Ngày', 'th-category': 'Danh mục', 'th-description': 'Mô tả',
        'th-contributor': 'Người đóng góp', 'th-user': 'Người dùng', 'th-amount': 'Số tiền',
        'btn-load-more': 'Xem thêm',
        'chart-yearly': 'Tổng kết năm', 'stat-this-year': 'Năm nay', 'stat-last-year': 'Năm ngoái',
        'chart-income-contrib': 'Thu nhập theo người đóng góp', 'chart-user-spending': 'Chi tiêu theo người dùng',
        'breakdown-income': '💰 Người đóng góp', 'breakdown-spending': '💸 Chi tiêu người dùng',
        'monthly-overview': 'Tổng quan hàng tháng', 'monthly-breakdown': 'Phân tích từng tháng',
        'th-month': 'Tháng', 'th-savings-rate': 'Tỷ lệ tiết kiệm',
        'modal-title': 'Sửa giao dịch', 'modal-label-date': 'Ngày', 'modal-label-type': 'Loại',
        'modal-opt-expense': 'Chi tiêu', 'modal-opt-income': 'Thu nhập',
        'modal-label-category': 'Danh mục', 'modal-label-amount': 'Số tiền (₫)',
        'modal-label-desc': 'Mô tả', 'modal-label-contrib': 'Người đóng góp',
        'modal-category-placeholder': 'vd: ăn uống, di chuyển',
        'modal-desc-placeholder': 'Tùy chọn', 'modal-contrib-placeholder': 'Tùy chọn',
        'btn-delete': 'Xóa', 'btn-cancel': 'Hủy', 'btn-save-changes': 'Lưu thay đổi',
        'export-csv': '📄 Xuất CSV', 'export-xlsx': '📊 Xuất Excel',
        'footer-send': 'Gửi giao dịch qua Telegram:',
        'footer-examples': 'Ví dụ:',
        'stat-income': 'Thu nhập', 'stat-expenses': 'Chi tiêu',
        'stat-balance': 'Số dư', 'stat-transactions': 'Giao dịch',
        'monthly-total': (n) => `Tổng (${n} tháng)`,
        'tx-count': (n) => `${n} giao dịch`,
        'cat-budgets-title': 'Giới hạn danh mục',
        'cat-budget-add': '+ Thêm giới hạn',
        'cat-budget-no-limit': 'chưa đặt',
        'keywords-title': 'Ánh xạ từ khóa → danh mục',
        'keyword-add': '+ Thêm ánh xạ',
        'keyword-placeholder': 'Từ khóa (vd: grab, shopee)',
        'keyword-empty': 'Chưa có ánh xạ nào. Thêm để bot tự động phân loại.',
        'catmgr-title': 'Danh mục',
        'catmgr-add': '+ Danh mục mới',
        'catmgr-expense': 'Chi tiêu',
        'catmgr-income': 'Thu nhập',
        'catmgr-rename': 'Đổi tên',
        'catmgr-delete': 'Xóa',
        'catmgr-tx': (n) => `${n} GD`,
        'chpwd-title': 'Đổi mật khẩu',
        'chpwd-toggle': 'Đổi',
        'date-locale': 'vi-VN',
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key, ...args) {
    const val = (TRANSLATIONS[currentLang] || TRANSLATIONS.en)[key] ?? TRANSLATIONS.en[key] ?? key;
    return typeof val === 'function' ? val(...args) : val;
}

function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    const langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.textContent = currentLang === 'en' ? 'VI' : 'EN';
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyLang();
    loadAllData();
}

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
    return date.toLocaleDateString(t('date-locale'), {
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
            return new Date(year, month - 1).toLocaleDateString(t('date-locale'), { month: 'short', year: '2-digit' });
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
                        label: t('card-income'),
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6,
                        borderSkipped: false
                    },
                    {
                        label: t('card-expenses'),
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
            document.getElementById('transactionCount').textContent = t('tx-count', 0);
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
                <td><button class="edit-btn" title="Edit" data-t='${JSON.stringify(t).replace(/'/g, "&#39;")}'>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button></td>
            `;
            tbody.appendChild(row);
        });

        transactionOffset += transactions.length;

        // Update count
        const totalRows = tbody.querySelectorAll('tr').length;
        document.getElementById('transactionCount').textContent = t('tx-count', totalRows);

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
                        label: t('card-income'),
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: t('card-expenses'),
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
        const buildStatsHtml = (inc, exp) => `
            <div class="stat-row">
                <span class="stat-label">${t('stat-income')}</span>
                <span class="stat-value" style="color: var(--accent-income)">${formatAmount(inc?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${t('stat-expenses')}</span>
                <span class="stat-value" style="color: var(--accent-expense)">${formatAmount(exp?.total || 0)} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${t('stat-balance')}</span>
                <span class="stat-value">${formatAmount((inc?.total || 0) - (exp?.total || 0))} ₫</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${t('stat-transactions')}</span>
                <span class="stat-value">${(inc?.count || 0) + (exp?.count || 0)}</span>
            </div>
        `;
        thisYearStats.innerHTML = buildStatsHtml(thisYearIncome, thisYearExpenses);

        // Last year stats
        const lastYearIncome = data.find(d => d.year === lastYear && d.category_type === 'income');
        const lastYearExpenses = data.find(d => d.year === lastYear && d.category_type === 'expense');

        const lastYearStats = document.getElementById('lastYearStats');
        lastYearStats.innerHTML = buildStatsHtml(lastYearIncome, lastYearExpenses);
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
                        label: t('card-income'),
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 6
                    },
                    {
                        label: t('card-expenses'),
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

    // Apply saved language
    applyLang();
    document.getElementById('langToggle').addEventListener('click', () => {
        setLang(currentLang === 'en' ? 'vi' : 'en');
    });

    // Load session info for header
    fetch('/api/auth/status').then(r => r.json()).then(s => {
        const el = document.getElementById('chatInfo');
        const txt = document.getElementById('chatInfoText');
        if (s.authenticated && s.telegramChatId) {
            txt.textContent = s.chatTitle ? s.chatTitle : `Chat ${s.telegramChatId}`;
            el.style.display = 'flex';
        } else if (s.authenticated && s.isAdmin) {
            txt.textContent = t('chat-admin');
            el.style.display = 'flex';
        }
        wireUserMenu(s.username);
        if (s.isAdmin) {
            document.getElementById('mainTabs').style.display = 'none';
            document.getElementById('mainTabsContent').style.display = 'none';
            document.getElementById('adminOverview').style.display = 'block';
            loadAdminOverview();
        }
    }).catch(() => { wireUserMenu(''); });

    // Load category budgets
    loadCategoryBudgets();
    wireCategoryBudgetUI();

    // Load keyword mappings
    loadKeywords();
    wireKeywordUI();

    // Load category manager
    loadCategoryManager();
    wireCategoryManagerUI();

    // Change password modal
    wireChangePasswordUI();

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


// ─── Category Budgets ─────────────────────────────────────────────────────────
let catBudgetData = [];

async function loadCategoryBudgets() {
    try {
        const data = await fetchAPI('/cat-budgets');
        catBudgetData = data;
        renderCategoryBudgets(data);
    } catch (e) {
        console.error('Failed to load category budgets:', e);
    }
}

function renderCategoryBudgets(items) {
    const section = document.getElementById('catBudgetsSection');
    const list = document.getElementById('catBudgetList');

    const withLimits = items.filter(i => i.limit !== null);
    if (withLimits.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    list.innerHTML = withLimits.map(item => {
        const pct = Math.min(item.percent || 0, 100);
        const fillClass = item.percent >= 100 ? 'over' : item.percent >= 80 ? 'warn' : '';
        return `
        <div class="cat-budget-item">
            <span class="cat-budget-name">${item.category}</span>
            <div class="cat-budget-bar-wrap">
                <div class="cat-budget-bar-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <span class="cat-budget-amounts">${formatAmount(item.spent)} / ${formatAmount(item.limit)} ₫ ${item.percent !== null ? `(${item.percent}%)` : ''}</span>
            <button class="cat-budget-remove" data-cat="${item.category}" title="Remove">✕</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.cat-budget-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
            await fetchAPI(`/cat-budgets/${btn.dataset.cat}`, { method: 'DELETE' });
            loadCategoryBudgets();
        });
    });
}

function wireCategoryBudgetUI() {
    const addBtn = document.getElementById('catBudgetAddBtn');
    const form = document.getElementById('catBudgetAddForm');
    const saveBtn = document.getElementById('catBudgetSaveBtn');
    const cancelBtn = document.getElementById('catBudgetCancelBtn');
    const select = document.getElementById('catBudgetSelect');
    const amountInput = document.getElementById('catBudgetAmount');

    addBtn.addEventListener('click', async () => {
        // Populate select with categories that don't have a budget yet
        const all = await fetchAPI('/cat-budgets');
        const unbucketed = all.filter(i => i.limit === null && i.spent > 0);
        const bucketed = all.filter(i => i.limit !== null).map(i => i.category);

        select.innerHTML = unbucketed.map(i =>
            `<option value="${i.category}">${i.category}</option>`
        ).join('');

        if (unbucketed.length === 0) {
            select.innerHTML = '<option value="" disabled>All categories have limits</option>';
        }

        document.getElementById('catBudgetsSection').style.display = 'block';
        form.style.display = 'flex';
        amountInput.value = '';
        amountInput.focus();
    });

    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

    saveBtn.addEventListener('click', async () => {
        const category = select.value;
        const amount = parseInt(amountInput.value);
        if (!category || !amount || amount <= 0) return;
        await fetchAPI('/cat-budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, amount }) });
        form.style.display = 'none';
        loadCategoryBudgets();
    });
}

// ─── Keyword Mappings ─────────────────────────────────────────────────────────
async function loadKeywords() {
    try {
        const data = await fetchAPI('/keywords');
        renderKeywords(data);
    } catch (e) {}
}

function renderKeywords(items) {
    const section = document.getElementById('keywordsSection');
    const list = document.getElementById('keywordList');

    if (items.length === 0) {
        section.style.display = 'block';
        list.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">${t('keyword-empty')}</p>`;
        return;
    }

    section.style.display = 'block';
    list.innerHTML = items.map(item => `
        <div class="cat-budget-item">
            <span class="cat-budget-name"><code>${item.keyword}</code> → ${item.category}</span>
            <button class="cat-budget-remove keyword-remove" data-kw="${item.keyword}" title="Remove">✕</button>
        </div>
    `).join('');

    list.querySelectorAll('.keyword-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
            await fetchAPI(`/keywords/${encodeURIComponent(btn.dataset.kw)}`, { method: 'DELETE' });
            loadKeywords();
        });
    });
}

function wireKeywordUI() {
    const addBtn = document.getElementById('keywordAddBtn');
    const form = document.getElementById('keywordAddForm');
    const saveBtn = document.getElementById('keywordSaveBtn');
    const cancelBtn = document.getElementById('keywordCancelBtn');
    const keywordInput = document.getElementById('keywordInput');
    const categorySelect = document.getElementById('keywordCategorySelect');

    addBtn.addEventListener('click', async () => {
        // Populate category select from available categories
        try {
            const cats = await fetchAPI('/categories/list');
            const expenseCats = cats.filter(c => c.type === 'expense');
            categorySelect.innerHTML = expenseCats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        } catch (e) {}

        document.getElementById('keywordsSection').style.display = 'block';
        form.style.display = 'flex';
        keywordInput.value = '';
        keywordInput.focus();
    });

    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

    saveBtn.addEventListener('click', async () => {
        const keyword = keywordInput.value.trim().toLowerCase();
        const category = categorySelect.value;
        if (!keyword || !category) return;
        await fetchAPI('/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword, category }) });
        form.style.display = 'none';
        loadKeywords();
    });
}

// ─── Category Manager ─────────────────────────────────────────────────────────
let catMgrRenameTarget = null;

async function loadCategoryManager() {
    try {
        const cats = await fetchAPI('/categories/list');
        renderCategoryManager(cats);
    } catch (e) {}
}

function renderCategoryManager(cats) {
    const list = document.getElementById('catMgrList');
    if (cats.length === 0) {
        list.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">No categories yet.</p>`;
        return;
    }

    const expense = cats.filter(c => c.type === 'expense');
    const income = cats.filter(c => c.type === 'income');

    const renderGroup = (items, label) => {
        if (!items.length) return '';
        return `<div style="margin-bottom:0.75rem">
            <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.35rem">${label}</div>
            ${items.map(c => `
                <div class="cat-budget-item">
                    <span class="cat-budget-name">${c.name} <span style="color:var(--text-muted);font-size:0.78rem">(${t('catmgr-tx')(c.tx_count)})</span></span>
                    <span style="display:flex;gap:0.35rem">
                        <button class="cat-budget-remove catmgr-rename-btn" data-name="${c.name}" style="background:none;border:1px solid var(--border-color);color:var(--text-secondary);padding:2px 8px;border-radius:4px;font-size:0.78rem;cursor:pointer" data-i18n="catmgr-rename">${t('catmgr-rename')}</button>
                        <button class="cat-budget-remove catmgr-delete-btn" data-name="${c.name}" data-count="${c.tx_count}" title="${c.tx_count > 0 ? 'Merge first to delete' : 'Delete'}" ${c.tx_count > 0 ? 'disabled style="opacity:0.35;cursor:not-allowed"' : ''}>✕</button>
                    </span>
                </div>`).join('')}
        </div>`;
    };

    list.innerHTML = renderGroup(expense, t('catmgr-expense')) + renderGroup(income, t('catmgr-income'));

    list.querySelectorAll('.catmgr-rename-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            catMgrRenameTarget = btn.dataset.name;
            document.getElementById('catMgrRenameLabel').textContent = `Rename "${catMgrRenameTarget}" →`;
            document.getElementById('catMgrRenameInput').value = catMgrRenameTarget;
            document.getElementById('catMgrRenameForm').style.display = 'flex';
            document.getElementById('catMgrRenameInput').focus();
        });
    });

    list.querySelectorAll('.catmgr-delete-btn').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', async () => {
            if (!confirm(`Delete category "${btn.dataset.name}"?`)) return;
            const res = await fetchAPI(`/categories/${encodeURIComponent(btn.dataset.name)}`, { method: 'DELETE' });
            if (res.error) { alert(res.error); return; }
            loadCategoryManager();
        });
    });
}

function wireCategoryManagerUI() {
    const addBtn = document.getElementById('catMgrAddBtn');
    const form = document.getElementById('catMgrAddForm');
    const saveBtn = document.getElementById('catMgrSaveBtn');
    const cancelBtn = document.getElementById('catMgrCancelBtn');
    const nameInput = document.getElementById('catMgrNameInput');

    addBtn.addEventListener('click', () => {
        form.style.display = 'flex';
        nameInput.value = '';
        nameInput.focus();
        document.getElementById('catMgrRenameForm').style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const type = document.getElementById('catMgrTypeSelect').value;
        if (!name) return;
        await fetchAPI('/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) });
        form.style.display = 'none';
        loadCategoryManager();
    });

    document.getElementById('catMgrRenameCancelBtn').addEventListener('click', () => {
        document.getElementById('catMgrRenameForm').style.display = 'none';
    });

    document.getElementById('catMgrRenameSaveBtn').addEventListener('click', async () => {
        const newName = document.getElementById('catMgrRenameInput').value.trim();
        if (!newName || !catMgrRenameTarget || newName === catMgrRenameTarget) {
            document.getElementById('catMgrRenameForm').style.display = 'none';
            return;
        }
        const res = await fetchAPI('/categories/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: catMgrRenameTarget, to: newName }) });
        if (res.error) { alert(res.error); return; }
        document.getElementById('catMgrRenameForm').style.display = 'none';
        catMgrRenameTarget = null;
        loadCategoryManager();
    });
}

// ─── User Menu (logout + change password) ────────────────────────────────────
function wireUserMenu(username) {
    const menuBtn = document.getElementById('userMenuBtn');
    const menu = document.getElementById('userMenu');
    document.getElementById('userMenuName').textContent = username || '';

    // Toggle menu
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });
    document.addEventListener('click', () => menu.classList.remove('show'));

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });

    // Open change password modal
    document.getElementById('changePasswordMenuBtn').addEventListener('click', () => {
        menu.classList.remove('show');
        openChangePasswordModal();
    });
}

function openChangePasswordModal() {
    const modal = document.getElementById('chPwdModal');
    document.getElementById('chPwdCurrent').value = '';
    document.getElementById('chPwdNew').value = '';
    document.getElementById('chPwdConfirm').value = '';
    document.getElementById('chPwdError').style.display = 'none';
    document.getElementById('chPwdSuccess').style.display = 'none';
    modal.style.display = 'flex';
    document.getElementById('chPwdCurrent').focus();
}

function wireChangePasswordUI() {
    const modal = document.getElementById('chPwdModal');
    const errorEl = document.getElementById('chPwdError');
    const successEl = document.getElementById('chPwdSuccess');

    document.getElementById('chPwdCancelBtn').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('chPwdSaveBtn').addEventListener('click', async () => {
        const currentPassword = document.getElementById('chPwdCurrent').value;
        const newPassword = document.getElementById('chPwdNew').value;
        const confirm = document.getElementById('chPwdConfirm').value;
        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!currentPassword || !newPassword || !confirm) {
            errorEl.textContent = 'All fields are required.'; errorEl.style.display = 'block'; return;
        }
        if (newPassword.length < 6) {
            errorEl.textContent = 'New password must be at least 6 characters.'; errorEl.style.display = 'block'; return;
        }
        if (newPassword !== confirm) {
            errorEl.textContent = 'New passwords do not match.'; errorEl.style.display = 'block'; return;
        }

        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            successEl.textContent = 'Password changed successfully.';
            successEl.style.display = 'block';
            document.getElementById('chPwdCurrent').value = '';
            document.getElementById('chPwdNew').value = '';
            document.getElementById('chPwdConfirm').value = '';
            setTimeout(() => { modal.style.display = 'none'; }, 1500);
        } else {
            errorEl.textContent = data.error || 'Failed to change password.';
            errorEl.style.display = 'block';
        }
    });
}

// ─── Admin Overview ───────────────────────────────────────────────────────────
async function loadAdminOverview() {
    try {
        const d = await fetchAPI('/admin/overview');
        document.getElementById('adminTotalUsers').textContent = d.users;
        document.getElementById('adminTotalTx').textContent = d.transactions.toLocaleString();
        document.getElementById('adminTotalIncome').textContent = formatAmount(d.income) + ' ₫';
        document.getElementById('adminTotalExpenses').textContent = formatAmount(d.expenses) + ' ₫';
    } catch (e) {}
}

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
            return new Date(yr, mo - 1).toLocaleDateString(t('date-locale'), { month: 'short', year: '2-digit' });
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
                    { label: t('card-income'),   data: chartIncome,   borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: false, pointRadius: 3 },
                    { label: t('card-expenses'), data: chartExpenses, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)',  tension: 0.3, fill: false, pointRadius: 3 },
                    { label: t('card-balance'),  data: chartBalance,  borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', tension: 0.3, fill: true,  pointRadius: 3 }
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
            const label = new Date(yr, mo - 1).toLocaleDateString(t('date-locale'), { month: 'long', year: 'numeric' });

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
            '<td>' + t('monthly-total', rows.length) + '</td>' +
            '<td class="text-right" style="color:var(--accent-income)">' + formatAmount(totIncome) + ' ₫</td>' +
            '<td class="text-right" style="color:var(--accent-expense)">' + formatAmount(totExpenses) + ' ₫</td>' +
            '<td class="text-right ' + (totBal >= 0 ? 'positive' : 'negative') + '">' + formatAmount(totBal) + ' ₫</td>' +
            '<td class="text-right"><span class="savings-badge ' + (totRate !== null ? (totRate >= 0 ? 'good' : 'bad') : 'zero') + '">' + (totRate !== null ? totRate + '%' : 'N/A') + '</span></td>' +
            '</tr>';

    } catch (err) {
        console.error('Error loading monthly tab:', err);
    }
}

/* ===================================
   Edit Modal
   =================================== */

function openEditModal(t) {
    document.getElementById('editId').value = t.id;
    document.getElementById('editDate').value = t.created_at.slice(0, 10);
    document.getElementById('editType').value = t.category_type;
    document.getElementById('editCategory').value = t.category;
    document.getElementById('editAmount').value = t.amount;
    document.getElementById('editDescription').value = t.description || '';
    document.getElementById('editContributor').value = t.contributor || '';
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function saveEdit() {
    const id = document.getElementById('editId').value;
    const body = {
        amount: parseInt(document.getElementById('editAmount').value),
        categoryName: document.getElementById('editCategory').value.trim().toLowerCase(),
        categoryType: document.getElementById('editType').value,
        description: document.getElementById('editDescription').value.trim() || null,
        contributor: document.getElementById('editContributor').value.trim() || null,
        date: document.getElementById('editDate').value,
    };
    if (!body.amount || !body.categoryName || !body.date) return;

    const btn = document.getElementById('editSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed');
        closeEditModal();
        loadAllData();
    } catch (e) {
        console.error('Save failed:', e);
        btn.textContent = 'Save Changes';
        btn.disabled = false;
    }
}

async function deleteEditTransaction() {
    const id = document.getElementById('editId').value;
    if (!confirm('Delete this transaction?')) return;

    const btn = document.getElementById('editDeleteBtn');
    btn.disabled = true;

    try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        closeEditModal();
        loadAllData();
    } catch (e) {
        console.error('Delete failed:', e);
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('editSaveBtn').addEventListener('click', saveEdit);
    document.getElementById('editDeleteBtn').addEventListener('click', deleteEditTransaction);
    document.getElementById('modalClose').addEventListener('click', closeEditModal);
    document.getElementById('modalCancel').addEventListener('click', closeEditModal);
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });
    document.getElementById('transactionsBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-btn');
        if (!btn) return;
        const t = JSON.parse(btn.dataset.t);
        openEditModal(t);
    });
});

/* ===================================
   Spending Limit UI
   =================================== */

async function loadSpendingLimit() {
    try {
        const data = await fetchAPI('/alert');
        renderLimitUI(data.threshold);
    } catch (e) {
        // Non-critical — hide limit section silently
        document.getElementById('limitBar').style.display = 'none';
        document.getElementById('limitUnset').style.display = 'none';
    }
}

function renderLimitUI(threshold) {
    const bar = document.getElementById('limitBar');
    const unset = document.getElementById('limitUnset');
    const form = document.getElementById('limitForm');
    form.style.display = 'none';
    if (threshold) {
        document.getElementById('limitValue').textContent = formatAmount(threshold) + ' ₫';
        bar.style.display = 'flex';
        unset.style.display = 'none';
    } else {
        bar.style.display = 'none';
        unset.style.display = 'flex';
    }
}

function showLimitForm(currentValue) {
    document.getElementById('limitBar').style.display = 'none';
    document.getElementById('limitUnset').style.display = 'none';
    const form = document.getElementById('limitForm');
    form.style.display = 'flex';
    const input = document.getElementById('limitInput');
    input.value = currentValue || '';
    input.focus();
}

async function saveSpendingLimit() {
    const val = document.getElementById('limitInput').value.trim();
    const threshold = val ? parseInt(val) : null;
    if (threshold !== null && (isNaN(threshold) || threshold <= 0)) return;
    try {
        await fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold }),
        });
        renderLimitUI(threshold);
    } catch (e) { console.error('Failed to save limit:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSpendingLimit();

    let currentThreshold = null;

    document.getElementById('limitEditBtn').addEventListener('click', () => {
        const val = document.getElementById('limitValue').textContent.replace(/[^0-9]/g, '');
        showLimitForm(val);
    });
    document.getElementById('limitSetBtn').addEventListener('click', () => showLimitForm(null));
    document.getElementById('limitCancelBtn').addEventListener('click', () => loadSpendingLimit());
    document.getElementById('limitRemoveBtn').addEventListener('click', async () => {
        if (!confirm('Remove spending limit?')) return;
        await fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threshold: null }),
        });
        renderLimitUI(null);
    });
    document.getElementById('limitSaveBtn').addEventListener('click', saveSpendingLimit);
    document.getElementById('limitInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveSpendingLimit();
        if (e.key === 'Escape') loadSpendingLimit();
    });
});
