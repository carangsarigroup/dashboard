 // ============ CONFIG ============
const CONFIG = {
    CLIENT_ID: '874016971039-g91m2mt64mid7sh9vkk14vpjmpbc095o.apps.googleusercontent.com',
    API_KEY: 'AIzaSyCMpk-2HdASd6oX-MBRqehgXX-kTfzpFw0',
    SPREADSHEET_ID: '1M1U3U7aNUBC9R9CP1Ca6KC5lCKSr7OFKBIB1MW7JfvM',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    CACHE_DURATION: 5 * 60 * 1000,
    
    // ✨ NEW: Year-based range configuration
    YEAR_RANGES: {
        '2025': {
            table1: 'A1:G13',    // Surplus kas toko 2025
            table2: 'I1:L23'     // Penggunaan surkas 2025
        },
        '2026': {
            table1: 'A27:G39',   // Surplus kas toko 2026
            table2: 'I27:L49'    // Penggunaan surkas 2026
        }
    }
};

// ============ OAUTH STATE ============
let tokenClient;
let accessToken = null;
let gapiInited = false;
let gisInited = false;

// ============ STATE MANAGEMENT ============
let appState = {
    sheets: [],
    currentSheet: null,
    cache: {},
    lastUpdate: null,
    currentData: [],
    currentData2: [],  
    currentFilter: 'all',
    currentYear: '2025'  // ✨ NEW: Default year
};

// ============ AUTH SYSTEM ============
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function getAuthData() {
    try {
        const authString = getCookie('userAuth');
        if (!authString) return null;
        return JSON.parse(atob(authString));
    } catch (e) {
        console.error('Auth parse error:', e);
        return null;
    }
}

function checkAuth() {
    const authData = getAuthData();
    if (!authData) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }

    if (authData.expiresAt && new Date() > new Date(authData.expiresAt)) {
        deleteCookie('userAuth');
        window.location.href = 'login.html?message=' + encodeURIComponent('Session expired');
        return false;
    }

    updateUIBasedOnRole(authData.role);
    return true;
}

// ============ AUTO-LOGOUT INACTIVITY TIMER ============
let inactivityTimer;
let warningTimer;
let countdownInterval;
const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 60 * 1000; // 60 seconds warning

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);

    document.getElementById('logoutWarning').classList.remove('show');

    warningTimer = setTimeout(() => {
        showLogoutWarning();
    }, INACTIVITY_LIMIT - WARNING_TIME);

    inactivityTimer = setTimeout(() => {
        logout('Anda telah logout otomatis karena tidak ada aktivitas selama 5 menit');
    }, INACTIVITY_LIMIT);
}

function showLogoutWarning() {
    document.getElementById('logoutWarning').classList.add('show');
    let countdown = 60;
    document.getElementById('warningCountdown').textContent = countdown;

    countdownInterval = setInterval(() => {
        countdown--;
        document.getElementById('warningCountdown').textContent = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function resetInactivityTimer() {
    startInactivityTimer();
}

// Listen for user activity
const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
activityEvents.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
});

function updateUIBasedOnRole(role) {
    const authBtn = document.getElementById('authBtn');
    const isAdmin = role && role.toLowerCase() === 'admin';

    if (authBtn) {
        authBtn.style.display = isAdmin ? 'flex' : 'none';
    }
}

function logout(message = null) {
    if (!message && !confirm('Yakin ingin logout?')) return;
    
    accessToken = null;
    clearStoredToken();
    if (typeof gapi !== 'undefined' && gapi.client) {
        gapi.client.setToken(null);
    }
    updateAuthButton(false);
    
    deleteCookie('userAuth');
    
    window.location.href = 'login.html' + (message ? '?message=' + encodeURIComponent(message) : '');
}

// Initialize auth on page load
if (checkAuth()) {
    const authData = getAuthData();
    if (authData?.username) {
        document.getElementById('displayUsername').textContent = authData.username;
    }
    if (authData?.role) {
        updateUIBasedOnRole(authData.role);
    }
}

// ============ OAUTH INITIALIZATION ============
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
        });
        gapiInited = true;
        maybeEnableButtons();
        console.log('GAPI client initialized');
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
        showError('Gagal Inisialisasi API', 
            'Tidak dapat terhubung ke Google Sheets API. ' +
            'Silakan refresh halaman atau cek koneksi internet Anda.<br><br>' +
            'Detail: ' + (error.result?.error?.message || error.message)
        );
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        prompt: '',
        callback: ''
    });
    gisInited = true;
    maybeEnableButtons();
    console.log('GIS initialized');
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        if (restoreStoredToken()) {
            console.log('Restored OAuth token from storage');
        }
        loadSheetsList();
    }
}

