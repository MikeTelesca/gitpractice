// =============================================================================
// Ontario Family Finance Dashboard - Main Application
// =============================================================================
(function() {
'use strict';

// ---------------------------------------------------------------------------
// 1. CONSTANTS & CATEGORY DEFINITIONS
// ---------------------------------------------------------------------------
const ONTARIO_HST_RATE = 0.13;
const STORAGE_KEY = 'telesca_finance_data';
const PAGE_SIZE = 50;
const CHART_COLORS = [
    '#4f8ff7','#34d399','#f87171','#fbbf24','#a78bfa',
    '#fb923c','#f472b6','#22d3ee','#84cc16','#e879f9',
    '#64748b','#ef4444'
];

// HST-exempt categories (no HST charged)
const HST_EXEMPT = new Set([
    'Groceries', 'Housing/Rent', 'Childcare/Kids', 'Healthcare',
    'Insurance', 'Bank Fees', 'Income', 'Business Income',
    'Gifts/Donations'
]);

// Category keyword map: [category, [...keywords]]
const CATEGORY_RULES = [
    ['Income', ['payroll','salary','deposit','e-transfer received','etransfer from','government','cerb','ccb','gst credit','trillium','ei benefit','cpp benefit','oas']],
    ['Business Income', ['invoice paid','client payment','revenue','consulting fee']],
    ['Housing/Rent', ['rent','mortgage','property tax','condo fee','condo corp','housing']],
    ['Utilities', ['hydro','enbridge','gas bill','water bill','internet','bell canada','rogers','telus','fido','koodo','virgin mobile','cogeco','start.ca','teksavvy']],
    ['Groceries', ['loblaws','loblaw','metro ','sobeys','food basics','freshco','walmart super','no frills','costco','farm boy','whole foods','longos','fortinos','zehrs','valu-mart','real canadian','t&t','nations fresh','oceans']],
    ['Dining/Restaurants', ['restaurant','uber eat','skip the dish','doordash','mcdonald','tim horton','starbucks','pizza','subway','a&w ','wendys','wendy\'s','popeyes','harvey\'s','swiss chalet','boston pizza','jack astor','kelsey','milestones','the keg','montana','earls','cactus club','east side mario','mr sub','mary brown','burrito','sushi','thai','pho','shawarma','panera','chipotle']],
    ['Transportation', ['gas station','petro-canada','petro canada','shell ','esso ','sunoco','ultramar','pioneer','uber ride','uber trip','lyft','presto','go transit','ttc','via rail','parking','impark','green p','indigo park','car wash','407 etr','highway']],
    ['Insurance', ['insurance','manulife','sun life','great-west','great west','desjardins ins','intact','aviva','belair','wawanesa','cooperators','td insurance','rbc insurance']],
    ['Healthcare', ['pharmacy','shoppers drug','rexall','pharma','dental','dentist','doctor','clinic','hospital','optom','physio','chiro','massage therapy','psycholog','counsel','medical','lifelab','dynacare']],
    ['Childcare/Kids', ['daycare','childcare','toys r us','children\'s place','gap kids','old navy kids','school fee','tuition','kumon','sylvan','camp ']],
    ['Subscriptions', ['netflix','spotify','disney+','disney plus','amazon prime','apple.com','apple music','google storage','youtube','crave','paramount+','hulu','adobe','microsoft 365','office 365','dropbox','icloud','playstation','xbox','nintendo','audible','kindle']],
    ['Shopping', ['amazon.ca','amazon','walmart','canadian tire','home depot','ikea','winners','marshalls','homesense','dollarama','indigo','chapters','best buy','the bay','hudson bay','staples','michael','linen chest','bed bath','structube','wayfair','the brick','leon\'s','apple store']],
    ['Personal Care', ['salon','barber','hair','spa ','beauty','sephora','bath & body','lush ','nail','wax ']],
    ['Fitness/Recreation', ['gym','goodlife','fit4less','anytime fitness','ymca','recreation','sport chek','sport','golf','swimming','yoga','crossfit','orangetheory']],
    ['Pets', ['pet ','veterinar','vet ','petsmart','pet valu','global pet','pet food']],
    ['Alcohol/Cannabis', ['lcbo','beer store','wine rack','wine ','brewery','ocs ','cannabis','spiritleaf','tokyo smoke']],
    ['Entertainment', ['cinema','cineplex','ticket','ticketmaster','event','concert','amusement','wonderland','dave & buster','bowling','arcade','museum','gallery','zoo ']],
    ['Travel', ['hotel','airbnb','expedia','booking.com','airline','air canada','westjet','porter air','flair','trip','resort','cruise','travel']],
    ['Gifts/Donations', ['gift','donation','charity','church','tithe','united way','red cross','salvation army']],
    ['Bank Fees', ['bank fee','service charge','service fee','interest charge','nsf','overdraft','monthly fee','annual fee']],
    // Business expense sub-categories
    ['Office Supplies', ['staples bus','office supply','paper','ink ','toner']],
    ['Professional Fees', ['legal fee','lawyer','accountant','cpa ','bookkeeper','consultant fee']],
    ['Advertising', ['facebook ads','google ads','advertising','marketing','ad spend','promotion']],
    ['Business Meals', ['business lunch','client dinner','business meal']],
    ['Vehicle/Auto', ['auto repair','mechanic','oil change','tire ','midas','mr lube','active green']],
    ['Software/Tech', ['github','aws ','azure','digital ocean','hosting','domain','saas','software','slack','zoom','notion','figma','canva']],
    ['Contractor Fees', ['contractor','subcontract','freelance','fiverr','upwork']],
];

// Budget type: need, want, or savings
const BUDGET_TYPE = {
    'Housing/Rent': 'need', 'Utilities': 'need', 'Groceries': 'need',
    'Transportation': 'need', 'Insurance': 'need', 'Healthcare': 'need',
    'Childcare/Kids': 'need', 'Vehicle/Auto': 'need',
    'Dining/Restaurants': 'want', 'Shopping': 'want', 'Subscriptions': 'want',
    'Entertainment': 'want', 'Fitness/Recreation': 'want', 'Personal Care': 'want',
    'Alcohol/Cannabis': 'want', 'Travel': 'want', 'Pets': 'want',
    'Gifts/Donations': 'want',
    'Bank Fees': 'need',
    'Other': 'want',
};

// CRA T2125 line mapping for business expenses
const CRA_LINES = {
    'Office Supplies': { line: '8811', label: 'Office expenses' },
    'Professional Fees': { line: '8860', label: 'Professional fees' },
    'Advertising': { line: '8520', label: 'Advertising' },
    'Business Meals': { line: '8523', label: 'Meals & entertainment (50%)' },
    'Travel': { line: '8710', label: 'Travel' },
    'Vehicle/Auto': { line: '9281', label: 'Motor vehicle expenses' },
    'Utilities': { line: '8945', label: 'Telephone & utilities' },
    'Software/Tech': { line: '8811', label: 'Office expenses (tech)' },
    'Insurance': { line: '8690', label: 'Insurance' },
    'Contractor Fees': { line: '8810', label: 'Subcontracts' },
    'Other': { line: '9270', label: 'Other expenses' },
};

// ---------------------------------------------------------------------------
// 2. STATE
// ---------------------------------------------------------------------------
let allTransactions = [];
let activeProfile = 'combined';
let charts = {};
let sortState = { col: 'date', dir: 'desc' };
let currentPage = 1;
let pendingFiles = { mike: [], julia: [], business: [] };

// ---------------------------------------------------------------------------
// 3. CSV PARSER
// ---------------------------------------------------------------------------
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Parse header
    const header = splitCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Detect column indices
    const dateIdx = header.findIndex(h => /date|posted|transaction date/i.test(h));
    const descIdx = header.findIndex(h => /desc|memo|detail|narrative|payee|transaction|name/i.test(h));
    const amtIdx = header.findIndex(h => /^amount$|^amt$/i.test(h));
    const debitIdx = header.findIndex(h => /debit|withdrawal|out/i.test(h));
    const creditIdx = header.findIndex(h => /credit|deposit|in/i.test(h));

    if (dateIdx === -1) return [];
    const useDebitCredit = amtIdx === -1 && debitIdx !== -1;
    const descI = descIdx !== -1 ? descIdx : (dateIdx === 0 ? 1 : 0);

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i]);
        if (cols.length < 2) continue;

        const dateStr = cols[dateIdx];
        const date = parseDate(dateStr);
        if (!date) continue;

        const description = (cols[descI] || '').trim();

        let amount;
        if (useDebitCredit) {
            const debit = parseFloat((cols[debitIdx] || '0').replace(/[$,]/g, '')) || 0;
            const credit = parseFloat((cols[creditIdx] || '0').replace(/[$,]/g, '')) || 0;
            amount = credit - debit;
        } else if (amtIdx !== -1) {
            const raw = (cols[amtIdx] || '0').replace(/[$,]/g, '').replace(/[()]/g, m => m === '(' ? '-' : '');
            amount = parseFloat(raw) || 0;
        } else {
            // Try last numeric column
            for (let c = cols.length - 1; c >= 0; c--) {
                const v = parseFloat(cols[c].replace(/[$,]/g, ''));
                if (!isNaN(v)) { amount = v; break; }
            }
            if (amount === undefined) continue;
        }

        rows.push({ date, description, amount });
    }
    return rows;
}

