/**
 * KirokuHub - Unified Version
 * Features: Pagination, Custom Pricing, Auto-Sync, Light Mode Fix
 */

const firebaseConfig = {
    apiKey: "AIzaSyAAk2hfkIpIwFyg8BG9XAYx98OGCBn1yds",
    authDomain: "kirokuhub.firebaseapp.com",
    projectId: "kirokuhub",
    storageBucket: "kirokuhub.firebasestorage.app",
    messagingSenderId: "470629468332",
    appId: "1:470629468332:web:0a11ef8c0158ce32d1b709"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial State
    const state = {
        transactions: [],
        inventory: [],
        pagination: { inventory: 1, finance: 1 },
        settings: {
            language: 'en',
            currency: 'MYR',
            theme: 'dark',
            glassOpacity: 0.8,
            gradient: 'ocean'
        }
    };

    const translations = {
        en: {
            'nav-dashboard': 'Dashboard',
            'nav-inventory': 'Inventory',
            'nav-finance': 'Finance',
            'nav-settings': 'Settings',
            'total-profit': 'Total Profit',
            'total-expense': 'Total Expense',
            'low-stock': 'Low Stock',
            'inventory-count': 'Inventory Items',
            'recent-activity': 'Recent Activity',
            'settings-profile': 'User Profile',
            'settings-localization': 'Localization',
            'settings-appearance': 'Appearance',
            'settings-data': 'Data Center',
            'label-name': 'Display Name',
            'label-password': 'New Password',
            'label-lang': 'System Language',
            'label-currency': 'Currency',
            'label-theme': 'Theme Mode',
            'label-glass': 'Glass Depth',
            'btn-update': 'Update Profile',
            'btn-export': 'Export Backup',
            'btn-import': 'Import Backup',
            'theme-dark': 'Dark Mode',
            'theme-light': 'Light Mode',
            'theme-system': 'System Default',
            'search-placeholder': 'Search SKU or Product...',
            'add-product': 'Add Product',
            'add-sale': 'Record Sale',
            'no-data': 'No data available.',
            'confirm-delete': 'Are you sure you want to delete this?',
            'sku': 'SKU', 'product': 'Product', 'stock': 'Stock', 'price': 'Price', 'action': 'Action', 'date': 'Date', 'amount': 'Amount', 'desc': 'Description', 'cost': 'Cost', 'profit': 'Profit'
        },
        cn: {
            'nav-dashboard': '仪表盘',
            'nav-inventory': '库存管理',
            'nav-finance': '财务报表',
            'nav-settings': '系统设置',
            'total-profit': '总利润',
            'total-expense': '总支出',
            'low-stock': '低库存预警',
            'inventory-count': '产品种类',
            'recent-activity': '最近活动',
            'settings-profile': '个人资料',
            'settings-localization': '语言与货币',
            'settings-appearance': '界面外观',
            'settings-data': '数据中心',
            'label-name': '显示名称',
            'label-password': '修改密码',
            'label-lang': '系统语言',
            'label-currency': '货币单位',
            'label-theme': '主题模式',
            'label-glass': '毛玻璃深度',
            'btn-update': '更新资料',
            'btn-export': '导出备份',
            'btn-import': '导入数据',
            'theme-dark': '深色模式',
            'theme-light': '浅色模式',
            'theme-system': '跟随系统',
            'search-placeholder': '搜SKU或产品名...',
            'add-product': '添加产品',
            'add-sale': '记录销售',
            'no-data': '暂无数据',
            'confirm-delete': '确定要删除这条记录吗？',
            'sku': 'SKU', 'product': '产品', 'stock': '库存', 'price': '单价', 'action': '操作', 'date': '日期', 'amount': '金额', 'desc': '描述', 'cost': '成本', 'profit': '利润'
        }
    };

    let currentUser = null;
    let isLoginMode = true;
    let currentFilterType = 'profit';

    // 2. Helper Functions
    function t(key) {
        return translations[state.settings.language][key] || key;
    }

    function formatCurrency(amount) {
        return `${state.settings.currency} ${parseFloat(amount || 0).toFixed(2)}`;
    }

    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '-';
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateStr;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
        }
        return dateStr;
    }

    function updateI18nUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.innerText = t(key);
        });
        const si = document.getElementById('search-input');
        if (si) si.placeholder = t('search-placeholder');
    }

    function applyTheme(theme) {
        document.body.classList.remove('light-mode');
        if (theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
            document.body.classList.add('light-mode');
        }
    }

    function applyGlass(val) {
        document.documentElement.style.setProperty('--glass-opacity', val);
    }

    function applyGradient(gradient) {
        const gradients = {
            'ocean': 'linear-gradient(135deg, #1e3a8a 0%, #020617 100%)',
            'sunset': 'linear-gradient(135deg, #f97316 0%, #581c87 100%)',
            'forest': 'linear-gradient(135deg, #064e3b 0%, #020617 100%)',
            'purple': 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)',
            'cherry': 'linear-gradient(135deg, #ec4899 0%, #581c87 100%)',
            'midnight': 'linear-gradient(135deg, #1e40af 0%, #020617 100%)'
        };
        document.body.style.background = gradients[gradient] || gradients['ocean'];
    }

    async function saveData() {
        if (!currentUser) return;
        try {
            await db.collection('users').doc(currentUser.uid).set({
                inventory: state.inventory,
                transactions: state.transactions,
                settings: state.settings
            });
        } catch (e) { console.error("Save error:", e); }
    }

    async function loadUserData() {
        if (!currentUser) return;
        try {
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                state.inventory = data.inventory || [];
                state.transactions = data.transactions || [];
                if (data.settings) state.settings = { ...state.settings, ...data.settings };
            }
        } catch (e) { console.error("Load error:", e); }
    }


    // --- AUTHENTICATION LOGIC ---
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPass = document.getElementById('auth-password');
    const authBtn = document.getElementById('auth-btn');
    const authError = document.getElementById('auth-error');
    const googleBtn = document.getElementById('google-btn');
    const switchAuth = document.getElementById('switch-auth');
    const authSubtitle = document.getElementById('auth-subtitle');

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = authEmail.value;
            const pass = authPass.value;
            authError.classList.add('hidden');
            authBtn.disabled = true;
            authBtn.innerText = 'Processing...';
            try {
                if (isLoginMode) {
                    await auth.signInWithEmailAndPassword(email, pass);
                } else {
                    const cred = await auth.createUserWithEmailAndPassword(email, pass);
                    await db.collection('users').doc(cred.user.uid).set(state);
                }
            } catch (error) {
                authError.innerText = error.message;
                authError.classList.remove('hidden');
                authBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
                authBtn.disabled = false;
            }
        });
    }

    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try { await auth.signInWithPopup(provider); }
            catch (error) { authError.innerText = error.message; authError.classList.remove('hidden'); }
        });
    }

    if (switchAuth) {
        switchAuth.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            authBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
            authSubtitle.innerText = isLoginMode ? 'Welcome back! Please login.' : 'Create a new account.';
            switchAuth.innerText = isLoginMode ? 'Sign Up' : 'Login';
            authError.classList.add('hidden');
        });
    }


    // 3. Render Dashboard (Fixed Chart)
    function renderDashboard() {
        const area = document.getElementById('content-area');
        if (!area) return;

        let p = 0;
        state.transactions.forEach(t => { if (t.type === 'profit') p += t.amount; });
        let e = 0;
        state.inventory.forEach(i => {
            const soldQty = state.transactions.filter(t => t.sku === i.sku && t.type === 'profit').reduce((s, t) => s + (t.qty || 0), 0);
            e += (parseFloat(i.cost || 0) * (parseFloat(i.stock || 0) + soldQty));
        });

        const uniqueItems = new Set(state.inventory.map(i => i.name)).size;

        const chartData = {};
        state.transactions.forEach(t => {
            if (!t.date) return;
            const parts = t.date.split('/');
            if (parts.length !== 3) return;
            const key = `${parts[2]}-${parts[1]}`; // YYYY-MM
            const label = `${parts[1]}/${parts[2]}`; // MM/YYYY

            if (!chartData[key]) chartData[key] = { p: 0, e: 0, label: label, sortKey: key };

            if (t.type === 'profit') chartData[key].p += t.amount;
            else if (t.type === 'stock-in') chartData[key].e += t.amount;
        });

        const sortedKeys = Object.keys(chartData).sort();

        area.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card ocean-gradient">
                    <div class="stat-info"><h3 data-i18n="total-profit">${t('total-profit')}</h3><p class="value">${formatCurrency(p)}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('profit')"><i data-lucide="wallet"></i></div>
                </div>
                <div class="stat-card sunset-gradient">
                    <div class="stat-info"><h3 data-i18n="total-expense">${t('total-expense')}</h3><p class="value">${formatCurrency(e)}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('expense')"><i data-lucide="credit-card"></i></div>
                </div>
                <div class="stat-card berry-gradient">
                    <div class="stat-info"><h3 data-i18n="low-stock">${t('low-stock')}</h3><p class="value">${state.inventory.filter(i => i.stock < 5).length}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('low-stock')"><i data-lucide="package"></i></div>
                </div>
                <div class="stat-card forest-gradient">
                    <div class="stat-info"><h3 data-i18n="inventory-count">${t('inventory-count')}</h3><p class="value">${uniqueItems}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('inventory-summary')"><i data-lucide="database"></i></div>
                </div>
            </div>
            <div class="chart-section glass-card mb-2">
                <h2 data-i18n="recent-activity">📊 ${t('recent-activity')}</h2>
                <div class="chart-container"><canvas id="mainChart"></canvas></div>
            </div>
            <div class="glass-card">
                <h2 data-i18n="recent-activity" class="mb-1">${t('recent-activity')}</h2>
                <table class="data-table">
                    <thead><tr><th data-i18n="date">${t('date')}</th><th data-i18n="desc">${t('desc')}</th><th data-i18n="amount">${t('amount')}</th><th data-i18n="action">${t('action')}</th></tr></thead>
                    <tbody>
                        ${state.transactions.slice(0, 10).map((item, idx) => `
                            <tr>
                                <td>${item.date}</td><td>${item.desc}</td>
                                <td style="color:${item.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">
                                    ${item.type === 'profit' ? '+' : '-'} ${formatCurrency(item.amount)}
                                </td>
                                <td><button class="btn-xs" onclick="window.activeApp.deleteTransaction(${idx})">×</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const ctx = document.getElementById('mainChart');
        if (ctx) {
            const chartTextColor = state.settings.theme === 'light' ? '#333' : '#ccc';
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedKeys.map(k => chartData[k].label),
                    datasets: [
                        { label: t('total-profit'), data: sortedKeys.map(k => chartData[k].p), backgroundColor: '#10b981', borderRadius: 4 },
                        { label: t('total-expense'), data: sortedKeys.map(k => chartData[k].e), backgroundColor: '#ef4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: chartTextColor } } },
                    scales: { x: { ticks: { color: chartTextColor } }, y: { ticks: { color: chartTextColor } } }
                }
            });
        }
        lucide.createIcons();
    }

    // 4. Render Inventory
    function renderInventory() {
        const area = document.getElementById('content-area');
        const today = new Date().toISOString().split('T')[0];

        // Paginaton Setup
        const itemsPerPage = 10;
        const totalPages = Math.ceil(state.inventory.length / itemsPerPage) || 1;
        if (state.pagination.inventory > totalPages) state.pagination.inventory = totalPages;
        const start = (state.pagination.inventory - 1) * itemsPerPage;
        const currentData = state.inventory.slice(start, start + itemsPerPage);

        area.innerHTML = `
            <div class="glass-card mb-2">
                <h2 data-i18n="add-product">${t('add-product')}</h2>
                <form id="add-item-form" class="automation-flex mt-2">
                    <input type="date" id="in-date" value="${today}" class="settings-input" style="max-width:140px">
                    <input type="text" id="in-sku" placeholder="${t('sku')}" required class="settings-input flex-grow">
                    <input type="text" id="in-name" placeholder="${t('product')}" required class="settings-input flex-grow">
                    <input type="number" id="in-stock" placeholder="${t('stock')}" class="settings-input" style="width:80px">
                    <div style="display:flex; gap:5px; align-items:center">
                        <input type="number" id="in-cost" placeholder="${t('cost')}" class="settings-input" style="width:80px">
                        <select id="in-cost-currency" class="settings-select" style="width:70px">
                            <option value="MYR">MYR</option>
                            <option value="CNY">CNY</option>
                            <option value="USD">USD</option>
                            <option value="PHP">PHP</option>
                            <option value="SGD">SGD</option>
                            <option value="IDR">IDR</option>
                            <option value="THB">THB</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                    <input type="number" id="in-price" placeholder="${t('price')}" class="settings-input" style="width:100px">
                    <input type="text" id="in-source" placeholder="Source" class="settings-input" style="width:120px">
                    <button class="btn-primary" data-i18n="add-product">${t('add-product')}</button>
                </form>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th data-i18n="date">${t('date')}</th><th data-i18n="sku">${t('sku')}</th><th data-i18n="product">${t('product')}</th><th data-i18n="stock">${t('stock')}</th><th data-i18n="cost">${t('cost')}</th><th data-i18n="price">${t('price')}</th><th>Source</th><th data-i18n="profit">${t('profit')}</th><th data-i18n="action">${t('action')}</th></tr></thead>
                    <tbody>
                        ${currentData.length === 0 ? `<tr><td colspan="9" align="center">${t('no-data')}</td></tr>` : ''}
                        ${currentData.map((item, idx) => {
            const realIdx = start + idx;
            const sourceDisplay = item.source && item.source.startsWith('http')
                ? `<a href="${item.source}" target="_blank" style="color:var(--primary)">Link</a>`
                : (item.source || '-');
            const copyBtn = item.source && item.source !== '-'
                ? `<button class="btn-xs" onclick="navigator.clipboard.writeText('${item.source.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'); alert('Copied!')" title="Copy" style="margin-left:5px">📋</button>`
                : '';
            return `<tr>
                                <td>${formatDateForDisplay(item.date)}</td>
                                <td>${item.sku}</td>
                                <td>${item.name}</td>
                                <td style="color:${item.stock < 5 ? 'var(--danger)' : 'inherit'}">${item.stock}</td>
                                <td>${formatCurrency(item.cost)}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td title="${item.source || '-'}">${sourceDisplay}${copyBtn}</td>
                                <td style="color:var(--success)">${formatCurrency(item.price - item.cost)}</td>
                                <td><button class="btn-secondary" onclick="window.activeApp.deleteItem(${realIdx})" data-i18n="action">Delete</button></td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
                <div class="pagination-controls mt-2" style="display:flex; justify-content:center; align-items:center; gap:15px;">
                    <button class="btn-secondary" onclick="window.activeApp.changePage('inventory', -1)" ${state.pagination.inventory === 1 ? 'disabled style="opacity:0.5"' : ''}>< Previous</button>
                    <span style="font-size:0.9rem; opacity:0.8">Page ${state.pagination.inventory} of ${totalPages}</span>
                    <button class="btn-secondary" onclick="window.activeApp.changePage('inventory', 1)" ${state.pagination.inventory === totalPages ? 'disabled style="opacity:0.5"' : ''}>Next ></button>
                </div>
            </div>
        `;

        // Auto-fill Listener for Inventory
        setTimeout(() => {
            const skuIn = document.getElementById('in-sku');
            if (skuIn) {
                skuIn.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    const found = state.inventory.slice().reverse().find(i => i.sku === val);
                    if (found) {
                        document.getElementById('in-name').value = found.name;
                        document.getElementById('in-cost').value = found.cost;
                        document.getElementById('in-price').value = found.price;
                        document.getElementById('in-source').value = found.source || '';
                    }
                });
            }
        }, 100);

        document.getElementById('add-item-form').onsubmit = async (e) => {
            e.preventDefault();
            const dateVal = document.getElementById('in-date').value;
            const sku = document.getElementById('in-sku').value;
            const name = document.getElementById('in-name').value;
            const source = document.getElementById('in-source').value || '-';
            const stock = parseInt(document.getElementById('in-stock').value) || 0;
            let cost = parseFloat(document.getElementById('in-cost').value) || 0;
            const costCurrency = document.getElementById('in-cost-currency').value;
            const price = parseFloat(document.getElementById('in-price').value) || 0;

            // Exchange rates to MYR (approximate)
            const exchangeRates = {
                'MYR': 1,
                'CNY': 0.65,
                'USD': 4.47,
                'PHP': 0.08,
                'SGD': 3.30,
                'IDR': 0.00028,
                'THB': 0.13,
                'EUR': 4.80
            };

            // Convert cost to MYR
            if (costCurrency !== 'MYR' && exchangeRates[costCurrency]) {
                cost = cost * exchangeRates[costCurrency];
            }

            const dParts = dateVal.split('-');
            const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
            state.inventory.unshift({ sku, name, source, stock, cost: parseFloat(cost.toFixed(2)), price, date: formattedDate });
            state.transactions.unshift({
                id: Date.now(), date: formattedDate,
                sku, desc: `Initial: ${name}`, qty: stock, type: 'stock-in', amount: (cost * stock), category: 'Stock'
            });
            await saveData(); renderInventory();
        };
        lucide.createIcons();
    }

    // 5. Render Finance
    function renderFinance() {
        const area = document.getElementById('content-area');
        const sales = state.transactions.filter(t => t.type === 'profit');
        const today = new Date().toISOString().split('T')[0];

        const itemsPerPage = 10;
        const totalPages = Math.ceil(sales.length / itemsPerPage) || 1;
        if (state.pagination.finance > totalPages) state.pagination.finance = totalPages;
        const start = (state.pagination.finance - 1) * itemsPerPage;
        const currentData = sales.slice(start, start + itemsPerPage);

        area.innerHTML = `
            <div class="glass-card mb-2">
                <h2 data-i18n="add-sale">${t('add-sale')}</h2>
                <form id="add-sale-form" class="automation-flex mt-2">
                    <input type="date" id="s-date" value="${today}" class="settings-input" style="max-width:140px">
                    <select id="s-sku" class="flex-grow settings-select" style="max-width:300px">
                        <option value="">Select SKU</option>
                        ${state.inventory.map(i => `<option value="${i.sku}">${i.sku} - ${i.name} (Stock: ${i.stock})</option>`).join('')}
                    </select>
                    <input type="number" id="s-price" placeholder="Price" class="settings-input" style="width:100px">
                    <input type="number" id="s-qty" placeholder="Qty" class="settings-input" style="width:80px">
                    <select id="s-channel" class="settings-select" style="width:120px" onchange="document.getElementById('s-channel-other').style.display = this.value === 'Other' ? 'block' : 'none'">
                        <option value="Shopee">Shopee</option>
                        <option value="Lazada">Lazada</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Facebook">Facebook</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Offline">Offline</option>
                        <option value="Other">Other</option>
                    </select>
                    <input type="text" id="s-channel-other" placeholder="Channel name" class="settings-input" style="width:100px; display:none">
                    <button class="btn-primary" data-i18n="add-sale">${t('add-sale')}</button>
                </form>
            </div>
            <div class="glass-card">
                <table class="data-table">
                     <thead><tr><th data-i18n="date">${t('date')}</th><th data-i18n="desc">${t('desc')}</th><th>Channel</th><th data-i18n="amount">${t('amount')}</th><th data-i18n="action">${t('action')}</th></tr></thead>
                     <tbody>
                        ${currentData.length === 0 ? `<tr><td colspan="5" align="center">${t('no-data')}</td></tr>` : ''}
                        ${currentData.map((item) => {
            const realIdx = state.transactions.indexOf(item);
            return `<tr>
                                <td>${formatDateForDisplay(item.date)}</td>
                                <td>${item.desc}</td>
                                <td title="${item.channel || '-'}" style="max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${item.channel || '-'}</td>
                                <td style="color:var(--success)">+ ${formatCurrency(item.amount)}</td>
                                <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${realIdx})" data-i18n="action">Delete</button></td>
                            </tr>`;
        }).join('')}
                     </tbody>
                </table>
                <div class="pagination-controls mt-2" style="display:flex; justify-content:center; align-items:center; gap:15px;">
                    <button class="btn-secondary" onclick="window.activeApp.changePage('finance', -1)" ${state.pagination.finance === 1 ? 'disabled style="opacity:0.5"' : ''}>< Previous</button>
                    <span style="font-size:0.9rem; opacity:0.8">Page ${state.pagination.finance} of ${totalPages}</span>
                    <button class="btn-secondary" onclick="window.activeApp.changePage('finance', 1)" ${state.pagination.finance === totalPages ? 'disabled style="opacity:0.5"' : ''}>Next ></button>
                </div>
            </div>
        `;

        // Auto-fill price
        setTimeout(() => {
            const sSku = document.getElementById('s-sku');
            if (sSku) {
                sSku.addEventListener('change', (e) => {
                    const item = state.inventory.find(i => i.sku === e.target.value);
                    if (item) {
                        document.getElementById('s-price').value = item.price;
                    }
                });
            }
        }, 100);

        document.getElementById('add-sale-form').onsubmit = async (e) => {
            e.preventDefault();
            const dateVal = document.getElementById('s-date').value;
            const sku = document.getElementById('s-sku').value;
            const qty = parseInt(document.getElementById('s-qty').value);
            const sellPrice = parseFloat(document.getElementById('s-price').value);

            if (!sku || !qty || !sellPrice) return alert("Select Product, Price and Quantity");
            const item = state.inventory.find(i => i.sku === sku);
            let channel = document.getElementById('s-channel').value;
            if (channel === 'Other') {
                channel = document.getElementById('s-channel-other').value || 'Other';
            }
            if (item) {
                if (item.stock < qty) return alert("Not enough stock!");
                item.stock -= qty;
                const dParts = dateVal.split('-');
                const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

                // Calculate profit using custom sellPrice
                const profit = (sellPrice - item.cost) * qty;

                state.transactions.unshift({
                    id: Date.now(), date: formattedDate,
                    sku, desc: `Sale: ${item.name}`, qty, type: 'profit',
                    amount: profit, category: 'Sales', channel: channel
                });
                await saveData(); renderFinance();
            }
        };
        lucide.createIcons();
    }

    // 6. Render Settings
    function renderSettings() {
        const area = document.getElementById('content-area');
        area.innerHTML = `
            <div class="settings-grid">
                <div class="settings-section">
                    <h3><i data-lucide="user"></i> ${t('settings-profile')}</h3>
                    <div class="settings-option">
                        <label data-i18n="label-name">${t('label-name')}</label>
                        <input type="text" id="set-name" class="settings-input" value="${currentUser.displayName || ''}">
                    </div>
                    <div class="settings-option">
                        <label data-i18n="label-password">${t('label-password')}</label>
                        <input type="password" id="set-pass" class="settings-input" placeholder="New Password">
                    </div>
                    <button class="btn-primary w-full" onclick="window.activeApp.updateProfile()" data-i18n="btn-update">${t('btn-update')}</button>
                </div>
                <div class="settings-section">
                    <h3><i data-lucide="globe"></i> ${t('settings-localization')}</h3>
                    <div class="settings-option">
                        <label data-i18n="label-lang">${t('label-lang')}</label>
                        <select id="set-lang" class="settings-select" onchange="window.activeApp.changeLang(this.value)">
                            <option value="en" ${state.settings.language === 'en' ? 'selected' : ''}>English</option>
                            <option value="cn" ${state.settings.language === 'cn' ? 'selected' : ''}>简体中文</option>
                        </select>
                    </div>
                    <div class="settings-option">
                        <label data-i18n="label-currency">${t('label-currency')}</label>
                        <select id="set-currency" class="settings-select" onchange="window.activeApp.changeCurrency(this.value)">
                            ${['MYR', 'PHP', 'USD', 'SGD', 'IDR', 'THB', 'EUR', 'GBP', 'JPY', 'KRW'].map(c =>
            `<option value="${c}" ${state.settings.currency === c ? 'selected' : ''}>${c}</option>`
        ).join('')}
                        </select>
                    </div>
                </div>
                <div class="settings-section">
                    <h3><i data-lucide="palette"></i> ${t('settings-appearance')}</h3>
                    <div class="settings-option">
                        <label data-i18n="label-theme">${t('label-theme')}</label>
                        <div class="theme-selector">
                            <button class="theme-btn ${state.settings.theme === 'dark' ? 'active' : ''}" onclick="window.activeApp.changeTheme('dark')">Dark</button>
                            <button class="theme-btn ${state.settings.theme === 'light' ? 'active' : ''}" onclick="window.activeApp.changeTheme('light')">Light</button>
                            <button class="theme-btn ${state.settings.theme === 'system' ? 'active' : ''}" onclick="window.activeApp.changeTheme('system')">Auto</button>
                        </div>
                    </div>
                    <div class="settings-option">
                        <label>${t('label-glass')} (${(state.settings.glassOpacity * 100).toFixed(0)}%)</label>
                        <input type="range" min="0.1" max="1" step="0.1" value="${state.settings.glassOpacity}" 
                            oninput="window.activeApp.changeGlass(this.value)" class="w-full">
                    </div>
                    <div class="settings-option">
                        <label>Background Gradient</label>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px">
                            <button onclick="window.activeApp.changeGradient('ocean')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'ocean' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #1e3a8a, #020617); cursor:pointer" title="Ocean"></button>
                            <button onclick="window.activeApp.changeGradient('sunset')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'sunset' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #f97316, #581c87); cursor:pointer" title="Sunset"></button>
                            <button onclick="window.activeApp.changeGradient('forest')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'forest' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #064e3b, #020617); cursor:pointer" title="Forest"></button>
                            <button onclick="window.activeApp.changeGradient('purple')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'purple' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #7c3aed, #1e1b4b); cursor:pointer" title="Purple"></button>
                            <button onclick="window.activeApp.changeGradient('cherry')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'cherry' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #ec4899, #581c87); cursor:pointer" title="Cherry"></button>
                            <button onclick="window.activeApp.changeGradient('midnight')" style="width:40px; height:40px; border-radius:8px; border:${state.settings.gradient === 'midnight' ? '3px solid white' : '1px solid var(--border)'}; background:linear-gradient(135deg, #1e40af, #020617); cursor:pointer" title="Midnight"></button>
                        </div>
                    </div>
                </div>
                <div class="settings-section">
                    <h3><i data-lucide="database"></i> ${t('settings-data')}</h3>
                    <div class="data-stats mb-1">
                        <div class="stat-box"><span>${new Set(state.inventory.map(i => i.name)).size}</span><small>Items</small></div>
                        <div class="stat-box"><span>${state.transactions.length}</span><small>Logs</small></div>
                    </div>
                    <button class="btn-primary mb-1 w-full" onclick="window.activeApp.exportData()" data-i18n="btn-export">${t('btn-export')}</button>
                    <button class="btn-danger-outline" onclick="document.getElementById('import-input').click()" data-i18n="btn-import">${t('btn-import')}</button>
                    <input type="file" id="import-input" style="display:none" onchange="window.activeApp.importData(this)">
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    // 7. Render Filtered
    function renderFiltered() {
        const area = document.getElementById('content-area');
        let title = ''; let list = [];
        if (currentFilterType === 'profit') {
            title = t('total-profit'); list = state.transactions.filter(t => t.type === 'profit');
        } else if (currentFilterType === 'expense') {
            title = t('total-expense'); list = state.transactions.filter(t => t.type === 'stock-in');
        } else if (currentFilterType === 'low-stock') {
            title = t('low-stock'); list = state.inventory.filter(i => i.stock < 5).map(i => ({ ...i, amount: i.stock, desc: i.name, date: 'Alert' }));
        } else if (currentFilterType === 'inventory-summary') {
            title = t('inventory-count');
            const grouped = {};
            state.inventory.forEach(i => {
                const s = i.sku || 'Unknown';
                if (!grouped[s]) grouped[s] = { sku: s, desc: i.name, stock: 0, date: 'Total' };
                grouped[s].stock += (parseInt(i.stock) || 0);
            });
            list = Object.values(grouped);
        }
        area.innerHTML = `
            <div class="glass-card mb-2"><div style="display:flex; justify-content:space-between"><h2>${title}</h2><button class="btn-secondary" onclick="window.activeApp.renderPage('dashboard')">Back</button></div></div>
            <div class="glass-card"><table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('sku')}</th><th>${t('desc')}</th><th>${(currentFilterType === 'low-stock' || currentFilterType === 'inventory-summary') ? 'Stock' : t('amount')}</th></tr></thead><tbody>
                ${list.map(item => `<tr><td>${item.date}</td><td>${item.sku || '-'}</td><td>${item.desc}</td><td>${(currentFilterType === 'low-stock' || currentFilterType === 'inventory-summary') ? item.stock : formatCurrency(item.amount)}</td></tr>`).join('')}
            </tbody></table></div>
        `;
        lucide.createIcons();
    }

    // 8. Global Router
    window.activeApp = {
        renderPage: (page) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            let nav = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (nav) nav.classList.add('active');
            if (page === 'dashboard') renderDashboard();
            else if (page === 'inventory') renderInventory();
            else if (page === 'finance') renderFinance();
            else if (page === 'settings') renderSettings();
        },
        deleteItem: async (idx) => {
            if (confirm(t('confirm-delete'))) {
                const item = state.inventory[idx];
                state.transactions = state.transactions.filter(t => t.sku !== item.sku);
                state.inventory.splice(idx, 1);
                await saveData(); renderInventory();
            }
        },
        deleteTransaction: async (idx) => {
            if (confirm(t('confirm-delete'))) {
                const txn = state.transactions[idx];
                const item = state.inventory.find(i => i.sku === txn.sku);

                if (item) {
                    if (txn.type === 'profit') {
                        item.stock += (txn.qty || 0); // Reverse Sale
                    } else if (txn.type === 'stock-in') {
                        item.stock -= (txn.qty || 0); // Reverse Restock
                        if (item.stock < 0) item.stock = 0;
                    }
                }
                state.transactions.splice(idx, 1);
                await saveData();
                if (document.getElementById('add-item-form')) renderInventory();
                else if (document.getElementById('add-sale-form')) renderFinance();
                else renderDashboard();
            }
        },
        changePage: (type, dir) => {
            if (type === 'inventory') {
                state.pagination.inventory += dir;
                renderInventory();
            } else if (type === 'finance') {
                state.pagination.finance += dir;
                renderFinance();
            }
        },
        showFiltered: (type) => { currentFilterType = type; renderFiltered(); },
        changeLang: (v) => { state.settings.language = v; updateI18nUI(); saveData(); renderSettings(); },
        changeCurrency: (v) => { state.settings.currency = v; saveData(); renderSettings(); renderDashboard(); },
        changeTheme: (v) => { state.settings.theme = v; applyTheme(v); saveData(); renderSettings(); },
        changeGlass: (v) => { state.settings.glassOpacity = v; applyGlass(v); saveData(); renderSettings(); },
        changeGradient: (v) => { state.settings.gradient = v; applyGradient(v); saveData(); renderSettings(); },
        updateProfile: async () => {
            const n = document.getElementById('set-name').value;
            const p = document.getElementById('set-pass').value;
            try {
                if (n) { await currentUser.updateProfile({ displayName: n }); document.getElementById('display-name').innerText = n; }
                if (p) { await currentUser.updatePassword(p); }
                alert("Profile Updated"); await saveData();
            } catch (e) { alert(e.message); }
        },
        exportData: () => {
            const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kirokuhub_${new Date().toISOString().split('T')[0]}.json`; a.click();
        },
        importData: (input) => {
            const r = new FileReader();
            r.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.inventory) { state.inventory = data.inventory; state.transactions = data.transactions; if (data.settings) state.settings = data.settings; await saveData(); location.reload(); }
                } catch (err) { alert("Invalid File"); }
            }; r.readAsText(input.files[0]);
        },
        logout: () => auth.signOut()
    };

    // 9. Auth Listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('auth-screen').classList.add('hidden');
            await loadUserData();
            applyTheme(state.settings.theme); applyGlass(state.settings.glassOpacity); applyGradient(state.settings.gradient || 'ocean');
            const name = user.displayName || user.email.split('@')[0];
            const nameEl = document.getElementById('display-name');
            if (nameEl) nameEl.innerText = name.toUpperCase();
            const av = document.getElementById('user-avatar');
            if (av) av.innerText = name.charAt(0).toUpperCase();
            window.activeApp.renderPage('dashboard');
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    });

    // 10. Nav & Search Listeners
    document.querySelectorAll('.nav-item').forEach(item => { item.onclick = (e) => { e.preventDefault(); window.activeApp.renderPage(item.getAttribute('data-page')); }; });
    const sForm = document.getElementById('global-search');
    if (sForm) sForm.onsubmit = (e) => {
        e.preventDefault(); const q = document.getElementById('search-input').value.toLowerCase(); if (!q) return;
        const res = state.transactions.filter(t => t.desc.toLowerCase().includes(q) || (t.sku && t.sku.toLowerCase().includes(q)));
        document.getElementById('content-area').innerHTML = `
            <div class="glass-card mb-2"><h2>Search Results: "${q}"</h2></div>
            <div class="glass-card"><table class="data-table"><thead><tr><th>${t('date')}</th><th>${t('desc')}</th><th>${t('amount')}</th></tr></thead><tbody>
            ${res.map(item => `<tr><td>${item.date}</td><td>${item.desc}</td><td>${formatCurrency(item.amount)}</td></tr>`).join('')}
            </tbody></table><button class="btn-secondary mt-2" onclick="window.activeApp.renderPage('dashboard')">Back</button></div>`;
    };
});