// ============ TOKEN STORAGE ============
function storeOAuthToken(token, expiresIn = 3600) {
    try {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('oauth_token', token);
        localStorage.setItem('oauth_expiry', expiryTime.toString());
        console.log('OAuth token stored, expires in:', expiresIn, 'seconds');
    } catch (e) {
        console.warn('Could not store OAuth token:', e);
    }
}

function restoreStoredToken() {
    try {
        const storedToken = localStorage.getItem('oauth_token');
        const expiry = localStorage.getItem('oauth_expiry');
        
        if (!storedToken || !expiry) {
            return false;
        }
        
        const expiryTime = parseInt(expiry);
        const now = Date.now();
        
        if (now < expiryTime - 300000) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
            updateAuthButton(true);
            console.log('Using stored OAuth token, expires in:', Math.floor((expiryTime - now) / 1000), 'seconds');
            return true;
        } else {
            clearStoredToken();
            console.log('Stored token expired');
            return false;
        }
    } catch (e) {
        console.warn('Error restoring token:', e);
        return false;
    }
}

function clearStoredToken() {
    try {
        localStorage.removeItem('oauth_token');
        localStorage.removeItem('oauth_expiry');
    } catch (e) {
        console.warn('Error clearing token:', e);
    }
}

function handleAuth() {
    if (accessToken) {
        alert('Sudah terauthentikasi!');
        return;
    }

    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('Auth error:', response);
            alert('Gagal authenticate: ' + response.error);
            clearStoredToken();
            return;
        }
        
        accessToken = response.access_token;
        
        const expiresIn = response.expires_in || 3600;
        storeOAuthToken(accessToken, expiresIn);
        
        gapi.client.setToken({ access_token: accessToken });
        
        updateAuthButton(true);
        if (appState.currentSheet) {
            loadSheetData(appState.currentSheet, true);
        }
        alert('✅ Berhasil authenticate! Sekarang Anda bisa menambah, edit, dan hapus data.\n\nToken akan tetap aktif selama sesi browser ini.');
        console.log('Authenticated successfully, token expires in:', expiresIn, 'seconds');
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function updateAuthButton(isAuthenticated) {
    const authBtn = document.getElementById('authBtn');
    const authBtnText = document.getElementById('authBtnText');
    
    if (isAuthenticated) {
        authBtn.classList.add('authenticated');
        authBtnText.textContent = '✓ Terotentikasi';
    } else {
        authBtn.classList.remove('authenticated');
        authBtnText.textContent = 'Authenticate';
    }
}

// ============ UTILITY FUNCTIONS ============
function formatRupiah(value) {
    if (!value && value !== 0) return 'Rp0';
    
    const num = typeof value === 'string' 
        ? parseFloat(value.replace(/[^\d.-]/g, ''))
        : value;
    
    if (isNaN(num)) return 'Rp0';
    
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function parseNumber(value) {
    if (!value) return 0;
    const str = value.toString().replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function showLoading(message = 'Memuat data...') {
    document.getElementById('content').innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        </div>
    `;
}

function showError(title, message) {
    document.getElementById('content').innerHTML = `
        <div class="error">
            <strong>❌ ${title}</strong>
            ${message}
        </div>
    `;
}

function showEmptyState() {
    document.getElementById('content').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h2>Pilih Toko untuk Melihat Data</h2>
            <p>Gunakan dropdown di atas untuk memilih toko yang ingin ditampilkan</p>
        </div>
    `;
}

// ============ CACHE MANAGEMENT ============
function getCachedData(sheetName) {
    const cached = appState.cache[sheetName];
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CONFIG.CACHE_DURATION) {
        delete appState.cache[sheetName];
        return null;
    }
    
    return cached.data;
}

function setCachedData(sheetName, data) {
    appState.cache[sheetName] = {
        data: data,
        timestamp: Date.now()
    };
}

// ============ LOCAL STORAGE ============
function saveLastSheet(sheetName) {
    try {
        const data = { sheet: sheetName, timestamp: Date.now() };
        sessionStorage.setItem('lastSheet', JSON.stringify(data));
    } catch (e) {
        console.warn('Could not save to sessionStorage:', e);
    }
}

function getLastSheet() {
    try {
        const stored = sessionStorage.getItem('lastSheet');
        if (!stored) return null;
        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp > 3600000) return null;
        return data.sheet;
    } catch (e) {
        return null;
    }
}