function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseDate(str) {
    if (!str) return null;
    str = str.trim().replace(/"/g, '');

    // Try ISO: YYYY-MM-DD or YYYY/MM/DD
    let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    // Try MM/DD/YYYY or DD/MM/YYYY
    m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) {
        const a = +m[1], b = +m[2], y = +m[3];
        // If first > 12, it's DD/MM/YYYY
        if (a > 12) return new Date(y, b - 1, a);
        return new Date(y, a - 1, b);
    }

    // Try named month: "Jan 15, 2024" or "15 Jan 2024"
    m = str.match(/(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/);
    if (m) {
        const d = new Date(m[1] + ' ' + m[2] + ', ' + m[3]);
        if (!isNaN(d)) return d;
    }

    const d = new Date(str);
    return isNaN(d) ? null : d;
}

// ---------------------------------------------------------------------------
// 4. CATEGORIZER
// ---------------------------------------------------------------------------
function categorize(description, owner) {
    const lower = description.toLowerCase();
    for (const [cat, keywords] of CATEGORY_RULES) {
        // Skip business categories for personal, and vice-versa
        if (owner !== 'business' && ['Business Income','Office Supplies','Professional Fees','Advertising','Business Meals','Software/Tech','Contractor Fees'].includes(cat)) continue;
        if (owner === 'business' && cat === 'Income') continue;
        for (const kw of keywords) {
            if (lower.includes(kw)) return cat;
        }
    }
    return 'Other';
}

// ---------------------------------------------------------------------------
// 5. HST CALCULATOR
// ---------------------------------------------------------------------------
function calcHST(amount, category) {
    if (HST_EXEMPT.has(category)) return 0;
    // HST is included in the price, so extract it
    return Math.abs(amount) - Math.abs(amount) / (1 + ONTARIO_HST_RATE);
}

// ---------------------------------------------------------------------------
// 6. PERSISTENCE (localStorage)
// ---------------------------------------------------------------------------
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allTransactions));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            allTransactions = JSON.parse(raw).map(t => ({
                ...t,
                date: new Date(t.date)
            }));
            return allTransactions.length > 0;
        }
    } catch (e) {
        console.warn('Could not load from localStorage:', e);
    }
    return false;
}

function clearData() {
    localStorage.removeItem(STORAGE_KEY);
    allTransactions = [];
}

// ---------------------------------------------------------------------------
// 7. FILTERING
// ---------------------------------------------------------------------------
function getFiltered(profile) {
    let txns = allTransactions;
    if (profile && profile !== 'combined') {
        txns = txns.filter(t => t.owner === profile);
    }
    return txns;
}

function getMonths(txns) {
    const set = new Set();
    txns.forEach(t => set.add(formatMonth(t.date)));
    return [...set].sort();
}

function formatMonth(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function formatCurrency(n) {
    return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// 8. ANALYTICS ENGINE
// ---------------------------------------------------------------------------
function computeAnalytics(txns) {
    const months = getMonths(txns);
    const numMonths = months.length || 1;

    const totalIncome = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const monthlyIncome = totalIncome / numMonths;
    const monthlyExpenses = totalExpenses / numMonths;
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    // Category breakdown (expenses only)
    const catTotals = {};
    txns.filter(t => t.amount < 0).forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + Math.abs(t.amount);
    });

    const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    // Monthly breakdown
    const monthlyData = {};
    txns.forEach(t => {
        const m = formatMonth(t.date);
        if (!monthlyData[m]) monthlyData[m] = { income: 0, expenses: 0 };
        if (t.amount > 0) monthlyData[m].income += t.amount;
        else monthlyData[m].expenses += Math.abs(t.amount);
    });

    // HST totals
    let hstPaid = 0;
    let hstCollected = 0;
    const hstByCategory = {};
    txns.forEach(t => {
        const hst = calcHST(t.amount, t.category);
        if (t.amount < 0) {
            hstPaid += hst;
            hstByCategory[t.category] = (hstByCategory[t.category] || 0) + hst;
        } else if (t.owner === 'business') {
            hstCollected += hst;
        }
    });

    // Date range
    const dates = txns.map(t => t.date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
        totalIncome, totalExpenses, monthlyIncome, monthlyExpenses,
        monthlySavings, savingsRate, catTotals, topCategory,
        monthlyData, months, numMonths,
        hstPaid, hstCollected, hstByCategory,
        minDate, maxDate
    };
}

