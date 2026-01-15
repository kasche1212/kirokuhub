/**
 * KirokuHub - Enhanced Cloud Version
 * Fixed: Missing Pages (Finance), Delete Actions, and Localization
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
        settings: {
            language: 'en',
            currency: 'MYR',
            theme: 'dark',
            glassOpacity: 0.8
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
    let currentFilterType = 'profit'; // profit, expense, low-stock

    // 2. Helper Functions
    function t(key) {
        return translations[state.settings.language][key] || key;
    }

    function formatCurrency(amount) {
        return `${state.settings.currency} ${parseFloat(amount || 0).toFixed(2)}`;
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

    async function saveData() {
        if (!currentUser) return;
        try {
            await db.collection('users').doc(currentUser.uid).set({
                inventory: state.inventory,
                transactions: state.transactions,
                settings: state.settings
            });
        } catch (e) {
            console.error("Save error:", e);
            alert("Error saving data. Check console.");
        }
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

    // 3. Render Dashboard
    function renderDashboard() {
        const area = document.getElementById('content-area');
        if (!area) return;

        // Calculate stats
        let p = 0;
        state.transactions.forEach(t => { if (t.type === 'profit') p += t.amount; });
        let e = 0;
        state.inventory.forEach(i => {
            // Cost of goods currently in stock + cost of goods sold
            // Simplified: Just calculate total cost of all stock ever added? 
            // Or track 'expense' transactions. 
            // For now, let's sum up stock * cost for current inventory plus historical expenses if we had them.
            // Better approach based on previous logic:
            // Expense = (Current Stock + Sold Quantity) * Cost
            const soldQty = state.transactions
                .filter(t => t.sku === i.sku && t.type === 'profit')
                .reduce((s, t) => s + (t.qty || 0), 0);
            e += (parseFloat(i.cost || 0) * (parseFloat(i.stock || 0) + soldQty));
        });

        // Safe chart data
        const chartData = {};
        state.transactions.forEach(t => {
            if (!t.date) return;
            const key = t.date.split('/')[2] + '-' + t.date.split('/')[1]; // YYYY-MM for sorting
            if (!chartData[key]) chartData[key] = { p: 0, e: 0, label: t.date.slice(3) };
            if (t.type === 'profit') chartData[key].p += t.amount;
            // Expense is tricky to chart per day without expense records. We'll leave expense as 0 or impl later.
        });

        area.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card ocean-gradient">
                    <div class="stat-info"><h3>${t('total-profit')}</h3><p class="value">${formatCurrency(p)}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('profit')"><i data-lucide="wallet"></i></div>
                </div>
                <div class="stat-card sunset-gradient">
                    <div class="stat-info"><h3>${t('total-expense')}</h3><p class="value">${formatCurrency(e)}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('expense')"><i data-lucide="credit-card"></i></div>
                </div>
                <div class="stat-card berry-gradient">
                    <div class="stat-info"><h3>${t('low-stock')}</h3><p class="value">${state.inventory.filter(i => i.stock < 5).length}</p></div>
                    <div class="stat-icon" onclick="window.activeApp.showFiltered('low-stock')"><i data-lucide="package"></i></div>
                </div>
                <div class="stat-card forest-gradient">
                    <div class="stat-info"><h3>${t('inventory-count')}</h3><p class="value">${state.inventory.length}</p></div>
                    <div class="stat-icon"><i data-lucide="database"></i></div>
                </div>
            </div>

            <div class="chart-section glass-card mb-2">
                <h2>📊 ${t('recent-activity')}</h2>
                <div class="chart-container"><canvas id="mainChart"></canvas></div>
            </div>

            <div class="glass-card">
                <h2 class="mb-1">${t('recent-activity')}</h2>
                <table class="data-table">
                    <thead><tr><th>${t('date')}</th><th>${t('desc')}</th><th>${t('amount')}</th><th>${t('action')}</th></tr></thead>
                    <tbody>
                        ${state.transactions.slice(0, 10).map((item, idx) => `
                            <tr>
                                <td>${item.date}</td>
                                <td>${item.desc}</td>
                                <td style="color:${item.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">
                                    ${item.type === 'profit' ? '+' : '-'} ${formatCurrency(item.amount)}
                                </td>
                                <td>
                                    <button class="btn-xs" onclick="window.activeApp.deleteTransaction(${idx})">×</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Render Chart
        const ctx = document.getElementById('mainChart');
        if (ctx) {
            const sortedKeys = Object.keys(chartData).sort().slice(-6);
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedKeys.map(k => chartData[k].label),
                    datasets: [
                        { label: t('total-profit'), data: sortedKeys.map(k => chartData[k].p), backgroundColor: '#10b981' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        lucide.createIcons();
    }

    // 4. Render Inventory
    function renderInventory() {
        const area = document.getElementById('content-area');
        area.innerHTML = `
            <div class="glass-card mb-2">
                <h2>${t('add-product')}</h2>
                <form id="add-item-form" class="automation-flex mt-2">
                    <input type="text" id="in-sku" placeholder="${t('sku')}" required class="flex-grow">
                    <input type="text" id="in-name" placeholder="${t('product')}" required class="flex-grow">
                    <input type="number" id="in-stock" placeholder="${t('stock')}" style="width:80px">
                    <input type="number" id="in-cost" placeholder="${t('cost')}" style="width:100px">
                    <input type="number" id="in-price" placeholder="${t('price')}" style="width:100px">
                    <button class="btn-primary">${t('add-product')}</button>
                </form>
            </div>
            <div class="glass-card">
                <table class="data-table">
                    <thead><tr><th>${t('sku')}</th><th>${t('product')}</th><th>${t('stock')}</th><th>${t('cost')}</th><th>${t('price')}</th><th>${t('profit')}</th><th>${t('action')}</th></tr></thead>
                    <tbody>
                        ${state.inventory.length === 0 ? `<tr><td colspan="7" align="center">${t('no-data')}</td></tr>` : ''}
                        ${state.inventory.map((item, idx) => `
                            <tr>
                                <td>${item.sku}</td>
                                <td>${item.name}</td>
                                <td style="color:${item.stock < 5 ? 'var(--danger)' : 'inherit'}">${item.stock}</td>
                                <td>${formatCurrency(item.cost)}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td style="color:var(--success)">${formatCurrency(item.price - item.cost)}</td>
                                <td><button class="btn-secondary" onclick="window.activeApp.deleteItem(${idx})">Delete</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('add-item-form').onsubmit = async (e) => {
            e.preventDefault();
            const sku = document.getElementById('in-sku').value;
            const name = document.getElementById('in-name').value;
            const stock = parseInt(document.getElementById('in-stock').value) || 0;
            const cost = parseFloat(document.getElementById('in-cost').value) || 0;
            const price = parseFloat(document.getElementById('in-price').value) || 0;

            state.inventory.push({ sku, name, stock, cost, price, date: new Date().toLocaleDateString() });
            state.transactions.unshift({
                id: Date.now(),
                date: new Date().toLocaleDateString('en-GB'),
                sku, desc: `Initial: ${name}`,
                qty: stock, type: 'stock-in', amount: (cost * stock), category: 'Stock'
            });
            await saveData(); renderInventory();
        };
        lucide.createIcons();
    }

    // 5. Render Finance
    function renderFinance() {
        const area = document.getElementById('content-area');
        const sales = state.transactions.filter(t => t.type === 'profit');

        area.innerHTML = `
            <div class="glass-card mb-2">
                <h2>${t('add-sale')}</h2>
                <form id="add-sale-form" class="automation-flex mt-2">
                    <select id="s-sku" class="flex-grow settings-select" style="max-width:300px">
                        <option value="">Select SKU</option>
                        ${state.inventory.map(i => `<option value="${i.sku}">${i.sku} - ${i.name} (Stock: ${i.stock})</option>`).join('')}
                    </select>
                    <input type="number" id="s-qty" placeholder="Qty" style="width:80px; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:white">
                    <button class="btn-primary">${t('add-sale')}</button>
                </form>
            </div>
            <div class="glass-card">
                <table class="data-table">
                     <thead><tr><th>${t('date')}</th><th>${t('desc')}</th><th>${t('amount')}</th><th>${t('action')}</th></tr></thead>
                     <tbody>
                        ${sales.length === 0 ? `<tr><td colspan="4" align="center">${t('no-data')}</td></tr>` : ''}
                        ${sales.map((item) => {
            // find original index to delete
            const realIdx = state.transactions.indexOf(item);
            return `<tr>
                                <td>${item.date}</td>
                                <td>${item.desc}</td>
                                <td style="color:var(--success)">+ ${formatCurrency(item.amount)}</td>
                                <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${realIdx})">Delete</button></td>
                            </tr>`;
        }).join('')}
                     </tbody>
                </table>
            </div>
        `;

        document.getElementById('add-sale-form').onsubmit = async (e) => {
            e.preventDefault();
            const sku = document.getElementById('s-sku').value;
            const qty = parseInt(document.getElementById('s-qty').value);
            if (!sku || !qty) return alert("Select Product and Quantity");

            const item = state.inventory.find(i => i.sku === sku);
            if (item) {
                if (item.stock < qty) return alert("Not enough stock!");
                item.stock -= qty;
                state.transactions.unshift({
                    id: Date.now(),
                    date: new Date().toLocaleDateString('en-GB'),
                    sku, desc: `Sale: ${item.name}`,
                    qty, type: 'profit',
                    amount: (item.price - item.cost) * qty,
                    category: 'Sales'
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
                        <label>${t('label-name')}</label>
                        <input type="text" id="set-name" class="settings-input" value="${currentUser.displayName || ''}">
                    </div>
                    <div class="settings-option">
                        <label>${t('label-password')}</label>
                        <input type="password" id="set-pass" class="settings-input" placeholder="New Password">
                    </div>
                    <button class="btn-primary w-full" onclick="window.activeApp.updateProfile()">${t('btn-update')}</button>
                </div>
                <div class="settings-section">
                    <h3><i data-lucide="globe"></i> ${t('settings-localization')}</h3>
                    <div class="settings-option">
                        <label>${t('label-lang')}</label>
                        <select id="set-lang" class="settings-select" onchange="window.activeApp.changeLang(this.value)">
                            <option value="en" ${state.settings.language === 'en' ? 'selected' : ''}>English</option>
                            <option value="cn" ${state.settings.language === 'cn' ? 'selected' : ''}>简体中文</option>
                        </select>
                    </div>
                    <div class="settings-option">
                        <label>${t('label-currency')}</label>
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
                        <label>${t('label-theme')}</label>
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
                </div>
                <div class="settings-section">
                    <h3><i data-lucide="database"></i> ${t('settings-data')}</h3>
                    <div class="data-stats mb-1">
                        <div class="stat-box"><span>${state.inventory.length}</span><small>Items</small></div>
                        <div class="stat-box"><span>${state.transactions.length}</span><small>Logs</small></div>
                    </div>
                    <button class="btn-primary mb-1 w-full" onclick="window.activeApp.exportData()">${t('btn-export')}</button>
                    <button class="btn-danger-outline" onclick="document.getElementById('import-input').click()">${t('btn-import')}</button>
                    <input type="file" id="import-input" style="display:none" onchange="window.activeApp.importData(this)">
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    // 7. Render Filtered
    function renderFiltered() {
        const area = document.getElementById('content-area');
        let title = '';
        let list = [];

        if (currentFilterType === 'profit') {
            title = t('total-profit');
            list = state.transactions.filter(t => t.type === 'profit');
        } else if (currentFilterType === 'expense') {
            title = t('total-expense');
            // Expense implies stock-in costs for now
            list = state.transactions.filter(t => t.type === 'stock-in');
        } else if (currentFilterType === 'low-stock') {
            title = t('low-stock');
            list = state.inventory.filter(i => i.stock < 5).map(i => ({ ...i, amount: i.stock, desc: i.name, date: 'Alert' })); // Mock transaction for display
        }

        area.innerHTML = `
            <div class="glass-card mb-2">
                <div style="display:flex; justify-content:space-between">
                    <h2>${title}</h2>
                    <button class="btn-secondary" onclick="window.activeApp.renderPage('dashboard')">Back</button>
                </div>
            </div>
            <div class="glass-card">
                 <table class="data-table">
                     <thead><tr><th>${t('date')}</th><th>${t('desc')}</th><th>${currentFilterType === 'low-stock' ? 'Stock' : t('amount')}</th></tr></thead>
                     <tbody>
                        ${list.map(item => `<tr>
                            <td>${item.date}</td>
                            <td>${item.desc}</td>
                            <td>${currentFilterType === 'low-stock' ? item.stock : formatCurrency(item.amount)}</td>
                        </tr>`).join('')}
                     </tbody>
                 </table>
            </div>
        `;
        lucide.createIcons();
    }

    // 8. Global Router & API
    window.activeApp = {
        renderPage: (page) => {
            // Update Active Nav
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (nav) nav.classList.add('active');

            if (page === 'dashboard') renderDashboard();
            else if (page === 'inventory') renderInventory();
            else if (page === 'finance') renderFinance();
            else if (page === 'settings') renderSettings();
        },
        deleteItem: async (idx) => {
            if (confirm(t('confirm-delete'))) {
                const item = state.inventory[idx];
                state.transactions = state.transactions.filter(t => t.sku !== item.sku); // cascade delete logs
                state.inventory.splice(idx, 1);
                await saveData(); renderInventory();
            }
        },
        deleteTransaction: async (idx) => {
            if (confirm(t('confirm-delete'))) {
                const txn = state.transactions[idx];
                // Reverse stock effect
                const item = state.inventory.find(i => i.sku === txn.sku);
                if (item) {
                    if (txn.type === 'profit') item.stock += (txn.qty || 0);
                    // if(txn.type === 'stock-in') item.stock -= (txn.qty || 0); // Not implemented yet
                }
                state.transactions.splice(idx, 1);
                await saveData();
                // Reload current page roughly
                const ctx = document.getElementById('add-item-form') ? 'inventory' :
                    document.getElementById('add-sale-form') ? 'finance' : 'dashboard';
                window.activeApp.renderPage(ctx);
            }
        },
        showFiltered: (type) => {
            currentFilterType = type;
            renderFiltered();
        },
        // Settings Implementations
        changeLang: (v) => { state.settings.language = v; updateI18nUI(); saveData(); renderSettings(); },
        changeCurrency: (v) => { state.settings.currency = v; saveData(); renderSettings(); renderDashboard(); }, // Re-render dashboard to update chart
        changeTheme: (v) => { state.settings.theme = v; applyTheme(v); saveData(); renderSettings(); },
        changeGlass: (v) => { state.settings.glassOpacity = v; applyGlass(v); saveData(); renderSettings(); },
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
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `kirokuhub_${new Date().toISOString().split('T')[0]}.json`; a.click();
        },
        importData: (input) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.inventory) {
                        state.inventory = data.inventory;
                        state.transactions = data.transactions;
                        if (data.settings) state.settings = data.settings;
                        await saveData(); location.reload();
                    }
                } catch (err) { alert("Invalid File"); }
            };
            reader.readAsText(input.files[0]);
        },
        logout: () => auth.signOut()
    };

    // 9. Auth Listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('auth-screen').classList.add('hidden');
            await loadUserData();
            applyTheme(state.settings.theme);
            applyGlass(state.settings.glassOpacity);

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

    // 10. Nav Listener
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            window.activeApp.renderPage(page);
        };
    });

    // 11. Search Listener
    const sForm = document.getElementById('global-search');
    if (sForm) {
        sForm.onsubmit = (e) => {
            e.preventDefault();
            const q = document.getElementById('search-input').value.toLowerCase();
            if (!q) return;
            // Render basic search results manually
            const res = state.transactions.filter(t => t.desc.toLowerCase().includes(q) || (t.sku && t.sku.toLowerCase().includes(q)));
            const area = document.getElementById('content-area');
            area.innerHTML = `
                <div class="glass-card mb-2"><h2>Search Results: "${q}"</h2></div>
                <div class="glass-card">
                   <table class="data-table">
                     <thead><tr><th>${t('date')}</th><th>${t('desc')}</th><th>${t('amount')}</th></tr></thead>
                     <tbody>
                        ${res.map(item => `<tr><td>${item.date}</td><td>${item.desc}</td><td>${formatCurrency(item.amount)}</td></tr>`).join('')}
                     </tbody>
                   </table>
                   <button class="btn-secondary mt-2" onclick="window.activeApp.renderPage('dashboard')">Back</button>
                </div>
            `;
        };
    }
});
