/**
 * KirokuHub Cloud Edition
 * Integrated with Firebase Auth and Firestore
 */

// --- FIREBASE CONFIGURATION ---
// User will replace this with their own config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyAAk2hfkIpIwFyg8BG9XAYx98OGCBn1yds",
    authDomain: "kirokuhub.firebaseapp.com",
    projectId: "kirokuhub",
    storageBucket: "kirokuhub.firebasestorage.app",
    messagingSenderId: "470629468332",
    appId: "1:470629468332:web:0a11ef8c0158ce32d1b709"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        transactions: [],
        inventory: []
    };

    const pageState = {
        dashboard: 0,
        inventory: 0,
        finance: 0,
        search: 0,
        settings: 0,
        filtered: 0
    };

    let searchQuery = '';
    let filterType = 'profit';
    let currentUser = null;
    const ITEMS_PER_PAGE = 10;

    // --- UI Elements ---
    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.querySelector('.app-container');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPass = document.getElementById('auth-password');
    const authBtn = document.getElementById('auth-btn');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authSwitch = document.getElementById('switch-auth');
    const authError = document.getElementById('auth-error');
    const displayNameEl = document.getElementById('display-name');
    const userAvatarEl = document.getElementById('user-avatar');

    let isLoginMode = true;

    // --- AUTHENTICATION LOGIC ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            authScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');

            // Update User Profile UI
            const name = user.email.split('@')[0].toUpperCase();
            displayNameEl.innerText = name;
            userAvatarEl.innerText = name.charAt(0);

            await loadUserData();
            renderPage('dashboard');
        } else {
            currentUser = null;
            appContainer.classList.add('hidden');
            authScreen.classList.remove('hidden');
            lucide.createIcons();
        }
    });

    authSwitch.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
        authSubtitle.innerText = isLoginMode ? 'Welcome back! Please login to your account.' : 'Create a new account to sync your data.';
        authSwitch.innerHTML = isLoginMode ? "Don't have an account? <a href='#'>Sign Up</a>" : "Already have an account? <a href='#'>Login</a>";
        authError.classList.add('hidden');
    });

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
                const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                // Initialize new user data in Firestore
                await db.collection('users').doc(userCredential.user.uid).set({
                    inventory: [],
                    transactions: []
                });
            }
        } catch (error) {
            authError.innerText = error.message;
            authError.classList.remove('hidden');
            authBtn.innerText = isLoginMode ? 'Login' : 'Sign Up';
        }
        authBtn.disabled = false;
    });

    // --- CLOUD SYNC LOGIC ---
    async function loadUserData() {
        if (!currentUser) return;
        try {
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                state.inventory = data.inventory || [];
                state.transactions = data.transactions || [];
            }
        } catch (error) {
            console.error("Error loading data:", error);
        }
    }

    async function saveData() {
        if (!currentUser) return;
        try {
            await db.collection('users').doc(currentUser.uid).set({
                inventory: state.inventory,
                transactions: state.transactions
            });
        } catch (error) {
            console.error("Error saving data:", error);
        }
    }

    // --- CORE APP LOGIC (Updated for Cloud) ---
    function updateStats() {
        let totalProfit = 0;
        state.transactions.forEach(t => {
            if (t.type === 'profit') totalProfit += t.amount;
        });

        let totalExpense = 0;
        state.inventory.forEach(i => {
            const soldQty = state.transactions
                .filter(t => t.sku === i.sku && t.type === 'profit')
                .reduce((sum, t) => sum + (t.qty || 0), 0);
            const totalPurchased = (i.stock || 0) + soldQty;
            totalExpense += (parseFloat(i.cost || 0) * totalPurchased);
        });

        const profitEl = document.querySelector('.gold-gradient .value');
        const expenseEl = document.querySelector('.sunset-gradient .value');

        if (profitEl) {
            profitEl.innerText = `PHP ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            profitEl.style.color = 'var(--success)';
        }
        if (expenseEl) {
            expenseEl.innerText = `PHP ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            expenseEl.style.color = 'var(--danger)';
        }
    }

    function renderPaginationControls(containerId, totalItems, currentPage, targetPageKey) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages <= 1) return '';
        return `
            <div class="pagination">
                <span class="page-info">Page ${currentPage + 1} of ${totalPages}</span>
                <button class="pagination-btn" ${currentPage === 0 ? 'disabled' : ''} 
                    onclick="window.activeApp.changePage('${targetPageKey}', ${currentPage - 1})">Prev</button>
                <button class="pagination-btn" ${currentPage >= totalPages - 1 ? 'disabled' : ''} 
                    onclick="window.activeApp.changePage('${targetPageKey}', ${currentPage + 1})">Next</button>
            </div>
        `;
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            window.activeApp.renderPage(page);
        });
    });

    function renderPage(page) {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;

        if (page === 'dashboard') {
            contentArea.innerHTML = `
                <section class="page dashboard active">
                    <div class="stats-grid">
                        <div class="stat-card gold-gradient">
                            <div class="stat-info">
                                <h3>Total Profit</h3>
                                <p class="value">PHP 0.00</p>
                                <span class="trend up"><i data-lucide="trending-up"></i> Real-time</span>
                            </div>
                            <div class="stat-icon clickable" onclick="window.activeApp.showFilteredList('profit')" title="View all">
                                <i data-lucide="wallet"></i>
                            </div>
                        </div>
                        <div class="stat-card sunset-gradient">
                            <div class="stat-info">
                                <h3>Total Expense</h3>
                                <p class="value">PHP 0.00</p>
                                <span class="trend down"><i data-lucide="trending-down"></i> Based on Cost</span>
                            </div>
                            <div class="stat-icon clickable" onclick="window.activeApp.showFilteredList('expense')" title="View all">
                                <i data-lucide="credit-card"></i>
                            </div>
                        </div>
                    </div>
                    <div class="chart-section glass-card">
                        <div class="chart-header">
                            <h2>📊 Profit vs Expenses Overview</h2>
                            <span class="chart-subtitle">Monthly comparison</span>
                        </div>
                        <div class="chart-container">
                            <canvas id="profitExpenseChart"></canvas>
                        </div>
                    </div>
                    <div class="recent-activity glass-card">
                        <div class="card-header"><h2>Recent Activity</h2></div>
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Detail</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
                            <tbody id="recent-transactions"></tbody>
                        </table>
                        <div id="dash-pagination"></div>
                    </div>
                </section>
            `;
            setTimeout(() => {
                renderTransactions();
                updateStats();
                renderDashboardChart();
                lucide.createIcons();
            }, 0);
        } else if (page === 'inventory') {
            const displayInventory = [...state.inventory].reverse();
            const startIdx = pageState.inventory * ITEMS_PER_PAGE;
            const paginatedInv = displayInventory.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page inventory active">
                    <div class="glass-card mb-2">
                        <h2>Add New Product</h2>
                        <form id="new-item-form" class="automation-flex">
                            <input type="date" id="new-date" value="${new Date().toISOString().split('T')[0]}" class="flex-grow">
                            <input type="text" id="new-sku" placeholder="SKU ID" class="flex-grow">
                            <input type="text" id="new-name" placeholder="Product Name" class="flex-grow">
                            <input type="number" id="new-stock" placeholder="Initial Stock" style="width:100px">
                            <input type="number" id="new-cost" placeholder="Cost" style="width:100px">
                            <input type="number" id="new-price" placeholder="Price" style="width:100px">
                            <button type="submit" class="btn-primary">Add Item</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <table class="data-table">
                            <thead><tr><th>Entry Date</th><th>SKU</th><th>Name</th><th>Stock</th><th>Cost</th><th>Price</th><th>Profit</th><th>Action</th></tr></thead>
                            <tbody>
                                ${displayInventory.length === 0 ? '<tr><td colspan="8" style="text-align:center">No inventory found.</td></tr>' :
                    paginatedInv.map((item) => {
                        const originalIdx = state.inventory.indexOf(item);
                        const profit = (parseFloat(item.price || 0) - parseFloat(item.cost || 0)).toFixed(2);
                        return `<tr>
                                        <td>${item.date || '-'}</td>
                                        <td>${item.sku}</td>
                                        <td>${item.name}</td>
                                        <td>${item.stock} <span class="trend ${item.stock < 5 ? 'warning' : ''}">${item.stock < 5 ? 'Low' : ''}</span></td>
                                        <td>PHP ${parseFloat(item.cost).toFixed(2)}</td>
                                        <td>PHP ${parseFloat(item.price).toFixed(2)}</td>
                                        <td style="color:var(--success)">PHP ${profit}</td>
                                        <td><button class="btn-secondary" onclick="window.activeApp.deleteItem(${originalIdx})">Delete</button></td>
                                    </tr>`;
                    }).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('inv-pagination', displayInventory.length, pageState.inventory, 'inventory')}
                    </div>
                </section>
            `;
            const itemForm = document.getElementById('new-item-form');
            if (itemForm) {
                itemForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const rawDate = document.getElementById('new-date').value;
                    const dateParts = rawDate.split('-');
                    const formattedDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
                    const sku = document.getElementById('new-sku').value;
                    const name = document.getElementById('new-name').value;
                    const stock = parseInt(document.getElementById('new-stock').value) || 0;
                    const cost = parseFloat(document.getElementById('new-cost').value) || 0;
                    const price = parseFloat(document.getElementById('new-price').value) || 0;
                    if (sku && name) {
                        state.inventory.push({ sku, name, stock, cost, price, date: formattedDate });
                        state.transactions.unshift({
                            id: Date.now(),
                            date: formattedDate,
                            sku,
                            desc: `Restock: ${sku} - ${name}`,
                            qty: stock,
                            type: 'stock-in',
                            amount: (cost * stock),
                            category: 'Inventory'
                        });
                        await saveData();
                        renderPage('inventory');
                    }
                };
            }
        } else if (page === 'finance') {
            const allSales = state.transactions.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.type === 'profit');
            const startIdx = pageState.finance * ITEMS_PER_PAGE;
            const paginatedSales = allSales.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <h2>Sell Product</h2>
                        <form id="sales-form" class="automation-flex">
                            <input type="date" id="s-date" value="${new Date().toISOString().split('T')[0]}">
                            <select id="s-sku">
                                <option value="">Select SKU</option>
                                ${state.inventory.map(i => `<option value="${i.sku}">${i.sku}</option>`).join('')}
                            </select>
                            <input type="text" id="s-name" placeholder="Product Name" readonly class="flex-grow">
                            <input type="number" id="s-qty" placeholder="Qty" style="width:90px">
                            <button type="submit" class="btn-primary">Confirm Sale</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Detail</th><th>Qty</th><th>Profit</th><th>Action</th></tr></thead>
                            <tbody>
                                ${allSales.length === 0 ? '<tr><td colspan="5" style="text-align:center">No records.</td></tr>' :
                    paginatedSales.map(t => `<tr>
                                    <td>${t.date}</td><td>${t.desc}</td><td>${t.qty}</td>
                                    <td style="color:var(--success)">+PHP ${t.amount.toFixed(2)}</td>
                                    <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${t.originalIdx})">Remove</button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('fin-pagination', allSales.length, pageState.finance, 'finance')}
                    </div>
                </section>
            `;
            const skuSelect = document.getElementById('s-sku');
            const nameInput = document.getElementById('s-name');
            if (skuSelect) {
                skuSelect.onchange = (e) => {
                    const item = state.inventory.find(i => i.sku === e.target.value);
                    nameInput.value = item ? item.name : '';
                };
            }
            const salesForm = document.getElementById('sales-form');
            if (salesForm) {
                salesForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const rawDate = document.getElementById('s-date').value;
                    const dateParts = rawDate.split('-');
                    const formattedDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
                    const sku = skuSelect.value;
                    const qty = parseInt(document.getElementById('s-qty').value);
                    const item = state.inventory.find(i => i.sku === sku);
                    if (item && qty > 0 && item.stock >= qty) {
                        item.stock -= qty;
                        state.transactions.unshift({
                            id: Date.now(),
                            date: formattedDate,
                            sku,
                            desc: `${sku} - ${item.name}`,
                            qty,
                            type: 'profit',
                            amount: (parseFloat(item.price) - parseFloat(item.cost)) * qty,
                            category: 'Sale'
                        });
                        await saveData();
                        renderPage('finance');
                    } else if (item && item.stock < qty) {
                        alert("Insufficient stock!");
                    }
                };
            }
        } else if (page === 'filtered') {
            let filteredResults = [];
            let pageTitle = '';
            let totalAmount = 0;

            if (filterType === 'profit') {
                filteredResults = state.transactions.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.type === 'profit');
                pageTitle = '💰 All Profit Transactions';
                totalAmount = filteredResults.reduce((sum, t) => sum + t.amount, 0);
            } else {
                filteredResults = state.transactions.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.type === 'stock-in');
                pageTitle = '💳 All Expense Transactions';
                totalAmount = filteredResults.reduce((sum, t) => sum + t.amount, 0);
            }

            const startIdx = pageState.filtered * ITEMS_PER_PAGE;
            const paginatedResults = filteredResults.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <div class="filtered-header">
                            <div>
                                <h2>${pageTitle}</h2>
                                <p class="filtered-summary">
                                    <span class="record-count">${filteredResults.length} records</span>
                                    <span class="total-amount ${filterType === 'profit' ? 'profit' : 'expense'}">
                                        Total: PHP ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </p>
                            </div>
                            <button class="btn-secondary" onclick="window.activeApp.renderPage('dashboard')"><i data-lucide="arrow-left"></i> Back</button>
                        </div>
                    </div>
                    <div class="glass-card">
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Detail</th><th>${filterType === 'profit' ? 'Qty' : 'Category'}</th><th>Amount</th><th>Action</th></tr></thead>
                            <tbody>
                                ${filteredResults.length === 0 ? '<tr><td colspan="5" style="text-align:center">No records.</td></tr>' :
                    paginatedResults.map(t => `<tr>
                                    <td>${t.date}</td><td>${t.desc}</td><td>${filterType === 'profit' ? t.qty : t.category}</td>
                                    <td style="color:${filterType === 'profit' ? 'var(--success)' : 'var(--danger)'}">${filterType === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}</td>
                                    <td><button class="btn-secondary" onclick="window.activeApp.deleteFilteredTransaction(${t.originalIdx})">Remove</button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('f-pagination', filteredResults.length, pageState.filtered, 'filtered')}
                    </div>
                </section>
            `;
            lucide.createIcons();
        } else if (page === 'search') {
            const query = searchQuery.toLowerCase();
            const results = state.transactions.map((t, i) => ({ ...t, originalIdx: i })).filter(t =>
                t.desc.toLowerCase().includes(query) || (t.sku && t.sku.toLowerCase().includes(query))
            );
            const startIdx = pageState.search * ITEMS_PER_PAGE;
            const paginated = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <h2>Results for: "${searchQuery}"</h2>
                        <p>${results.length} records found</p>
                    </div>
                    <div class="glass-card">
                        <table class="data-table">
                            <thead><tr><th>Date</th><th>Detail</th><th>Category</th><th>Amount</th><th>Action</th></tr></thead>
                            <tbody>
                                ${paginated.map(t => `<tr>
                                    <td>${t.date}</td><td>${t.desc}</td><td>${t.category}</td>
                                    <td style="color:${t.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}</td>
                                    <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${t.originalIdx})">Remove</button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('s-pagination', results.length, pageState.search, 'search')}
                    </div>
                </section>
            `;
        } else if (page === 'settings') {
            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <h2>Cloud Center</h2>
                        <p>Your data is automatically synced to the cloud.</p>
                    </div>
                    <div class="stats-grid">
                        <div class="glass-card" style="text-align:center; padding:2rem">
                            <i data-lucide="shield-check" style="width:48px; height:48px; color:var(--success); margin-bottom:1rem"></i>
                            <h3>Logged in as:</h3>
                            <p>${currentUser.email}</p>
                            <button class="btn-secondary mt-2" onclick="window.activeApp.logout()">Logout Securely</button>
                        </div>
                    </div>
                </section>
            `;
            lucide.createIcons();
        }
    }

    function renderTransactions() {
        const tableBody = document.getElementById('recent-transactions');
        if (!tableBody) return;
        const startIdx = pageState.dashboard * ITEMS_PER_PAGE;
        const paginated = state.transactions.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        tableBody.innerHTML = paginated.map(t => `
            <tr>
                <td>${t.date}</td><td>${t.desc}</td><td>${t.category}</td>
                <td style="color:${t.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}</td>
                <td><span class="status-badge ${t.type}">${t.type === 'profit' ? 'Profit' : 'Expense'}</span></td>
            </tr>
        `).join('');
        document.getElementById('dash-pagination').innerHTML = renderPaginationControls('dash-pagination', state.transactions.length, pageState.dashboard, 'dashboard');
    }

    // --- CHART LOGIC ---
    let dashboardChartInstance = null;
    function renderDashboardChart() {
        const canvas = document.getElementById('profitExpenseChart');
        if (!canvas) return;
        if (dashboardChartInstance) dashboardChartInstance.destroy();

        const monthlyData = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        state.transactions.forEach(t => {
            if (!t.date) return;
            const parts = t.date.split('/');
            const month = parseInt(parts[0]) - 1;
            const year = parts[2];
            const key = `${monthNames[month]} ${year}`;
            if (!monthlyData[key]) monthlyData[key] = { profit: 0, expense: 0, order: new Date(year, month) };
            if (t.type === 'profit') monthlyData[key].profit += t.amount;
            else if (t.type === 'stock-in') monthlyData[key].expense += t.amount;
        });

        const sortedKeys = Object.keys(monthlyData).sort((a, b) => monthlyData[a].order - monthlyData[b].order).slice(-6);
        const labels = sortedKeys.length ? sortedKeys : ['No Data'];
        const profitData = sortedKeys.length ? sortedKeys.map(k => monthlyData[k].profit) : [0];
        const expenseData = sortedKeys.length ? sortedKeys.map(k => monthlyData[k].expense) : [0];

        const ctx = canvas.getContext('2d');
        const pG = ctx.createLinearGradient(0, 0, 0, 300); pG.addColorStop(0, 'rgba(16, 185, 129, 0.9)'); pG.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
        const eG = ctx.createLinearGradient(0, 0, 0, 300); eG.addColorStop(0, 'rgba(239, 68, 68, 0.9)'); eG.addColorStop(1, 'rgba(239, 68, 68, 0.1)');

        dashboardChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels, datasets: [
                    { label: 'Profit (PHP)', data: profitData, backgroundColor: pG, borderRadius: 8 },
                    { label: 'Expenses (PHP)', data: expenseData, backgroundColor: eG, borderRadius: 8 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#fff' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
        });
    }

    // --- GLOBAL SEARCH ---
    const searchForm = document.getElementById('global-search');
    if (searchForm) {
        searchForm.onsubmit = (e) => {
            e.preventDefault();
            searchQuery = document.getElementById('search-input').value;
            if (searchQuery) {
                pageState.search = 0;
                renderPage('search');
            }
        };
    }

    // --- WINDOW ACTIONS ---
    window.activeApp = {
        renderPage: (page) => {
            if (pageState[page] !== undefined) pageState[page] = 0;
            renderPage(page);
            document.querySelectorAll('.nav-item').forEach(i => {
                i.classList.remove('active');
                if (i.getAttribute('data-page') === page) i.classList.add('active');
            });
        },
        changePage: (key, idx) => {
            pageState[key] = idx;
            renderPage(key);
        },
        deleteItem: async (idx) => {
            const sku = state.inventory[idx].sku;
            state.inventory.splice(idx, 1);
            state.transactions = state.transactions.filter(t => !(t.sku === sku && t.type === 'stock-in'));
            await saveData();
            renderPage('inventory');
        },
        deleteTransaction: async (idx) => {
            const t = state.transactions[idx];
            if (t) {
                const item = state.inventory.find(i => i.sku === t.sku);
                if (item) {
                    if (t.type === 'profit') item.stock += (t.qty || 0);
                    else if (t.type === 'stock-in') item.stock -= (t.qty || 0);
                }
                state.transactions.splice(idx, 1);
                await saveData();
                renderPage('dashboard');
            }
        },
        showFilteredList: (type) => {
            filterType = type;
            pageState.filtered = 0;
            renderPage('filtered');
        },
        deleteFilteredTransaction: async (idx) => {
            await window.activeApp.deleteTransaction(idx);
            renderPage('filtered');
        },
        logout: () => {
            auth.signOut();
        }
    };
});