// ---------------------------------------------------------------------------
// 9. BUDGET GENERATOR
// ---------------------------------------------------------------------------
function generateBudget(analytics) {
    const { monthlyIncome, catTotals, numMonths } = analytics;
    const needsBudget = monthlyIncome * 0.50;
    const wantsBudget = monthlyIncome * 0.30;

    const categories = Object.keys(catTotals).filter(c =>
        c !== 'Income' && c !== 'Business Income'
    ).sort((a, b) => catTotals[b] - catTotals[a]);

    const needs = categories.filter(c => BUDGET_TYPE[c] === 'need' || (!BUDGET_TYPE[c] && false));
    const wants = categories.filter(c => BUDGET_TYPE[c] === 'want' || BUDGET_TYPE[c] === undefined);

    // Distribute budget proportionally within needs/wants
    const needsTotal = needs.reduce((s, c) => s + catTotals[c], 0) / numMonths;
    const wantsTotal = wants.reduce((s, c) => s + catTotals[c], 0) / numMonths;

    const rows = [];

    function addRows(cats, budgetPool, type) {
        const total = cats.reduce((s, c) => s + catTotals[c], 0) / numMonths;
        cats.forEach(cat => {
            const current = catTotals[cat] / numMonths;
            // Proportional budget allocation
            const recommended = total > 0 ? (current / total) * budgetPool : budgetPool / (cats.length || 1);
            const diff = recommended - current;
            const pctOver = current > 0 ? ((current - recommended) / recommended) * 100 : 0;

            let status = 'ok';
            if (pctOver > 25) status = 'over';
            else if (pctOver > 10) status = 'warning';

            rows.push({ category: cat, type, current, recommended, diff, status });
        });
    }

    addRows(needs, needsBudget, 'Need');
    addRows(wants, wantsBudget, 'Want');

    return rows;
}

// ---------------------------------------------------------------------------
// 10. CUT RECOMMENDATIONS ENGINE
// ---------------------------------------------------------------------------
function generateCuts(analytics, budgetRows) {
    const { monthlyExpenses, catTotals, numMonths } = analytics;
    const cuts = [];

    function addCut(title, description, savings, priority) {
        cuts.push({ title, description, savings, priority });
    }

    const monthlyCats = {};
    Object.entries(catTotals).forEach(([c, v]) => { monthlyCats[c] = v / numMonths; });

    // Subscriptions
    if (monthlyCats['Subscriptions'] > 100) {
        const save = monthlyCats['Subscriptions'] * 0.4;
        addCut('Reduce Subscriptions',
            `You're spending ${formatCurrency(monthlyCats['Subscriptions'])}/mo on subscriptions. Audit and cancel unused services. Consider sharing family plans.`,
            save, save > 200 ? 'high' : 'medium');
    }

    // Dining
    const diningPct = (monthlyCats['Dining/Restaurants'] || 0) / monthlyExpenses * 100;
    if (diningPct > 15) {
        const save = monthlyCats['Dining/Restaurants'] * 0.35;
        addCut('Cut Dining Out',
            `Dining is ${diningPct.toFixed(1)}% of expenses (${formatCurrency(monthlyCats['Dining/Restaurants'])}/mo). Try meal prepping and limit eating out to weekends.`,
            save, save > 200 ? 'high' : 'medium');
    } else if (monthlyCats['Dining/Restaurants'] > 200) {
        const save = monthlyCats['Dining/Restaurants'] * 0.25;
        addCut('Reduce Dining Out',
            `Spending ${formatCurrency(monthlyCats['Dining/Restaurants'])}/mo on dining. Set a weekly dining budget of ${formatCurrency(monthlyCats['Dining/Restaurants'] * 0.75 / 4)}.`,
            save, 'medium');
    }

    // Shopping
    const shopPct = (monthlyCats['Shopping'] || 0) / monthlyExpenses * 100;
    if (shopPct > 10) {
        const save = monthlyCats['Shopping'] * 0.30;
        addCut('Reduce Discretionary Shopping',
            `Shopping is ${shopPct.toFixed(1)}% of expenses. Implement a 48-hour rule before non-essential purchases.`,
            save, save > 200 ? 'high' : 'medium');
    }

    // Alcohol/Cannabis
    if (monthlyCats['Alcohol/Cannabis'] > 50) {
        const save = monthlyCats['Alcohol/Cannabis'] * 0.50;
        addCut('Reduce Alcohol/Cannabis Spending',
            `Spending ${formatCurrency(monthlyCats['Alcohol/Cannabis'])}/mo. This is fully discretionary. Cut by 50% for significant savings.`,
            save, save > 200 ? 'high' : 'medium');
    }

    // Bank Fees
    if (monthlyCats['Bank Fees'] > 10) {
        addCut('Eliminate Bank Fees',
            `Paying ${formatCurrency(monthlyCats['Bank Fees'])}/mo in bank fees. Switch to no-fee accounts (Simplii, Tangerine) or maintain minimum balances.`,
            monthlyCats['Bank Fees'], monthlyCats['Bank Fees'] > 50 ? 'high' : 'low');
    }

    // Entertainment
    const entPct = (monthlyCats['Entertainment'] || 0) / monthlyExpenses * 100;
    if (entPct > 5) {
        const save = monthlyCats['Entertainment'] * 0.30;
        addCut('Cut Entertainment Costs',
            `Entertainment is ${entPct.toFixed(1)}% of expenses. Look for free community events, matinee shows, and loyalty programs.`,
            save, 'medium');
    }

    // Transportation
    if (monthlyCats['Transportation'] > 500) {
        const save = monthlyCats['Transportation'] * 0.20;
        addCut('Optimize Transportation',
            `Spending ${formatCurrency(monthlyCats['Transportation'])}/mo on transportation. Consider carpooling, transit pass, or combining errands to reduce fuel costs.`,
            save, save > 200 ? 'high' : 'medium');
    }

    // Personal Care
    if (monthlyCats['Personal Care'] > 150) {
        const save = monthlyCats['Personal Care'] * 0.30;
        addCut('Reduce Personal Care Costs',
            `${formatCurrency(monthlyCats['Personal Care'])}/mo on personal care. Consider less frequent appointments or more affordable salons.`,
            save, 'low');
    }

    // Travel
    if (monthlyCats['Travel'] > 300) {
        const save = monthlyCats['Travel'] * 0.25;
        addCut('Plan Travel Smarter',
            `Spending ${formatCurrency(monthlyCats['Travel'])}/mo avg on travel. Book further in advance, use points/miles, and travel off-peak.`,
            save, 'medium');
    }

    // Groceries optimization (not cutting, but optimizing)
    if (monthlyCats['Groceries'] > 800) {
        const save = monthlyCats['Groceries'] * 0.15;
        addCut('Optimize Grocery Spending',
            `${formatCurrency(monthlyCats['Groceries'])}/mo on groceries. Use Flipp for flyer deals, buy in bulk at Costco, and plan weekly meals.`,
            save, save > 200 ? 'high' : 'medium');
    }

    // Budget overages
    budgetRows.filter(r => r.status === 'over').forEach(r => {
        const existing = cuts.find(c => c.title.toLowerCase().includes(r.category.toLowerCase()));
        if (!existing) {
            const save = r.current - r.recommended;
            if (save > 25) {
                addCut(`Reduce ${r.category}`,
                    `${r.category} is ${formatCurrency(r.current)}/mo vs budget of ${formatCurrency(r.recommended)}/mo. Reduce by ${formatCurrency(save)} to meet your 50/30/20 targets.`,
                    save, save > 200 ? 'high' : save > 50 ? 'medium' : 'low');
            }
        }
    });

    // Sort by savings descending
    cuts.sort((a, b) => b.savings - a.savings);
    return cuts;
}

