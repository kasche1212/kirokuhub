document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // App State - Load from LocalStorage or initialize empty
    const state = {
        transactions: JSON.parse(localStorage.getItem('sh_transactions')) || [],
        inventory: JSON.parse(localStorage.getItem('sh_inventory')) || []
    };

    // Pagination State
    const pageState = {
        dashboard: 0,
        inventory: 0,
        finance: 0,
        search: 0,
        settings: 0,
        filtered: 0
    };

    let searchQuery = '';
    let filterType = 'profit'; // 'profit' or 'expense'

    const ITEMS_PER_PAGE = 10;

    // Save helpers
    function saveData() {
        localStorage.setItem('sh_transactions', JSON.stringify(state.transactions));
        localStorage.setItem('sh_inventory', JSON.stringify(state.inventory));
    }

    const navItems = document.querySelectorAll('.nav-item');

    function updateStats() {
        let totalProfit = 0;
        state.transactions.forEach(t => {
            if (t.type === 'profit') totalProfit += t.amount;
        });

        let totalExpense = 0;
        let lowStockItems = [];
        state.inventory.forEach(i => {
            const soldQty = state.transactions
                .filter(t => t.sku === i.sku && t.type === 'profit')
                .reduce((sum, t) => sum + (t.qty || 0), 0);

            const totalPurchased = (i.stock || 0) + soldQty;
            totalExpense += (parseFloat(i.cost || 0) * totalPurchased);

            if (i.stock < 5) {
                lowStockItems.push(i.sku);
            }
        });

        const profitEl = document.querySelector('.gold-gradient .value');
        const expenseEl = document.querySelector('.sunset-gradient .value');
        const stockEl = document.querySelector('.ocean-gradient .value');
        const lowStockTrendEl = document.querySelector('.ocean-gradient .trend');

        if (profitEl) {
            profitEl.innerText = `PHP ${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            profitEl.style.color = 'var(--success)';
        }
        if (expenseEl) {
            expenseEl.innerText = `PHP ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            expenseEl.style.color = 'var(--danger)';
        }
    }

    // --- Pagination Helper ---
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

    // --- Navigation Logic ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const page = item.getAttribute('data-page');
            // Reset page when navigating
            if (pageState[page] !== undefined) pageState[page] = 0;
            renderPage(page);
        });
    });

    function renderPage(page) {
        const contentArea = document.getElementById('content-area');

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
                            <div class="stat-icon clickable" onclick="window.activeApp.showFilteredList('profit')" title="View all profit transactions">
                                <i data-lucide="wallet"></i>
                            </div>
                        </div>
                        <div class="stat-card sunset-gradient">
                            <div class="stat-info">
                                <h3>Total Expense</h3>
                                <p class="value">PHP 0.00</p>
                                <span class="trend down"><i data-lucide="trending-down"></i> Based on Cost</span>
                            </div>
                            <div class="stat-icon clickable" onclick="window.activeApp.showFilteredList('expense')" title="View all expense transactions">
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
                        <div class="card-header">
                            <h2>Recent Activity</h2>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Detail</th><th>Category</th><th>Amount</th><th>Status</th></tr>
                            </thead>
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
            const startIdx = pageState.inventory * ITEMS_PER_PAGE;
            // Reverse inventory for display so latest is on top
            const displayInventory = [...state.inventory].reverse();
            const paginatedInv = displayInventory.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page inventory active">
                    <div class="glass-card mb-2">
                        <h2>Add New Product</h2>
                        <form id="new-item-form" class="automation-flex">
                            <input type="date" id="new-date" class="flex-grow" value="${new Date().toISOString().split('T')[0]}">
                            <input type="text" id="new-sku" placeholder="SKU ID" class="flex-grow">
                            <input type="text" id="new-name" placeholder="Product Name" class="flex-grow">
                            <input type="number" id="new-stock" placeholder="Initial Stock" style="width:100px">
                            <input type="number" id="new-cost" placeholder="Cost (PHP)" style="width:100px">
                            <input type="number" id="new-price" placeholder="Price (PHP)" style="width:100px">
                            <button type="submit" class="btn-primary">Add Item</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <div class="card-header">
                            <h2>Inventory List</h2>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr><th>Entry Date</th><th>SKU</th><th>Product Name</th><th>Stock</th><th>Cost (PHP)</th><th>Price (PHP)</th><th>Expected Profit</th><th>Action</th></tr>
                            </thead>
                            <tbody id="inventory-list">
                                ${displayInventory.length === 0 ? '<tr><td colspan="8" style="text-align:center">No inventory found.</td></tr>' :
                    paginatedInv.map((item) => {
                        const originalIdx = state.inventory.indexOf(item);
                        const profit = (parseFloat(item.price || 0) - parseFloat(item.cost || 0)).toFixed(2);
                        return `
                                    <tr>
                                        <td>${item.date || '-'}</td>
                                        <td>${item.sku}</td>
                                        <td>${item.name}</td>
                                        <td>${item.stock} <span class="trend ${item.stock < 5 ? 'warning' : ''}">${item.stock < 5 ? 'Low Stock' : ''}</span></td>
                                        <td>PHP ${parseFloat(item.cost || 0).toFixed(2)}</td>
                                        <td>PHP ${parseFloat(item.price || 0).toFixed(2)}</td>
                                        <td style="color: var(--success); font-weight: 600;">PHP ${profit}</td>
                                        <td><button class="btn-secondary" onclick="window.activeApp.deleteItem(${originalIdx})">Delete</button></td>
                                    </tr>
                                    `;
                    }).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('inv-pagination', displayInventory.length, pageState.inventory, 'inventory')}
                    </div>
                </section>
            `;

            const itemForm = document.getElementById('new-item-form');
            if (itemForm) {
                itemForm.onsubmit = (e) => {
                    e.preventDefault();
                    const rawDate = document.getElementById('new-date').value;
                    const dateObj = new Date(rawDate);
                    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
                    const sku = document.getElementById('new-sku').value;
                    const name = document.getElementById('new-name').value;
                    const stock = parseInt(document.getElementById('new-stock').value) || 0;
                    const cost = parseFloat(document.getElementById('new-cost').value) || 0;
                    const price = parseFloat(document.getElementById('new-price').value) || 0;
                    if (sku && name) {
                        state.inventory.push({ sku, name, stock, cost, price, date: formattedDate });
                        const newEntry = {
                            id: Date.now(),
                            date: formattedDate,
                            sku: sku,
                            desc: `Restock: ${sku} - ${name}`,
                            qty: stock,
                            type: 'stock-in',
                            amount: (cost * stock),
                            category: 'Inventory'
                        };
                        state.transactions.unshift(newEntry);
                        saveData();
                        pageState.inventory = 0; // Go to first page on add
                        renderPage('inventory');
                        updateStats();
                    }
                };
            }
        } else if (page === 'finance') {
            const allSales = state.transactions
                .map((t, originalIdx) => ({ ...t, originalIdx }))
                .filter(t => t.type === 'profit');

            const startIdx = pageState.finance * ITEMS_PER_PAGE;
            const paginatedSales = allSales.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <h2>Sell Product</h2>
                        <form id="sales-form" class="automation-flex">
                            <input type="date" id="s-date" style="width: 140px" value="${new Date().toISOString().split('T')[0]}">
                            <select id="s-sku" style="width: 130px">
                                <option value="">Select SKU</option>
                                ${state.inventory.map(item => `<option value="${item.sku}">${item.sku}</option>`).join('')}
                            </select>
                            <input type="text" id="s-name" placeholder="Product Name" class="flex-grow" readonly style="background: #ffffff; color: #000000; cursor: not-allowed; font-weight: 600;">
                            <input type="number" id="s-qty" placeholder="Qty" style="width: 90px" min="1">
                            <button type="submit" class="btn-primary">Confirm Sale</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <h2>Sales History</h2>
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Detail (SKU - Product)</th><th>Qty</th><th>Profit (PHP)</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                ${allSales.length === 0 ? '<tr><td colspan="5" style="text-align:center">No sales records.</td></tr>' :
                    paginatedSales.map((t) => `
                                    <tr>
                                        <td>${t.date}</td>
                                        <td>${t.desc}</td>
                                        <td>${t.qty || 1}</td>
                                        <td style="color: var(--success)">PHP ${t.amount.toFixed(2)}</td>
                                        <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${t.originalIdx})">Remove</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('fin-pagination', allSales.length, pageState.finance, 'finance')}
                    </div>
                </section>
            `;

            const skuSelect = document.getElementById('s-sku');
            const nameInput = document.getElementById('s-name');
            const salesForm = document.getElementById('sales-form');

            if (skuSelect) {
                skuSelect.onchange = (e) => {
                    const selectedSku = e.target.value;
                    const item = state.inventory.find(i => i.sku === selectedSku);
                    nameInput.value = item ? item.name : '';
                };
            }

            if (salesForm) {
                salesForm.onsubmit = (e) => {
                    e.preventDefault();
                    const rawDate = document.getElementById('s-date').value;
                    const dateObj = new Date(rawDate);
                    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
                    const sku = skuSelect.value;
                    const qty = parseInt(document.getElementById('s-qty').value);
                    if (!sku) { alert('Please select a SKU first'); return; }
                    if (isNaN(qty) || qty <= 0) { alert('Please enter a valid quantity'); return; }

                    const item = state.inventory.find(i => i.sku === sku);
                    if (item) {
                        if (item.stock < qty) { alert(`Out of stock! Only ${item.stock} left.`); return; }
                        item.stock -= qty;
                        const totalProfit = (parseFloat(item.price) - parseFloat(item.cost)) * qty;
                        const newEntry = {
                            id: Date.now(),
                            date: formattedDate,
                            sku: sku,
                            desc: `${item.sku} - ${item.name}`,
                            qty: qty,
                            type: 'profit',
                            amount: totalProfit,
                            category: 'Sale'
                        };
                        state.transactions.unshift(newEntry);
                        saveData();
                        pageState.finance = 0; // Go to first page
                        renderPage('finance');
                        updateStats();
                    }
                };
            }
        } else if (page === 'search') {
            const query = searchQuery.toLowerCase();
            const results = state.transactions
                .map((t, originalIdx) => ({ ...t, originalIdx }))
                .filter(t =>
                    t.desc.toLowerCase().includes(query) ||
                    (t.sku && t.sku.toLowerCase().includes(query))
                );

            const startIdx = pageState.search * ITEMS_PER_PAGE;
            const paginatedResults = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <div style="display: flex; justify-content: space-between; align-items: center">
                            <h2>Results for: "${searchQuery}"</h2>
                            <button class="btn-secondary" onclick="window.activeApp.renderPage('dashboard')">Back to Dashboard</button>
                        </div>
                        <p style="color: var(--text-muted); font-size: 0.9rem">Found ${results.length} related records</p>
                    </div>
                    
                    <div class="glass-card">
                        <table class="data-table">
                            <thead>
                                <tr><th>Date</th><th>Detail</th><th>Category</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                ${results.length === 0 ? '<tr><td colspan="6" style="text-align:center">No records found for this query.</td></tr>' :
                    paginatedResults.map((t) => `
                                    <tr>
                                        <td>${t.date}</td>
                                        <td>${t.desc}</td>
                                        <td>${t.category}</td>
                                        <td style="color: ${t.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">
                                            ${t.type === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}
                                        </td>
                                        <td><span class="status-badge ${t.type}">${t.type === 'profit' ? 'Profit' : 'Expense'}</span></td>
                                        <td><button class="btn-secondary" onclick="window.activeApp.deleteTransaction(${t.originalIdx})">Remove</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('search-pagination', results.length, pageState.search, 'search')}
                    </div>
                </section>
            `;
        } else if (page === 'settings') {
            contentArea.innerHTML = `
                <section class="page active">
                    <div class="glass-card mb-2">
                        <h2>Data Sync Center</h2>
                        <p style="color: var(--text-muted)">Since you are in local storage mode, use these tools to move your data between devices.</p>
                    </div>

                    <div class="stats-grid">
                        <div class="glass-card" style="text-align: center; padding: 2rem;">
                            <i data-lucide="download" style="width: 48px; height: 48px; color: var(--primary); margin-bottom: 1rem;"></i>
                            <h3>Export Backup</h3>
                            <p style="font-size: 0.85rem; margin-bottom: 1.5rem;">Download all inventory and transactions as a backup file.</p>
                            <button class="btn-primary" style="width: 100%" onclick="window.activeApp.exportData()">Download Now</button>
                        </div>

                        <div class="glass-card" style="text-align: center; padding: 2rem;">
                            <i data-lucide="upload" style="width: 48px; height: 48px; color: var(--success); margin-bottom: 1rem;"></i>
                            <h3>Import Data</h3>
                            <p style="font-size: 0.85rem; margin-bottom: 1.5rem;">Restore data from a backup. Warning: This overrides current device data!</p>
                            <input type="file" id="import-file" style="display: none" accept=".json" onchange="window.activeApp.importData(this)">
                            <button class="btn-secondary" style="width: 100%" onclick="document.getElementById('import-file').click()">Select File</button>
                        </div>
                    </div>

                    <div class="glass-card mt-2">
                        <h3>How to sync with Mobile?</h3>
                        <ol style="color: var(--text-muted); padding-left: 1.2rem; font-size: 0.9rem; line-height: 1.8;">
                            <li>Click <b>"Download Now"</b> on your computer to get a .json file.</li>
                            <li>Send this file to your phone (via Email, WhatsApp, etc.).</li>
                            <li>Open this system on your phone's browser, go to Data Center and click <b>"Select File"</b>.</li>
                            <li><b>Success!</b> Your records are now synchronized across devices.</li>
                        </ol>
                    </div>
                </section>
            `;
            lucide.createIcons();
        } else if (page === 'filtered') {
            // Filter transactions based on filterType
            let filteredResults = [];
            let pageTitle = '';
            let totalAmount = 0;

            if (filterType === 'profit') {
                // Show all profit transactions (sales)
                filteredResults = state.transactions
                    .map((t, originalIdx) => ({ ...t, originalIdx }))
                    .filter(t => t.type === 'profit');
                pageTitle = '💰 All Profit Transactions';
                totalAmount = filteredResults.reduce((sum, t) => sum + t.amount, 0);
            } else {
                // Show all expense transactions (inventory purchases = stock-in)
                filteredResults = state.transactions
                    .map((t, originalIdx) => ({ ...t, originalIdx }))
                    .filter(t => t.type === 'stock-in');
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
                            <button class="btn-secondary" onclick="window.activeApp.renderPage('dashboard')">
                                <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                    
                    <div class="glass-card">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Detail</th>
                                    <th>${filterType === 'profit' ? 'Qty' : 'Category'}</th>
                                    <th>Amount (PHP)</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredResults.length === 0 ?
                    `<tr><td colspan="5" style="text-align:center">No ${filterType} records found.</td></tr>` :
                    paginatedResults.map((t) => `
                                        <tr>
                                            <td>${t.date}</td>
                                            <td>${t.desc}</td>
                                            <td>${filterType === 'profit' ? (t.qty || 1) : t.category}</td>
                                            <td style="color: ${filterType === 'profit' ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                                                ${filterType === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}
                                            </td>
                                            <td><button class="btn-secondary" onclick="window.activeApp.deleteFilteredTransaction(${t.originalIdx})">Remove</button></td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                        ${renderPaginationControls('filtered-pagination', filteredResults.length, pageState.filtered, 'filtered')}
                    </div>
                </section>
            `;
            lucide.createIcons();
        } else {
            contentArea.innerHTML = `<section class="page active"><h2>${page} module is ready for development.</h2></section>`;
        }
    }

    // Global actions
    window.activeApp = {
        renderPage: (page) => {
            if (pageState[page] !== undefined) pageState[page] = 0;
            renderPage(page);
            // Sync nav active state
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(i => {
                i.classList.remove('active');
                if (i.getAttribute('data-page') === page) i.classList.add('active');
            });
        },
        changePage: (key, pageIdx) => {
            pageState[key] = pageIdx;
            if (key === 'dashboard') renderTransactions();
            else renderPage(key);
        },
        deleteItem: (idx) => {
            const item = state.inventory[idx];
            if (item) {
                state.transactions = state.transactions.filter(t => !(t.sku === item.sku && t.type === 'stock-in'));
            }
            state.inventory.splice(idx, 1);
            saveData();
            renderPage('inventory');
            updateStats();
        },
        deleteTransaction: (idx) => {
            const t = state.transactions[idx];
            if (t && (t.type === 'profit' || t.type === 'stock-out' || t.type === 'stock-in')) {
                const targetSku = t.sku || t.desc.split(' - ')[0];
                const item = state.inventory.find(i => i.sku === targetSku);
                if (item) {
                    if (t.type === 'profit' || t.type === 'stock-out') item.stock += (t.qty || t.amount || 0);
                    else if (t.type === 'stock-in') item.stock -= (t.amount || 0);
                }
            }
            state.transactions.splice(idx, 1);
            saveData();
            const activeNavItem = document.querySelector('.nav-item.active');
            if (activeNavItem) {
                renderPage(activeNavItem.getAttribute('data-page'));
            } else {
                renderPage('search');
            }
            updateStats();
        },
        exportData: () => {
            const dataStr = JSON.stringify(state);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = `KirokuHub_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        },
        importData: (input) => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedState = JSON.parse(e.target.result);
                    if (importedState.transactions && importedState.inventory) {
                        state.transactions = importedState.transactions;
                        state.inventory = importedState.inventory;
                        saveData();
                        alert('Data imported successfully! The page will reload.');
                        location.reload();
                    } else {
                        alert('Invalid file format! Please upload a valid KirokuHub backup.');
                    }
                } catch (err) {
                    alert('Failed to parse data. Please ensure the file is complete.');
                }
            };
            reader.readAsText(file);
        },
        showFilteredList: (type) => {
            filterType = type;
            pageState.filtered = 0;
            // Deactivate all nav items
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(i => i.classList.remove('active'));
            renderPage('filtered');
        },
        deleteFilteredTransaction: (idx) => {
            const t = state.transactions[idx];
            if (t && (t.type === 'profit' || t.type === 'stock-out' || t.type === 'stock-in')) {
                const targetSku = t.sku || t.desc.split(' - ')[0];
                const item = state.inventory.find(i => i.sku === targetSku);
                if (item) {
                    if (t.type === 'profit' || t.type === 'stock-out') item.stock += (t.qty || t.amount || 0);
                    else if (t.type === 'stock-in') item.stock -= (t.amount || 0);
                }
            }
            state.transactions.splice(idx, 1);
            saveData();
            renderPage('filtered');
            updateStats();
        }
    };

    // Chart instance holder
    let dashboardChartInstance = null;

    function renderDashboardChart() {
        const canvas = document.getElementById('profitExpenseChart');
        if (!canvas) return;

        // Destroy existing chart if exists
        if (dashboardChartInstance) {
            dashboardChartInstance.destroy();
        }

        // Aggregate data by month
        const monthlyData = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Process transactions to get monthly profit
        state.transactions.forEach(t => {
            if (!t.date) return;
            const dateParts = t.date.split('/');
            if (dateParts.length < 3) return;

            const month = parseInt(dateParts[0]) - 1;
            const year = dateParts[2];
            const key = `${monthNames[month]} ${year}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { profit: 0, expense: 0, order: new Date(year, month) };
            }

            if (t.type === 'profit') {
                monthlyData[key].profit += t.amount;
            }
        });

        // Calculate expense from inventory (cost * quantity purchased)
        state.inventory.forEach(item => {
            if (!item.date) return;
            const dateParts = item.date.split('/');
            if (dateParts.length < 3) return;

            const month = parseInt(dateParts[0]) - 1;
            const year = dateParts[2];
            const key = `${monthNames[month]} ${year}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { profit: 0, expense: 0, order: new Date(year, month) };
            }

            // Calculate total items purchased for this inventory item
            const soldQty = state.transactions
                .filter(t => t.sku === item.sku && t.type === 'profit')
                .reduce((sum, t) => sum + (t.qty || 0), 0);
            const totalPurchased = (item.stock || 0) + soldQty;
            monthlyData[key].expense += (parseFloat(item.cost || 0) * totalPurchased);
        });

        // Sort by date and get last 6 months
        const sortedKeys = Object.keys(monthlyData).sort((a, b) =>
            monthlyData[a].order - monthlyData[b].order
        ).slice(-6);

        const labels = sortedKeys;
        const profitData = sortedKeys.map(k => monthlyData[k].profit);
        const expenseData = sortedKeys.map(k => monthlyData[k].expense);

        // Show placeholder if no data
        if (labels.length === 0) {
            labels.push('No Data');
            profitData.push(0);
            expenseData.push(0);
        }

        const ctx = canvas.getContext('2d');

        // Create gradients for beautiful effect
        const profitGradient = ctx.createLinearGradient(0, 0, 0, 300);
        profitGradient.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
        profitGradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

        const expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
        expenseGradient.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
        expenseGradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');

        dashboardChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Profit (PHP)',
                        data: profitData,
                        backgroundColor: profitGradient,
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'Expenses (PHP)',
                        data: expenseData,
                        backgroundColor: expenseGradient,
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#f8fafc',
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: '500'
                            },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: PHP ${context.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            callback: function (value) {
                                return 'PHP ' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    function renderTransactions() {
        const tableBody = document.getElementById('recent-transactions');
        const paginationBody = document.getElementById('dash-pagination');
        if (!tableBody) return;

        const startIdx = pageState.dashboard * ITEMS_PER_PAGE;
        const paginated = state.transactions.slice(startIdx, startIdx + ITEMS_PER_PAGE);

        if (state.transactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No transaction records found.</td></tr>';
            paginationBody.innerHTML = '';
            return;
        }

        tableBody.innerHTML = paginated.map(t => `
            <tr>
                <td>${t.date}</td>
                <td>${t.desc}</td>
                <td>${t.category}</td>
                <td style="color: ${t.type === 'profit' ? 'var(--success)' : 'var(--danger)'}">
                    ${t.type === 'profit' ? '+' : '-'} PHP ${t.amount.toFixed(2)}
                </td>
                <td><span class="status-badge ${t.type}">${t.type === 'profit' ? 'Profit' : 'Expense'}</span></td>
            </tr>
        `).join('');

        paginationBody.innerHTML = renderPaginationControls('dash-pagination', state.transactions.length, pageState.dashboard, 'dashboard');
    }

    // Global Search Handler
    const searchForm = document.getElementById('global-search');
    const searchInput = document.getElementById('search-input');

    function performSearch() {
        const val = searchInput.value.trim();
        if (val) {
            searchQuery = val;
            pageState.search = 0;
            // Deactivate all nav items
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(i => i.classList.remove('active'));
            renderPage('search');
        }
    }

    if (searchForm && searchInput) {
        searchForm.onsubmit = (e) => {
            e.preventDefault();
            performSearch();
        };

        // Backup: Listen for Enter key directly
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        };
    }

    // Initialize dashboard with chart on page load
    renderPage('dashboard');
});