// ============ API FUNCTIONS ============
async function loadSheetsList() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?key=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        appState.sheets = data.sheets.map(sheet => sheet.properties.title);
        
        const sheetSelect = document.getElementById('sheetSelect');
        sheetSelect.innerHTML = '<option value="">Pilih Toko...</option>' + 
            appState.sheets.map(name => 
                `<option value="${name}">${name}</option>`
            ).join('');
        
        const lastSheet = getLastSheet();
        if (lastSheet && appState.sheets.includes(lastSheet)) {
            sheetSelect.value = lastSheet;
            loadSheetData(lastSheet);
        } else {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading sheets:', error);
        showError('Gagal Memuat Daftar Sheet', `
            ${error.message}
            <br><br>
            <strong>Pastikan:</strong>
            <ul style="margin-top: 10px; margin-left: 20px;">
                <li>Spreadsheet ID benar</li>
                <li>API Key valid</li>
                <li>Google Sheets API sudah enabled</li>
                <li>Sheet sudah public</li>
            </ul>
        `);
    }
}

async function loadSheetData(sheetName, forceRefresh = false) {
    if (!sheetName) {
        showEmptyState();
        return;
    }

    // ✨ UPDATED: Use cache key that includes year
    const cacheKey = `${sheetName}_${appState.currentYear}`;
    
    if (!forceRefresh) {
        const cached = getCachedData(cacheKey);
        if (cached) {
            console.log('Using cached data for:', sheetName, 'Year:', appState.currentYear);
            displayData(cached.table1, cached.table2, sheetName);
            return;
        }
    }
    
    showLoading(`Memuat data: ${sheetName} - Tahun ${appState.currentYear}`);
    appState.currentSheet = sheetName;
    
    try {
        // ✨ UPDATED: Get ranges based on selected year
        const ranges = CONFIG.YEAR_RANGES[appState.currentYear];
        if (!ranges) {
            throw new Error(`Konfigurasi tahun ${appState.currentYear} tidak ditemukan`);
        }

        const [response1, response2] = await Promise.all([
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${ranges.table1}?key=${CONFIG.API_KEY}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!${ranges.table2}?key=${CONFIG.API_KEY}`)
        ]);
        
        const data1 = await response1.json();
        const data2 = await response2.json();
        
        if (data1.error || data2.error) {
            throw new Error(data1.error?.message || data2.error?.message);
        }
        
        const table1Data = data1.values || [];
        const table2Data = data2.values || [];
        
        if (table1Data.length === 0 && table2Data.length === 0) {
            showError('Data Kosong', `Tidak ada data di sheet "${sheetName}" untuk tahun ${appState.currentYear}`);
            return;
        }
        
        // ✨ UPDATED: Cache with year-specific key
        setCachedData(cacheKey, { table1: table1Data, table2: table2Data });
        appState.lastUpdate = new Date();
        appState.currentData = table1Data;
        appState.currentData2 = table2Data;
        
        displayData(table1Data, table2Data, sheetName);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Gagal Memuat Data', `
            ${error.message}
            <br><br>
            <strong>Sheet:</strong> "${sheetName}"<br>
            <strong>Tahun:</strong> ${appState.currentYear}
        `);
    }
}

// ============ DATA PROCESSING ============
function processRowData(row) {
    const triwulan = row[0] || '';
    const bulan = row[1] || '';
    const ebitdaLR = parseNumber(row[2]);
    const penggunaanLabaKas = parseNumber(row[3]);
    const labaNetDitransfer = parseNumber(row[4]);
    const bayarListrik = parseNumber(row[5]);
    
    let sisaSurkas = parseNumber(row[6]);
    if (!sisaSurkas && labaNetDitransfer && bayarListrik) {
        sisaSurkas = labaNetDitransfer - bayarListrik;
    }
    
    return {
        triwulan,
        bulan,
        ebitdaLR,
        penggunaanLabaKas,
        labaNetDitransfer,
        bayarListrik,
        sisaSurkas
    };
}

function processRowDataTable2(row) {
    const no = row[0] || '';
    const bulan = row[1] || '';
    const nominalPenggunaanSurkas = parseNumber(row[2]);
    const tujuanPenggunaanSurkas = row[3] || '';
    
    return {
        no,
        bulan,
        nominalPenggunaanSurkas,
        tujuanPenggunaanSurkas
    };
}

function calculateTotals(rows) {
    return rows.reduce((totals, row) => {
        const data = processRowData(row);
        return {
            ebitdaLR: totals.ebitdaLR + data.ebitdaLR,
            penggunaanLabaKas: totals.penggunaanLabaKas + data.penggunaanLabaKas,
            labaNetDitransfer: totals.labaNetDitransfer + data.labaNetDitransfer,
            bayarListrik: totals.bayarListrik + data.bayarListrik,
            sisaSurkas: totals.sisaSurkas + data.sisaSurkas
        };
    }, {
        ebitdaLR: 0,
        penggunaanLabaKas: 0,
        labaNetDitransfer: 0,
        bayarListrik: 0,
        sisaSurkas: 0
    });
}

function calculateTotalsTable2(rows) {
    return rows.reduce((totals, row) => {
        const data = processRowDataTable2(row);
        return {
            nominalPenggunaanSurkas: totals.nominalPenggunaanSurkas + data.nominalPenggunaanSurkas
        };
    }, {
        nominalPenggunaanSurkas: 0
    });
}

// ============ FILTER FUNCTIONS ============
function handleTriwulanFilter() {
    const filterSelect = document.getElementById('triwulanFilter');
    const selectedFilter = filterSelect.value;
    appState.currentFilter = selectedFilter;

    if (selectedFilter !== 'all') {
        filterSelect.classList.add('filtered');
    } else {
        filterSelect.classList.remove('filtered');
    }

    if (appState.currentSheet && appState.currentData.length > 0) {
        displayData(appState.currentData, appState.currentData2 || [], appState.currentSheet);
    }
}

function handleYearChange() {
    const yearSelect = document.getElementById('yearFilter');
    const selectedYear = yearSelect.value;
    appState.currentYear = selectedYear;

    // Reset triwulan filter when changing year
    appState.currentFilter = 'all';
    const triwulanSelect = document.getElementById('triwulanFilter');
    if (triwulanSelect) {
        triwulanSelect.value = 'all';
        triwulanSelect.classList.remove('filtered');
    }

    // Reload data with new year
    if (appState.currentSheet) {
        // Clear cache for current sheet
        delete appState.cache[appState.currentSheet];
        loadSheetData(appState.currentSheet, true);
    }
}

function filterDataByTriwulan(dataRows) {
    if (appState.currentFilter === 'all') {
        return dataRows;
    }
    
    return dataRows.filter(row => {
        const triwulan = row[0] ? row[0].toString().trim() : '';
        return triwulan === appState.currentFilter;
    });
}

function getTriwulanLabel(value) {
    const labels = {
        '1': 'Triwulan 1 (Q1)',
        '2': 'Triwulan 2 (Q2)',
        '3': 'Triwulan 3 (Q3)',
        '4': 'Triwulan 4 (Q4)',
        'all': 'Semua Triwulan'
    };
    return labels[value] || 'Semua Triwulan';
}

// ============ DISPLAY FUNCTIONS ============
function displayData(values1, values2, sheetName) {
    const headers1 = values1[0];
    const allDataRows1 = values1.slice(1).filter(row => row[1]);
    const dataRows1 = filterDataByTriwulan(allDataRows1);
    
    const headers2 = values2.length > 0 ? values2[0] : [];
    const allDataRows2 = values2.length > 1 ? values2.slice(1).filter(row => row[0]) : [];

    const dataRows2 = appState.currentFilter !== 'all' 
        ? allDataRows2.filter(row => {
            const triwulan = row[0] ? row[0].toString().trim() : '';
            return triwulan === appState.currentFilter;
        })
        : allDataRows2;
    
    if (dataRows1.length === 0 && dataRows2.length === 0) {
        const filterLabel = getTriwulanLabel(appState.currentFilter);
        showError('Data Kosong', `Tidak ada data untuk ${filterLabel} di sheet "${sheetName}"`);
        return;
    }

    const totals1 = calculateTotals(dataRows1);
    const totals2 = calculateTotalsTable2(dataRows2);
    
    const filterBadge = appState.currentFilter !== 'all' 
        ? `<div class="filter-badge">📊 Menampilkan: ${getTriwulanLabel(appState.currentFilter)}</div>`
        : '';
    
    let html = `
    ${filterBadge}
    
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="color: #FF69B4; margin: 0; font-size: 1.5em;">💰 Surplus Kas Toko - Tahun ${appState.currentYear}</h2>
        ${accessToken ? `
        <button class="add-btn" onclick="openAddModal(1)" style="display: inline-flex;">
            <span>➕</span>
            <span>Tambah Data Surplus Kas</span>
        </button>
        ` : ''}
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>${formatRupiah(totals1.ebitdaLR)}</h3>
            <p>Total EBITDA LR${appState.currentFilter !== 'all' ? ' - ' + getTriwulanLabel(appState.currentFilter) : ''}</p>
        </div>
        <div class="stat-card">
            <h3>${formatRupiah(totals1.labaNetDitransfer)}</h3>
            <p>Total Laba Net Ditransfer${appState.currentFilter !== 'all' ? ' - ' + getTriwulanLabel(appState.currentFilter) : ''}</p>
        </div>
        <div class="stat-card">
            <h3>${formatRupiah(totals1.bayarListrik)}</h3>
            <p>Total Bayar Listrik${appState.currentFilter !== 'all' ? ' - ' + getTriwulanLabel(appState.currentFilter) : ''}</p>
        </div>
        <div class="stat-card-finale">
            <h3>${formatRupiah(totals1.sisaSurkas)}</h3>
            <p>Total Sisa Surplus Kas${appState.currentFilter !== 'all' ? ' - ' + getTriwulanLabel(appState.currentFilter) : ''}</p>
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>TRIWULAN</th>
                    <th>BULAN</th>
                    <th>EBITDA LR</th>
                    <th>PENGGUNAAN LABA KAS</th>
                    <th>LABA NET DITRANSFER</th>
                    <th>BAYAR LISTRIK</th>
                    <th>SISA SURKAS</th>
                    ${accessToken ? '<th>AKSI</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;
    
    dataRows1.forEach((row, index) => {
        const data = processRowData(row);
        let colorClass = 'zero';
        if (data.sisaSurkas > 0) colorClass = 'positive';
        else if (data.sisaSurkas < 0) colorClass = 'negative';
        
        const originalIndex = allDataRows1.findIndex(r => 
            r[0] === row[0] && r[1] === row[1] && r[2] === row[2]
        );
        const rowIndex = originalIndex + 2;

        html += `
            <tr>
                <td class="triwulan">${data.triwulan}</td>
                <td class="month">${data.bulan}</td>
                <td class="currency">${formatRupiah(data.ebitdaLR)}</td>
                <td class="currency">${formatRupiah(data.penggunaanLabaKas)}</td>
                <td class="currency">${formatRupiah(data.labaNetDitransfer)}</td>
                <td class="currency">${formatRupiah(data.bayarListrik)}</td>
                <td class="currency ${colorClass}">${formatRupiah(data.sisaSurkas)}</td>
                ${accessToken ? `
                <td class="actions">
                    <button class="btn-edit" onclick="openEditModal(${rowIndex}, 1)">✏️ Edit</button>
                    <button class="btn-delete" onclick="handleDelete(${rowIndex}, 1)">🗑️ Hapus</button>
                </td>
                ` : ''}
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;
    
    html += `
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 40px 0 20px 0;">
        <h2 style="color: #FF69B4; margin: 0; font-size: 1.5em;">📋 Penggunaan Surkas - Tahun ${appState.currentYear}</h2>
        ${accessToken ? `
        <button class="add-btn" onclick="openAddModal(2)" style="display: inline-flex;">
            <span>➕</span>
            <span>Tambah Data Penggunaan Surkas</span>
        </button>
        ` : ''}
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>${formatRupiah(totals2.nominalPenggunaanSurkas)}</h3>
            <p>Total Nominal Penggunaan Surkas${appState.currentFilter !== 'all' ? ' - ' + getTriwulanLabel(appState.currentFilter) : ''}</p>
        </div>
        <div class="stat-card">
            <h3>${dataRows2.length}</h3>
            <p>Total Transaksi</p>
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>TRIWULAN (Q)</th>
                    <th>BULAN</th>
                    <th>NOMINAL PENGGUNAAN SURKAS</th>
                    <th>TUJUAN PENGGUNAAN SURKAS</th>
                    ${accessToken ? '<th>AKSI</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;
    
    dataRows2.forEach((row, index) => {
        const data = processRowDataTable2(row);
        const rowIndex = index + 2;

        html += `
            <tr>
                <td class="triwulan">${data.no || (index + 1)}</td>
                <td class="month">${data.bulan}</td>
                <td class="currency">${formatRupiah(data.nominalPenggunaanSurkas)}</td>
                <td>${data.tujuanPenggunaanSurkas}</td>
                ${accessToken ? `
                <td class="actions">
                    <button class="btn-edit" onclick="openEditModal(${rowIndex}, 2)">✏️ Edit</button>
                    <button class="btn-delete" onclick="handleDelete(${rowIndex}, 2)">🗑️ Hapus</button>
                </td>
                ` : ''}
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;
    
    document.getElementById('content').innerHTML = html;
}

// ============ MODAL FUNCTIONS ============
function openAddModal(tableNumber) {
    if (!appState.currentSheet) {
        alert('Pilih toko terlebih dahulu!');
        return;
    }

    document.getElementById('modalTitle').textContent = tableNumber === 1 ? 'Tambah Data - Surplus Kas' : 'Tambah Data - Penggunaan Surkas';
    document.getElementById('submitBtnText').textContent = 'Simpan';
    document.getElementById('dataForm').reset();
    document.getElementById('editRowIndex').value = '';
    document.getElementById('editTableNumber').value = tableNumber;
    
    if (tableNumber === 1) {
        document.getElementById('table1Fields').style.display = 'block';
        document.getElementById('table2Fields').style.display = 'none';
        document.getElementById('triwulan').required = true;
        document.getElementById('bulan').required = true;
        document.getElementById('ebitdaLR').required = true;
        document.getElementById('penggunaanLabaKas').required = true;
        document.getElementById('bayarListrik').required = true;
        document.getElementById('no2').required = false;
        document.getElementById('bulan2').required = false;
        document.getElementById('nominalPenggunaanSurkas').required = false;
        document.getElementById('tujuanPenggunaanSurkas').required = false;
    } else {
        document.getElementById('table1Fields').style.display = 'none';
        document.getElementById('table2Fields').style.display = 'block';
        document.getElementById('no2').required = true;
        document.getElementById('bulan2').required = true;
        document.getElementById('nominalPenggunaanSurkas').required = true;
        document.getElementById('tujuanPenggunaanSurkas').required = true;
        document.getElementById('triwulan').required = false;
        document.getElementById('bulan').required = false;
        document.getElementById('ebitdaLR').required = false;
        document.getElementById('penggunaanLabaKas').required = false;
        document.getElementById('bayarListrik').required = false;
    }
    
    document.getElementById('dataModal').classList.add('active');
}

function openEditModal(rowIndex, tableNumber) {
    if (tableNumber === 1) {
        if (!appState.currentData || appState.currentData.length < rowIndex) {
            alert('Data tidak ditemukan!');
            return;
        }

        const row = appState.currentData[rowIndex - 1];
        const data = processRowData(row);

        document.getElementById('modalTitle').textContent = 'Edit Data - Surplus Kas';
        document.getElementById('submitBtnText').textContent = 'Update';
        document.getElementById('editRowIndex').value = rowIndex;
        document.getElementById('editTableNumber').value = tableNumber;
        
        document.getElementById('table1Fields').style.display = 'block';
        document.getElementById('table2Fields').style.display = 'none';
        
        document.getElementById('triwulan').value = data.triwulan;
        document.getElementById('bulan').value = data.bulan;
        document.getElementById('ebitdaLR').value = data.ebitdaLR;
        document.getElementById('penggunaanLabaKas').value = data.penggunaanLabaKas;
        document.getElementById('bayarListrik').value = data.bayarListrik;
        
        calculateValues();
    } else if (tableNumber === 2) {
        if (!appState.currentData2 || appState.currentData2.length < rowIndex) {
            alert('Data tidak ditemukan!');
            return;
        }

        const row = appState.currentData2[rowIndex - 1];
        const data = processRowDataTable2(row);

        document.getElementById('modalTitle').textContent = 'Edit Data - Penggunaan Surkas';
        document.getElementById('submitBtnText').textContent = 'Update';
        document.getElementById('editRowIndex').value = rowIndex;
        document.getElementById('editTableNumber').value = tableNumber;
        
        document.getElementById('table1Fields').style.display = 'none';
        document.getElementById('table2Fields').style.display = 'block';
        
        document.getElementById('no2').value = data.no;
        document.getElementById('bulan2').value = data.bulan;
        document.getElementById('nominalPenggunaanSurkas').value = data.nominalPenggunaanSurkas;
        document.getElementById('tujuanPenggunaanSurkas').value = data.tujuanPenggunaanSurkas;
    }

    document.getElementById('dataModal').classList.add('active');
}

function closeModal() {
    document.getElementById('dataModal').classList.remove('active');
    document.getElementById('dataForm').reset();
}

// ============ AUTO CALCULATION ============
function calculateValues() {
    const ebitdaLR = parseNumber(document.getElementById('ebitdaLR').value) || 0;
    const penggunaanLabaKas = parseNumber(document.getElementById('penggunaanLabaKas').value) || 0;
    const bayarListrik = parseNumber(document.getElementById('bayarListrik').value) || 0;
    
    const labaNetDitransfer = ebitdaLR - penggunaanLabaKas;
    const sisaSurkas = labaNetDitransfer - bayarListrik;
    
    document.getElementById('labaNetDitransfer').value = labaNetDitransfer;
    document.getElementById('sisaSurkas').value = sisaSurkas;
}

// ============ CRUD FUNCTIONS ============
async function addRow(sheetName, rowData, tableNumber) {
    if (!accessToken) {
        alert('❌ Harap authenticate terlebih dahulu!\n\nKlik tombol "Authenticate" di pojok kanan atas.');
        return;
    }
    
    try {
        // ✨ UPDATED: Get range based on year and table
        const ranges = CONFIG.YEAR_RANGES[appState.currentYear];
        if (!ranges) {
            throw new Error(`Konfigurasi tahun ${appState.currentYear} tidak ditemukan`);
        }
        
        const range = tableNumber === 1 ? ranges.table1 : ranges.table2;
        
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });
        
        console.log('Row added:', response);
        
        // ✨ UPDATED: Clear cache with year-specific key
        delete appState.cache[`${sheetName}_${appState.currentYear}`];
        await loadSheetData(sheetName, true);
        
        alert('✅ Data berhasil ditambahkan!');
        return response;
    } catch (error) {
        console.error('Error adding row:', error);
        alert('❌ Gagal menambahkan data: ' + error.message);
        throw error;
    }
}

async function updateRow(sheetName, rowIndex, rowData, tableNumber) {
    if (!accessToken) {
        alert('❌ Harap authenticate terlebih dahulu!\n\nKlik tombol "Authenticate" di pojok kanan atas.');
        return;
    }
    
    try {
        // ✨ UPDATED: Get range based on year and table
        const ranges = CONFIG.YEAR_RANGES[appState.currentYear];
        if (!ranges) {
            throw new Error(`Konfigurasi tahun ${appState.currentYear} tidak ditemukan`);
        }
        
        const range = tableNumber === 1 ? ranges.table1 : ranges.table2;
        const startCol = range.split(':')[0].match(/[A-Z]+/)[0];
        const endCol = range.split(':')[1].match(/[A-Z]+/)[0];
        
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${sheetName}!${startCol}${rowIndex}:${endCol}${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });
        
        console.log('Row updated:', response);
        
        // ✨ UPDATED: Clear cache with year-specific key
        delete appState.cache[`${sheetName}_${appState.currentYear}`];
        await loadSheetData(sheetName, true);
        
        alert('✅ Data berhasil diupdate!');
        return response;
    } catch (error) {
        console.error('Error updating row:', error);
        alert('❌ Gagal mengupdate data: ' + error.message);
        throw error;
    }
}

async function deleteRow(sheetName, rowIndex, tableNumber) {
    if (!accessToken) {
        alert('❌ Harap authenticate terlebih dahulu!\n\nKlik tombol "Authenticate" di pojok kanan atas.');
        return;
    }
    
    try {
        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID
        });
        
        const sheet = spreadsheet.result.sheets.find(
            s => s.properties.title === sheetName
        );
        
        if (!sheet) {
            throw new Error('Sheet not found');
        }
        
        const sheetId = sheet.properties.sheetId;
        
        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        
        console.log('Row deleted:', response);
        
        // ✨ UPDATED: Clear cache with year-specific key
        delete appState.cache[`${sheetName}_${appState.currentYear}`];
        await loadSheetData(sheetName, true);
        
        alert('✅ Baris berhasil dihapus sepenuhnya!');
        return response;
    } catch (error) {
        console.error('Error deleting row:', error);
        alert('❌ Gagal menghapus baris: ' + error.message);
        throw error;
    }
}

// ============ EVENT HANDLERS ============
function handleSheetChange() {
    const sheetSelect = document.getElementById('sheetSelect');
    const selectedSheet = sheetSelect.value;

    if (selectedSheet) {
        appState.currentFilter = 'all';
        
        const triwulanSelect = document.getElementById('triwulanFilter');
        if (triwulanSelect) {
            triwulanSelect.value = 'all';
            triwulanSelect.classList.remove('filtered');
        }
        
        saveLastSheet(selectedSheet);
        loadSheetData(selectedSheet);
    } else {
        showEmptyState();
    }
}

function handleRefresh() {
    const sheetSelect = document.getElementById('sheetSelect');
    const selectedSheet = sheetSelect.value;
    
    if (!selectedSheet) {
        alert('Pilih toko terlebih dahulu');
        return;
    }
    
    loadSheetData(selectedSheet, true);
}

function handleDelete(rowIndex, tableNumber) {
    if (!confirm('⚠️ Yakin ingin menghapus data ini?\n\nData yang dihapus tidak dapat dikembalikan!')) {
        return;
    }
    
    deleteRow(appState.currentSheet, rowIndex, tableNumber);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const editRowIndex = document.getElementById('editRowIndex').value;
    const tableNumber = parseInt(document.getElementById('editTableNumber').value) || 1;
    
    let rowData;
    
    if (tableNumber === 1) {
        const triwulan = document.getElementById('triwulan').value;
        const bulan = document.getElementById('bulan').value;
        const ebitdaLR = parseNumber(document.getElementById('ebitdaLR').value);
        const penggunaanLabaKas = parseNumber(document.getElementById('penggunaanLabaKas').value);
        const bayarListrik = parseNumber(document.getElementById('bayarListrik').value);
        const labaNetDitransfer = parseNumber(document.getElementById('labaNetDitransfer').value);
        const sisaSurkas = parseNumber(document.getElementById('sisaSurkas').value);

        rowData = [triwulan, bulan, ebitdaLR, penggunaanLabaKas, labaNetDitransfer, bayarListrik, sisaSurkas];
    } else {
        const no = document.getElementById('no2').value;
        const bulan = document.getElementById('bulan2').value;
        const nominalPenggunaanSurkas = parseNumber(document.getElementById('nominalPenggunaanSurkas').value);
        const tujuanPenggunaanSurkas = document.getElementById('tujuanPenggunaanSurkas').value;

        rowData = [no, bulan, nominalPenggunaanSurkas, tujuanPenggunaanSurkas];
    }

    // ✨ UPDATED: Pass tableNumber instead of range
    if (editRowIndex) {
        await updateRow(appState.currentSheet, parseInt(editRowIndex), rowData, tableNumber);
    } else {
        await addRow(appState.currentSheet, rowData, tableNumber);
    }
    
    closeModal();
}

// ============ INITIALIZATION ============
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, waiting for Google APIs...');
    
    startInactivityTimer();
    
    setTimeout(() => {
        if (typeof gapi !== 'undefined') {
            gapiLoaded();
        }
        if (typeof google !== 'undefined') {
            gisLoaded();
        }
    }, 500);
});

window.onclick = function(event) {
    const modal = document.getElementById('dataModal');
    if (event.target === modal) {
        closeModal();
    }
}