// ---------------------------------------------------------------------------
// 11. CRA T2125 TAX TABLE (Business only)
// ---------------------------------------------------------------------------
function generateCRATax(txns) {
    const bizExpenses = txns.filter(t => t.owner === 'business' && t.amount < 0);
    const lineItems = {};

    bizExpenses.forEach(t => {
        const cra = CRA_LINES[t.category] || CRA_LINES['Other'];
        const key = cra.line + '-' + cra.label;
        if (!lineItems[key]) {
            lineItems[key] = { line: cra.line, label: cra.label, total: 0, hst: 0, category: t.category };
        }
        const amt = Math.abs(t.amount);
        const hst = calcHST(t.amount, t.category);
        lineItems[key].total += amt;
        lineItems[key].hst += hst;
    });

    return Object.values(lineItems).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// 12. CHART RENDERING
// ---------------------------------------------------------------------------
function destroyCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
}

function renderCharts(analytics, profile) {
    destroyCharts();
    const { catTotals, monthlyData, months } = analytics;

    // --- Category Donut ---
    const catEntries = Object.entries(catTotals)
        .filter(([c]) => c !== 'Income' && c !== 'Business Income')
        .sort((a, b) => b[1] - a[1]);

    const topCats = catEntries.slice(0, 10);
    const otherTotal = catEntries.slice(10).reduce((s, [, v]) => s + v, 0);
    if (otherTotal > 0) topCats.push(['Other', otherTotal]);

    const catCtx = document.getElementById('category-chart').getContext('2d');
    charts.category = new Chart(catCtx, {
        type: 'doughnut',
        data: {
            labels: topCats.map(([c]) => c),
            datasets: [{
                data: topCats.map(([, v]) => v),
                backgroundColor: CHART_COLORS.slice(0, topCats.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#e4e6ed', padding: 8, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // --- Monthly Bar Chart ---
    const sortedMonths = months.sort();
    const monthCtx = document.getElementById('monthly-chart').getContext('2d');
    charts.monthly = new Chart(monthCtx, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'Income',
                    data: sortedMonths.map(m => (monthlyData[m] || {}).income || 0),
                    backgroundColor: '#34d399'
                },
                {
                    label: 'Expenses',
                    data: sortedMonths.map(m => (monthlyData[m] || {}).expenses || 0),
                    backgroundColor: '#f87171'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e4e6ed' } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
            },
            scales: {
                x: { ticks: { color: '#8b8fa3', maxRotation: 45 }, grid: { color: '#2a2e3a' } },
                y: { ticks: { color: '#8b8fa3', callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#2a2e3a' } }
            }
        }
    });

    // --- Trend Line ---
    const trendCtx = document.getElementById('trend-chart').getContext('2d');
    const expenseData = sortedMonths.map(m => (monthlyData[m] || {}).expenses || 0);
    // 3-month moving average
    const movingAvg = expenseData.map((v, i) => {
        const start = Math.max(0, i - 2);
        const slice = expenseData.slice(start, i + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    charts.trend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'Monthly Expenses',
                    data: expenseData,
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248,113,113,0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: '3-Month Average',
                    data: movingAvg,
                    borderColor: '#fbbf24',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e4e6ed' } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
            },
            scales: {
                x: { ticks: { color: '#8b8fa3', maxRotation: 45 }, grid: { color: '#2a2e3a' } },
                y: { ticks: { color: '#8b8fa3', callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#2a2e3a' } }
            }
        }
    });

    // --- Comparison Bar (by owner per category) ---
    const compCtx = document.getElementById('comparison-chart').getContext('2d');
    const owners = ['mike', 'julia', 'business'];
    const ownerColors = { mike: '#4f8ff7', julia: '#f472b6', business: '#fbbf24' };
    const allCats = [...new Set(allTransactions.filter(t => t.amount < 0).map(t => t.category))]
        .filter(c => c !== 'Income' && c !== 'Business Income');
    const topCompCats = allCats.sort((a, b) => {
        const aTotal = allTransactions.filter(t => t.category === a && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const bTotal = allTransactions.filter(t => t.category === b && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        return bTotal - aTotal;
    }).slice(0, 8);

    charts.comparison = new Chart(compCtx, {
        type: 'bar',
        data: {
            labels: topCompCats,
            datasets: owners.map(owner => ({
                label: owner.charAt(0).toUpperCase() + owner.slice(1),
                data: topCompCats.map(cat => {
                    return allTransactions
                        .filter(t => t.owner === owner && t.category === cat && t.amount < 0)
                        .reduce((s, t) => s + Math.abs(t.amount), 0);
                }),
                backgroundColor: ownerColors[owner]
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e4e6ed' } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
            },
            scales: {
                x: { ticks: { color: '#8b8fa3', maxRotation: 45, font: { size: 10 } }, grid: { color: '#2a2e3a' } },
                y: { ticks: { color: '#8b8fa3', callback: v => '$' + (v / 1000).toFixed(1) + 'k' }, grid: { color: '#2a2e3a' } }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// 13. DOM RENDERERS
// ---------------------------------------------------------------------------
function renderKPIs(analytics, profile) {
    const { monthlyIncome, monthlyExpenses, monthlySavings, savingsRate, topCategory, minDate, maxDate } = analytics;

    document.getElementById('kpi-income').textContent = formatCurrency(monthlyIncome);
    document.getElementById('kpi-expenses').textContent = formatCurrency(monthlyExpenses);

    const savingsEl = document.getElementById('kpi-savings');
    savingsEl.textContent = (monthlySavings < 0 ? '-' : '') + formatCurrency(monthlySavings);
    savingsEl.className = 'kpi-value ' + (monthlySavings >= 0 ? 'positive' : 'negative');

    const rateEl = document.getElementById('kpi-rate');
    rateEl.textContent = savingsRate.toFixed(1) + '%';
    rateEl.className = 'kpi-value ' + (savingsRate >= 15 ? 'positive' : savingsRate >= 0 ? '' : 'negative');

    document.getElementById('kpi-top-cat').textContent = topCategory ? topCategory[0] : '-';
    document.getElementById('kpi-period').textContent = formatDate(minDate) + ' to ' + formatDate(maxDate);

    const labels = { combined: 'Combined', mike: 'Mike', julia: 'Julia', business: 'Business' };
    document.getElementById('kpi-profile-label').textContent = labels[profile] || '';
}

function renderHST(analytics, profile) {
    const { hstPaid, hstCollected, hstByCategory } = analytics;
    const netHST = hstCollected - hstPaid;
    const itc = profile === 'business' || activeProfile === 'combined' ? hstPaid : 0;

    document.getElementById('hst-paid').textContent = formatCurrency(hstPaid);
    document.getElementById('hst-collected').textContent = formatCurrency(hstCollected);

    const netEl = document.getElementById('hst-net');
    netEl.textContent = (netHST < 0 ? '(' : '') + formatCurrency(netHST) + (netHST < 0 ? ')' : '');
    netEl.className = 'kpi-value ' + (netHST <= 0 ? 'positive' : 'negative');

    document.getElementById('hst-itc').textContent = formatCurrency(itc);

    // HST breakdown table
    const breakdownEl = document.getElementById('hst-breakdown');
    const entries = Object.entries(hstByCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) { breakdownEl.innerHTML = ''; return; }

    let html = '<table><thead><tr><th>Category</th><th>HST Paid (Est.)</th><th>HST Exempt?</th></tr></thead><tbody>';
    entries.forEach(([cat, hst]) => {
        html += `<tr><td>${cat}</td><td>${formatCurrency(hst)}</td><td>${HST_EXEMPT.has(cat) ? 'Yes' : 'No'}</td></tr>`;
    });
    html += '</tbody></table>';
    breakdownEl.innerHTML = html;

    const label = { combined: 'Combined', mike: 'Mike', julia: 'Julia', business: 'Business' };
    document.getElementById('hst-profile-label').textContent = label[profile] || '';
}

function renderBudget(budgetRows, profile) {
    const tbody = document.getElementById('budget-tbody');
    const tfoot = document.getElementById('budget-tfoot');
    let html = '';
    let totalCurrent = 0, totalRec = 0;

    budgetRows.forEach(r => {
        totalCurrent += r.current;
        totalRec += r.recommended;
        const diffStr = (r.diff >= 0 ? '+' : '-') + formatCurrency(r.diff);
        const diffClass = r.diff >= 0 ? 'amount-positive' : 'amount-negative';
        html += `<tr>
            <td>${r.category}</td>
            <td>${r.type}</td>
            <td>${formatCurrency(r.current)}</td>
            <td>${formatCurrency(r.recommended)}</td>
            <td class="${diffClass}">${diffStr}</td>
            <td><span class="status-badge ${r.status}">${r.status === 'ok' ? 'On Track' : r.status === 'warning' ? 'Watch' : 'Over Budget'}</span></td>
        </tr>`;
    });

    tbody.innerHTML = html;
    const totalDiff = totalRec - totalCurrent;
    tfoot.innerHTML = `<tr>
        <td colspan="2"><strong>Total</strong></td>
        <td>${formatCurrency(totalCurrent)}</td>
        <td>${formatCurrency(totalRec)}</td>
        <td class="${totalDiff >= 0 ? 'amount-positive' : 'amount-negative'}">${(totalDiff >= 0 ? '+' : '-') + formatCurrency(totalDiff)}</td>
        <td></td>
    </tr>`;

    const label = { combined: 'Combined', mike: 'Mike', julia: 'Julia', business: 'Business' };
    document.getElementById('budget-profile-label').textContent = label[profile] || '';
}

function renderCuts(cuts, profile) {
    const list = document.getElementById('cuts-list');
    let html = '';
    let totalSavings = 0;

    cuts.forEach((cut, i) => {
        totalSavings += cut.savings;
        html += `<div class="cut-item">
            <div class="cut-priority ${cut.priority}">${i + 1}</div>
            <div class="cut-details">
                <h4>${cut.title}</h4>
                <p>${cut.description}</p>
            </div>
            <div class="cut-savings">-${formatCurrency(cut.savings)}/mo</div>
        </div>`;
    });

    if (cuts.length === 0) {
        html = '<p style="color: var(--green); padding: 16px;">Great job! No major areas of concern found.</p>';
    }

    list.innerHTML = html;
    document.getElementById('total-potential-savings').textContent = formatCurrency(totalSavings) + '/mo';
    const label = { combined: 'Combined', mike: 'Mike', julia: 'Julia', business: 'Business' };
    document.getElementById('cuts-profile-label').textContent = label[profile] || '';
}

function renderCRATax(txns) {
    const items = generateCRATax(txns);
    const tbody = document.getElementById('tax-tbody');
    const tfoot = document.getElementById('tax-tfoot');

    let html = '';
    let grandTotal = 0, grandHST = 0;

    items.forEach(item => {
        const net = item.total - item.hst;
        grandTotal += item.total;
        grandHST += item.hst;
        // Meals are 50% deductible
        const deductible = item.label.includes('50%') ? net * 0.5 : net;
        html += `<tr>
            <td>${item.line}</td>
            <td>${item.label}</td>
            <td>${formatCurrency(item.total)}</td>
            <td>${formatCurrency(item.hst)}</td>
            <td>${formatCurrency(deductible)}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
    tfoot.innerHTML = `<tr>
        <td colspan="2"><strong>Total</strong></td>
        <td>${formatCurrency(grandTotal)}</td>
        <td>${formatCurrency(grandHST)}</td>
        <td>${formatCurrency(grandTotal - grandHST)}</td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// 14. TRANSACTION TABLE
// ---------------------------------------------------------------------------
function renderTransactions() {
    let txns = getFiltered(activeProfile);

    // Apply filters
    const search = document.getElementById('search-input').value.toLowerCase();
    const catFilter = document.getElementById('category-filter').value;
    const monthFilter = document.getElementById('month-filter').value;
    const ownerFilter = document.getElementById('owner-filter').value;

    if (search) txns = txns.filter(t => t.description.toLowerCase().includes(search));
    if (catFilter) txns = txns.filter(t => t.category === catFilter);
    if (monthFilter) txns = txns.filter(t => formatMonth(t.date) === monthFilter);
    if (ownerFilter) txns = txns.filter(t => t.owner === ownerFilter);

    // Sort
    txns.sort((a, b) => {
        let va = a[sortState.col], vb = b[sortState.col];
        if (sortState.col === 'date') { va = va.getTime(); vb = vb.getTime(); }
        if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
        if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
        if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginate
    const totalPages = Math.ceil(txns.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageTxns = txns.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('txn-tbody');
    let html = '';
    pageTxns.forEach(t => {
        const amtClass = t.amount < 0 ? 'amount-negative' : 'amount-positive';
        const hst = calcHST(t.amount, t.category);
        const ownerLabel = { mike: 'Mike', julia: 'Julia', business: 'Business' };
        html += `<tr>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td class="${amtClass}">${t.amount < 0 ? '-' : ''}${formatCurrency(t.amount)}</td>
            <td><span class="category-tag">${t.category}</span></td>
            <td>${hst > 0.01 ? formatCurrency(hst) : '-'}</td>
            <td>${ownerLabel[t.owner] || t.owner}</td>
        </tr>`;
    });
    tbody.innerHTML = html;

    // Pagination controls
    const pagEl = document.getElementById('pagination');
    let pagHtml = '';
    if (totalPages > 1) {
        if (currentPage > 1) pagHtml += `<button data-page="${currentPage - 1}">Prev</button>`;
        const startP = Math.max(1, currentPage - 3);
        const endP = Math.min(totalPages, currentPage + 3);
        for (let p = startP; p <= endP; p++) {
            pagHtml += `<button data-page="${p}" class="${p === currentPage ? 'active' : ''}">${p}</button>`;
        }
        if (currentPage < totalPages) pagHtml += `<button data-page="${currentPage + 1}">Next</button>`;
    }
    pagHtml += `<span style="color: var(--text-muted); font-size: 0.8rem; align-self: center; margin-left: 8px;">${txns.length} transactions</span>`;
    pagEl.innerHTML = pagHtml;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function populateFilters() {
    const txns = getFiltered(activeProfile);
    const cats = [...new Set(txns.map(t => t.category))].sort();
    const months = getMonths(txns);

    const catSel = document.getElementById('category-filter');
    const monthSel = document.getElementById('month-filter');

    const catVal = catSel.value;
    const monthVal = monthSel.value;

    catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}" ${c === catVal ? 'selected' : ''}>${c}</option>`).join('');
    monthSel.innerHTML = '<option value="">All Months</option>' + months.map(m => `<option value="${m}" ${m === monthVal ? 'selected' : ''}>${m}</option>`).join('');
}

// ---------------------------------------------------------------------------
// 15. DEMO DATA GENERATOR
// ---------------------------------------------------------------------------
function generateDemoData() {
    const txns = [];
    const startDate = new Date(2024, 3, 1); // April 2024
    const endDate = new Date(2026, 3, 7);   // April 2026

    function randBetween(min, max) { return Math.random() * (max - min) + min; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

    // Mike's recurring income - bi-weekly
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 14)) {
        txns.push({ date: new Date(d), description: 'PAYROLL DEPOSIT - EMPLOYER INC', amount: randBetween(2600, 2900), owner: 'mike' });
    }

    // Julia's recurring income - bi-weekly
    for (let d = addDays(startDate, 7); d <= endDate; d = addDays(d, 14)) {
        txns.push({ date: new Date(d), description: 'PAYROLL DIRECT DEP - ONTARIO CO', amount: randBetween(1900, 2200), owner: 'julia' });
    }

    // Business income - monthly invoices
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 30)) {
        txns.push({ date: new Date(d), description: 'INVOICE PAID - CLIENT ALPHA', amount: randBetween(3000, 5000), owner: 'business' });
        if (Math.random() > 0.4) {
            txns.push({ date: addDays(d, 15), description: 'CLIENT PAYMENT - BETA CORP', amount: randBetween(2000, 4000), owner: 'business' });
        }
    }

    // Government benefits
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 30)) {
        txns.push({ date: addDays(d, 19), description: 'CANADA CHILD BENEFIT', amount: randBetween(500, 650), owner: 'julia' });
    }

    // Monthly recurring expenses
    const monthlyRecurring = [
        { desc: 'MORTGAGE PAYMENT', min: 2100, max: 2100, owner: 'mike' },
        { desc: 'HYDRO ONE - BILL PAYMENT', min: 120, max: 220, owner: 'mike' },
        { desc: 'ENBRIDGE GAS - AUTO PAY', min: 80, max: 250, owner: 'mike' },
        { desc: 'ROGERS INTERNET - AUTOPAY', min: 89.99, max: 89.99, owner: 'mike' },
        { desc: 'BELL MOBILITY - MIKE', min: 75, max: 85, owner: 'mike' },
        { desc: 'BELL MOBILITY - JULIA', min: 65, max: 75, owner: 'julia' },
        { desc: 'MANULIFE LIFE INSURANCE', min: 145, max: 145, owner: 'mike' },
        { desc: 'INTACT AUTO INSURANCE', min: 210, max: 210, owner: 'mike' },
        { desc: 'DESJARDINS HOME INSURANCE', min: 125, max: 125, owner: 'mike' },
        { desc: 'NETFLIX', min: 22.99, max: 22.99, owner: 'mike' },
        { desc: 'SPOTIFY PREMIUM FAMILY', min: 16.99, max: 16.99, owner: 'mike' },
        { desc: 'DISNEY+ ANNUAL', min: 11.99, max: 11.99, owner: 'julia' },
        { desc: 'AMAZON PRIME MONTHLY', min: 9.99, max: 9.99, owner: 'julia' },
        { desc: 'APPLE ICLOUD STORAGE', min: 3.99, max: 3.99, owner: 'mike' },
        { desc: 'ADOBE CREATIVE CLOUD', min: 73.99, max: 73.99, owner: 'business' },
        { desc: 'CRAVE + HBO', min: 19.99, max: 19.99, owner: 'julia' },
        { desc: 'GOODLIFE FITNESS - MIKE', min: 65, max: 65, owner: 'mike' },
        { desc: 'GOODLIFE FITNESS - JULIA', min: 65, max: 65, owner: 'julia' },
        { desc: 'DAYCARE - LITTLE STARS', min: 1100, max: 1100, owner: 'julia' },
        { desc: 'TD MONTHLY ACCOUNT FEE', min: 16.95, max: 16.95, owner: 'mike' },
        { desc: 'RBC ACCOUNT SERVICE FEE', min: 10.95, max: 10.95, owner: 'julia' },
        { desc: 'PRESTO CARD AUTOLOAD', min: 100, max: 150, owner: 'mike' },
    ];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 30)) {
        monthlyRecurring.forEach(item => {
            const dayOffset = Math.floor(Math.random() * 5);
            txns.push({
                date: addDays(d, dayOffset),
                description: item.desc,
                amount: -randBetween(item.min, item.max),
                owner: item.owner
            });
        });
    }

    // Weekly/frequent expenses
    const groceryStores = ['NO FRILLS #1234','LOBLAWS #567','METRO ONTARIO','COSTCO WHOLESALE','FRESHCO #890','FOOD BASICS','WALMART SUPERCENTRE','FARM BOY','SOBEYS'];
    const restaurants = ['TIM HORTONS #456','STARBUCKS','MCDONALD\'S #789','UBER EATS','SKIP THE DISHES','SWISS CHALET','BOSTON PIZZA','SUBWAY','POPEYES','SHAWARMA PRINCE','PHO HOUSE','EAST SIDE MARIO\'S','THE KEG STEAKHOUSE'];
    const gasStations = ['PETRO-CANADA #123','SHELL #456','ESSO #789','PIONEER ENERGY'];
    const shopping = ['AMAZON.CA','CANADIAN TIRE #234','HOME DEPOT #567','WINNERS','DOLLARAMA','WALMART','IKEA TORONTO','BEST BUY #890','INDIGO','THE BAY'];

    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
        // Groceries 2-3x per week
        if (Math.random() > 0.6) {
            txns.push({ date: new Date(d), description: pick(groceryStores), amount: -randBetween(35, 180), owner: pick(['mike', 'julia']) });
        }

        // Dining 3-5x per week
        if (Math.random() > 0.5) {
            txns.push({ date: new Date(d), description: pick(restaurants), amount: -randBetween(8, 85), owner: pick(['mike', 'julia']) });
        }

        // Gas every 5-7 days
        if (Math.random() > 0.85) {
            txns.push({ date: new Date(d), description: pick(gasStations), amount: -randBetween(55, 95), owner: 'mike' });
        }

        // Shopping 2-3x per week
        if (Math.random() > 0.65) {
            txns.push({ date: new Date(d), description: pick(shopping), amount: -randBetween(15, 150), owner: pick(['mike', 'julia']) });
        }

        // LCBO/Beer Store occasionally
        if (Math.random() > 0.92) {
            txns.push({ date: new Date(d), description: pick(['LCBO #1234', 'BEER STORE', 'WINE RACK']), amount: -randBetween(18, 65), owner: pick(['mike', 'julia']) });
        }

        // Healthcare occasionally
        if (Math.random() > 0.97) {
            txns.push({ date: new Date(d), description: pick(['SHOPPERS DRUG MART #567', 'REXALL PHARMACY', 'DR. SMITH CLINIC', 'DENTAL CARE PLUS']), amount: -randBetween(15, 250), owner: pick(['mike', 'julia']) });
        }

        // Entertainment
        if (Math.random() > 0.95) {
            txns.push({ date: new Date(d), description: pick(['CINEPLEX #345', 'TICKETMASTER', 'DAVE & BUSTERS']), amount: -randBetween(25, 120), owner: pick(['mike', 'julia']) });
        }

        // Personal care
        if (Math.random() > 0.97) {
            txns.push({ date: new Date(d), description: pick(['HAIR SALON STUDIO', 'BARBER SHOP', 'SEPHORA', 'SPA WELLNESS']), amount: -randBetween(30, 120), owner: pick(['mike', 'julia']) });
        }

        // Pets
        if (Math.random() > 0.97) {
            txns.push({ date: new Date(d), description: pick(['PETSMART #234', 'VET CLINIC OAKVILLE']), amount: -randBetween(30, 200), owner: 'julia' });
        }

        // Business expenses
        if (Math.random() > 0.85) {
            const bizExpenses = [
                { desc: 'AWS CLOUD SERVICES', min: 50, max: 300 },
                { desc: 'GITHUB PRO', min: 4, max: 21 },
                { desc: 'DIGITAL OCEAN HOSTING', min: 20, max: 80 },
                { desc: 'ZOOM PRO PLAN', min: 21.99, max: 21.99 },
                { desc: 'SLACK BUSINESS', min: 17.50, max: 35 },
                { desc: 'GOOGLE ADS', min: 50, max: 500 },
                { desc: 'FACEBOOK ADS', min: 30, max: 300 },
                { desc: 'STAPLES BUSINESS DEPOT', min: 20, max: 100 },
                { desc: 'BUSINESS LUNCH - CLIENT', min: 40, max: 120 },
                { desc: 'FREELANCER PAYMENT', min: 200, max: 1500 },
            ];
            const item = pick(bizExpenses);
            txns.push({ date: new Date(d), description: item.desc, amount: -randBetween(item.min, item.max), owner: 'business' });
        }
    }

    // Quarterly travel
    for (let q = 0; q < 8; q++) {
        const d = addDays(startDate, q * 90 + Math.floor(Math.random() * 30));
        if (d <= endDate) {
            txns.push({ date: d, description: pick(['AIR CANADA', 'WESTJET', 'HOTEL MARRIOTT', 'AIRBNB', 'EXPEDIA']), amount: -randBetween(300, 1200), owner: pick(['mike', 'julia']) });
        }
    }

    // Gifts/Donations
    for (let d = new Date(startDate); d <= endDate; d = addDays(d, 30)) {
        if (Math.random() > 0.7) {
            txns.push({ date: new Date(d), description: pick(['CHURCH DONATION', 'UNITED WAY', 'GIFT - AMAZON']), amount: -randBetween(25, 200), owner: pick(['mike', 'julia']) });
        }
    }

    // Categorize all
    txns.forEach(t => {
        t.category = categorize(t.description, t.owner);
    });

    return txns;
}

// ---------------------------------------------------------------------------
// 16. EXPORT
// ---------------------------------------------------------------------------
function exportCSV() {
    let txns = getFiltered(activeProfile);
    const search = document.getElementById('search-input').value.toLowerCase();
    const catFilter = document.getElementById('category-filter').value;
    const monthFilter = document.getElementById('month-filter').value;
    const ownerFilter = document.getElementById('owner-filter').value;

    if (search) txns = txns.filter(t => t.description.toLowerCase().includes(search));
    if (catFilter) txns = txns.filter(t => t.category === catFilter);
    if (monthFilter) txns = txns.filter(t => formatMonth(t.date) === monthFilter);
    if (ownerFilter) txns = txns.filter(t => t.owner === ownerFilter);

    txns.sort((a, b) => a.date - b.date);

    let csv = 'Date,Description,Amount,Category,HST (Est.),Owner\n';
    txns.forEach(t => {
        const hst = calcHST(t.amount, t.category);
        csv += `${formatDate(t.date)},"${t.description.replace(/"/g, '""')}",${t.amount.toFixed(2)},${t.category},${hst.toFixed(2)},${t.owner}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_export_${activeProfile}_${formatDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// 17. MAIN DASHBOARD RENDER
// ---------------------------------------------------------------------------
function renderDashboard() {
    const txns = getFiltered(activeProfile);
    if (txns.length === 0) return;

    const analytics = computeAnalytics(txns);
    const budgetRows = generateBudget(analytics);
    const cuts = generateCuts(analytics, budgetRows);

    // Show sections
    ['kpi-section', 'hst-section', 'charts-section', 'budget-section', 'cuts-section', 'transactions-section'].forEach(id => {
        document.getElementById(id).classList.remove('hidden');
    });

    // Show CRA tax only for business
    const taxSection = document.getElementById('tax-section');
    if (activeProfile === 'business' || activeProfile === 'combined') {
        taxSection.classList.remove('hidden');
        renderCRATax(allTransactions);
    } else {
        taxSection.classList.add('hidden');
    }

    renderKPIs(analytics, activeProfile);
    renderHST(analytics, activeProfile);
    renderCharts(analytics, activeProfile);
    renderBudget(budgetRows, activeProfile);
    renderCuts(cuts, activeProfile);
    populateFilters();
    renderTransactions();
}

// ---------------------------------------------------------------------------
// 18. EVENT WIRING
// ---------------------------------------------------------------------------
function init() {
    // Check for saved data
    if (loadData()) {
        document.getElementById('process-btn').disabled = false;
        document.getElementById('export-btn').disabled = false;
        renderDashboard();
    }

    // Profile tabs
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeProfile = tab.dataset.profile;
            currentPage = 1;
            if (allTransactions.length > 0) renderDashboard();
        });
    });

    // File uploads
    ['mike', 'julia', 'business'].forEach(owner => {
        const input = document.getElementById(owner + '-upload');
        const label = input.previousElementSibling;
        const fileList = document.getElementById(owner + '-file-list');

        input.addEventListener('change', () => {
            Array.from(input.files).forEach(file => {
                pendingFiles[owner].push(file);
                const item = document.createElement('div');
                item.className = 'file-item';
                item.innerHTML = `<span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span><button class="remove-file">&times;</button>`;
                item.querySelector('.remove-file').addEventListener('click', () => {
                    pendingFiles[owner] = pendingFiles[owner].filter(f => f !== file);
                    item.remove();
                    updateProcessBtn();
                });
                fileList.appendChild(item);
            });
            updateProcessBtn();
            input.value = '';
        });

        // Drag and drop
        label.addEventListener('dragover', e => { e.preventDefault(); label.style.borderColor = 'var(--primary)'; });
        label.addEventListener('dragleave', () => { label.style.borderColor = ''; });
        label.addEventListener('drop', e => {
            e.preventDefault();
            label.style.borderColor = '';
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.name.endsWith('.csv')) {
                    pendingFiles[owner].push(file);
                    const item = document.createElement('div');
                    item.className = 'file-item';
                    item.innerHTML = `<span>${file.name}</span><button class="remove-file">&times;</button>`;
                    item.querySelector('.remove-file').addEventListener('click', () => {
                        pendingFiles[owner] = pendingFiles[owner].filter(f => f !== file);
                        item.remove();
                        updateProcessBtn();
                    });
                    fileList.appendChild(item);
                }
            });
            updateProcessBtn();
        });
    });

    // Process button
    document.getElementById('process-btn').addEventListener('click', async () => {
        const btn = document.getElementById('process-btn');
        btn.disabled = true;
        btn.textContent = 'Analyzing...';

        // Parse all pending files
        for (const owner of ['mike', 'julia', 'business']) {
            for (const file of pendingFiles[owner]) {
                const text = await file.text();
                const rows = parseCSV(text);
                rows.forEach(row => {
                    row.owner = owner;
                    row.category = categorize(row.description, owner);
                    allTransactions.push(row);
                });
            }
            pendingFiles[owner] = [];
            document.getElementById(owner + '-file-list').innerHTML = '';
        }

        // De-duplicate by date+description+amount
        const seen = new Set();
        allTransactions = allTransactions.filter(t => {
            const key = formatDate(t.date) + '|' + t.description + '|' + t.amount.toFixed(2) + '|' + t.owner;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        saveData();
        renderDashboard();
        btn.textContent = 'Analyze Statements';
        btn.disabled = false;
        document.getElementById('export-btn').disabled = false;
    });

    // Demo data button
    document.getElementById('load-demo-btn').addEventListener('click', () => {
        allTransactions = generateDemoData();
        saveData();
        document.getElementById('export-btn').disabled = false;
        renderDashboard();
    });

    // Clear data button
    document.getElementById('clear-data-btn').addEventListener('click', () => {
        if (confirm('Clear all saved financial data? This cannot be undone.')) {
            clearData();
            destroyCharts();
            ['kpi-section', 'hst-section', 'charts-section', 'budget-section', 'cuts-section', 'tax-section', 'transactions-section'].forEach(id => {
                document.getElementById(id).classList.add('hidden');
            });
            document.getElementById('export-btn').disabled = true;
        }
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', exportCSV);

    // Transaction filters
    ['search-input', 'category-filter', 'month-filter', 'owner-filter'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener(id === 'search-input' ? 'input' : 'change', () => {
            currentPage = 1;
            renderTransactions();
        });
    });

    // Sort headers
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortState.col === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
            else { sortState.col = col; sortState.dir = col === 'date' ? 'desc' : 'asc'; }
            renderTransactions();
        });
    });

    // Pagination (delegated)
    document.getElementById('pagination').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.page) {
            currentPage = parseInt(e.target.dataset.page);
            renderTransactions();
        }
    });
}

function updateProcessBtn() {
    const hasPending = Object.values(pendingFiles).some(files => files.length > 0);
    document.getElementById('process-btn').disabled = !hasPending && allTransactions.length === 0;
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

})();
