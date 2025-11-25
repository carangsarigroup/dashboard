// ============ CONFIG ============
var CONFIG = {
    CLIENT_ID: '874016971039-g91m2mt64mid7sh9vkk14vpjmpbc095o.apps.googleusercontent.com',
    API_KEY: 'AIzaSyCMpk-2HdASd6oX-MBRqehgXX-kTfzpFw0',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    SPREADSHEET_ID: '1BUDa3SigMgbTfZf2rl1217kizSHSy57y6djhca91FKg',
    SHEET_NAME: 'Pengumuman'
};

// ============ GLOBAL STATE ============
var tokenClient;
var accessToken = null;
var gapiInited = false;
var gisInited = false;
var announcementData = [];
var currentUserRole = null;

// ============ AUTH & UTILITY FUNCTIONS ============
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function getAuthData() {
    try {
        var authString = getCookie('userAuth');
        if (!authString) return null;
        return JSON.parse(atob(authString));
    } catch (e) {
        console.error('Auth parse error:', e);
        return null;
    }
}

function logout(message) {
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken() !== null) {
        try {
            google.accounts.oauth2.revoke(gapi.client.getToken().access_token, function() {
                console.log('OAuth token revoked');
            });
            gapi.client.setToken(null);
        } catch (e) {
            console.warn('Error revoking token:', e);
        }
    }
    clearStoredToken();
    deleteCookie('userAuth');
    window.location.href = 'login.html' + (message ? '?message=' + encodeURIComponent(message) : '');
}

function checkAuth() {
    var authData = getAuthData();
    if (!authData) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    
    if (authData.expiresAt && new Date() > new Date(authData.expiresAt)) {
        deleteCookie('userAuth');
        window.location.href = 'login.html?message=' + encodeURIComponent('Session expired') + '&redirect=' + encodeURIComponent(window.location.pathname);
        return false;
    }
    
    document.getElementById('displayUsername').textContent = authData.username;
    currentUserRole = authData.role;
    updateUIBasedOnRole(authData.role);
    return true;
}

function updateUIBasedOnRole(role) {
    var isAdmin = role && role.toLowerCase() === 'admin';
    var authBtn = document.getElementById('authBtn');

    if (authBtn) {
        if (isAdmin) {
            authBtn.classList.add('show');
        } else {
            authBtn.classList.remove('show');
        }
    }

    updateAddAnnouncementButton();
}

function updateAddAnnouncementButton() {
    var addBtn = document.getElementById('adminAnnouncementBtn');
    var isAdmin = currentUserRole && currentUserRole.toLowerCase() === 'admin';
    var isAuthenticated = accessToken !== null;

    if (addBtn) {
        if (isAdmin && isAuthenticated) {
            addBtn.classList.add('show');
        } else {
            addBtn.classList.remove('show');
        }
    }
}

// ============ AUTO-LOGOUT INACTIVITY TIMER ============
var inactivityTimer;
var warningTimer;
var countdownInterval;
var INACTIVITY_LIMIT = 5 * 60 * 1000;
var WARNING_TIME = 60 * 1000;

function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);

    document.getElementById('logoutWarning').classList.remove('show');

    warningTimer = setTimeout(function() {
        showLogoutWarning();
    }, INACTIVITY_LIMIT - WARNING_TIME);

    inactivityTimer = setTimeout(function() {
        logout('Anda telah logout otomatis karena tidak ada aktivitas selama 5 menit');
    }, INACTIVITY_LIMIT);
}

function showLogoutWarning() {
    document.getElementById('logoutWarning').classList.add('show');
    var countdown = 60;
    document.getElementById('warningCountdown').textContent = countdown;
    countdownInterval = setInterval(function() {
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

var activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'visibilitychange'];
activityEvents.forEach(function(event) {
    window.addEventListener(event, resetInactivityTimer);
});

// ============ OAUTH TOKEN MANAGEMENT ============
function storeOAuthToken(token, expiresIn) {
    try {
        var expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('oauth_token', token);
        localStorage.setItem('oauth_expiry', expiryTime);
        accessToken = token;
    } catch (e) {
        console.warn('Could not save token to localStorage:', e);
    }
}

function restoreOAuthToken() {
    try {
        var token = localStorage.getItem('oauth_token');
        var expiry = localStorage.getItem('oauth_expiry');

        if (token && expiry && Date.now() < parseInt(expiry)) {
            accessToken = token;
            if (typeof gapi !== 'undefined' && gapi.client) {
                gapi.client.setToken({ access_token: accessToken });
            }
            updateAuthButton(true);
            return true;
        } else {
            clearStoredToken();
            updateAuthButton(false);
            return false;
        }
    } catch (e) {
        console.warn('Error restoring token:', e);
        clearStoredToken();
        return false;
    }
}

function clearStoredToken() {
    try {
        localStorage.removeItem('oauth_token');
        localStorage.removeItem('oauth_expiry');
        accessToken = null;
        updateAddAnnouncementButton();
    } catch (e) {
        console.warn('Error clearing token:', e);
    }
}

function updateAuthButton(isAuthenticated) {
    var authBtn = document.getElementById('authBtn');
    var authBtnText = document.getElementById('authBtnText');
    if (authBtn) {
        if (isAuthenticated) {
            authBtn.classList.add('authenticated');
            authBtnText.textContent = '✓ Terotentikasi';
        } else {
            authBtn.classList.remove('authenticated');
            authBtnText.textContent = 'Otentikasi';
        }
    }
    
    updateAddAnnouncementButton();
}

// ============ GOOGLE API INITIALIZATION ============
function gapiLoaded() {
    console.log('GAPI script loaded');
    gapi.load('client', initializeGapiClient);
}

function initializeGapiClient() {
    gapi.client.init({
        apiKey: CONFIG.API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
    }).then(function() {
        gapiInited = true;
        maybeEnableButtons();
        console.log('GAPI client initialized');
    }).catch(function(error) {
        console.error('Error initializing GAPI client:', error);
    });
}

function gisLoaded() {
    console.log('GIS script loaded');
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: ''
    });
    gisInited = true;
    maybeEnableButtons();
    console.log('GIS client initialized');
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        console.log('Both Google APIs ready');
        restoreOAuthToken();
        displayAnnouncements();
        if (currentUserRole && currentUserRole.toLowerCase() === 'admin') {
            updateUIBasedOnRole(currentUserRole);
        }
    } else {
        console.log('Waiting for APIs... GAPI:', gapiInited, 'GIS:', gisInited);
    }
}

function waitForGoogleAPIs() {
    var attempts = 0;
    var maxAttempts = 50;
    
    var checkInterval = setInterval(function() {
        attempts++;
        
        if (typeof gapi !== 'undefined' && !gapiInited) {
            gapiLoaded();
        }
        
        if (typeof google !== 'undefined' && typeof google.accounts !== 'undefined' && !gisInited) {
            gisLoaded();
        }
        
        if ((gapiInited && gisInited) || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            if (attempts >= maxAttempts && (!gapiInited || !gisInited)) {
                console.error('Google APIs failed to load after 10 seconds');
                console.log('GAPI loaded:', gapiInited, 'GIS loaded:', gisInited);
            }
        }
    }, 200);
}

function handleAuth() {
    if (currentUserRole && currentUserRole.toLowerCase() !== 'admin') {
        alert('❌ Akses Ditolak. Hanya Admin yang dapat melakukan Google Sheets Authentication.');
        return;
    }
    
    if (!gapiInited || !gisInited) {
        alert('⏳ Tunggu sebentar, Google API masih memuat...\n\nSilakan coba lagi dalam beberapa detik.');
        console.warn('Auth attempted but APIs not ready. GAPI:', gapiInited, 'GIS:', gisInited);
        waitForGoogleAPIs();
        return;
    }
    
    if (accessToken) {
        alert('✅ Sudah terauthentikasi!');
        return;
    }

    tokenClient.callback = function(response) {
        if (response.error !== undefined) {
            console.error('Auth error:', response);
            alert('❌ Gagal otentikasi: ' + response.error);
            clearStoredToken();
            updateAddAnnouncementButton();
            return;
        }
        
        accessToken = response.access_token;
        var expiresIn = response.expires_in || 3600;
        storeOAuthToken(accessToken, expiresIn);
        gapi.client.setToken({ access_token: accessToken });
        updateAuthButton(true);
        
        displayAnnouncements();
        alert('✅ Berhasil otentikasi!');
        console.log('Authenticated successfully, token expires in:', expiresIn, 'seconds');
    };

    try {
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    } catch (error) {
        console.error('Error requesting access token:', error);
        alert('❌ Terjadi kesalahan saat meminta akses. Silakan refresh halaman dan coba lagi.');
    }
}

// ============ GOOGLE SHEETS CRUD FUNCTIONS ============
function addRow(rowData) {
    if (!accessToken) {
        alert('❌ Harap otentikasi terlebih dahulu!\n\nKlik tombol "Otentikasi" di pojok kanan atas.');
        return Promise.reject();
    }
    
    if (currentUserRole && currentUserRole.toLowerCase() !== 'admin') {
        alert('❌ Akses Ditolak. Hanya pengguna Admin yang dapat menambah pengumuman.');
        return Promise.reject();
    }

    return gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: CONFIG.SHEET_NAME + '!A:D',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [rowData]
        }
    }).then(function(response) {
        console.log('Row added:', response);
        return loadAnnouncements().then(function() {
            return displayAnnouncements();
        }).then(function() {
            alert('✅ Pengumuman berhasil ditambahkan!');
            return response;
        });
    }).catch(function(error) {
        console.error('Error adding row:', error);
        alert('❌ Gagal menambahkan pengumuman: ' + (error.result && error.result.error && error.result.error.message ? error.result.error.message : error.message));
        throw error;
    });
}

function updateRow(rowIndex, rowData) {
    if (!accessToken) {
        alert('❌ Harap otentikasi terlebih dahulu!');
        return Promise.reject();
    }
    
    if (currentUserRole && currentUserRole.toLowerCase() !== 'admin') {
        alert('❌ Akses Ditolak. Hanya pengguna Admin yang dapat mengupdate pengumuman.');
        return Promise.reject();
    }

    return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: CONFIG.SHEET_NAME + '!A' + rowIndex + ':D' + rowIndex,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [rowData]
        }
    }).then(function(response) {
        console.log('Row updated:', response);
        return loadAnnouncements().then(function() {
            return displayAnnouncements();
        }).then(function() {
            alert('✅ Pengumuman berhasil diupdate!');
            return response;
        });
    }).catch(function(error) {
        console.error('Error updating row:', error);
        alert('❌ Gagal mengupdate pengumuman: ' + (error.result && error.result.error && error.result.error.message ? error.result.error.message : error.message));
        throw error;
    });
}

function deleteRow(rowIndex) {
    if (!accessToken) {
        alert('❌ Harap otentikasi terlebih dahulu!');
        return;
    }
    
    if (currentUserRole && currentUserRole.toLowerCase() !== 'admin') {
        alert('❌ Akses Ditolak. Hanya pengguna Admin yang dapat menghapus pengumuman.');
        return;
    }
    
    if (!confirm('⚠️ Anda yakin ingin menghapus pengumuman pada baris ke-' + rowIndex + '?')) {
        return;
    }

    gapi.client.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.SPREADSHEET_ID
    }).then(function(spreadsheet) {
        var sheet = null;
        for (var i = 0; i < spreadsheet.result.sheets.length; i++) {
            if (spreadsheet.result.sheets[i].properties.title === CONFIG.SHEET_NAME) {
                sheet = spreadsheet.result.sheets[i];
                break;
            }
        }

        if (!sheet) {
            throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" tidak ditemukan.');
        }
        var sheetId = sheet.properties.sheetId;

        var deleteRequest = {
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
        };

        return gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            resource: deleteRequest
        });
    }).then(function(response) {
        console.log('Row deleted:', response);
        return loadAnnouncements().then(function() {
            return displayAnnouncements();
        }).then(function() {
            alert('🗑️ Pengumuman berhasil dihapus!');
            return response;
        });
    }).catch(function(error) {
        console.error('Error deleting row:', error);
        alert('❌ Gagal menghapus pengumuman: ' + (error.result && error.result.error && error.result.error.message ? error.result.error.message : error.message));
        throw error;
    });
}

// ============ ANNOUNCEMENT FUNCTIONS ============
function loadAnnouncements() {
    var loadingSpinner = document.getElementById('loadingSpinner');
    
    if (loadingSpinner) loadingSpinner.classList.add('show');
    
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + CONFIG.SPREADSHEET_ID + '/values/' + CONFIG.SHEET_NAME + '?key=' + CONFIG.API_KEY;
    
    return fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (loadingSpinner) loadingSpinner.classList.remove('show');
            
            if (data.error) {
                console.error('API Error:', data.error);
                announcementData = [];
                return [];
            }
            
            if (!data.values || data.values.length <= 1) {
                announcementData = [];
                return [];
            }

            announcementData = data.values;

            return data.values.slice(1).map(function(row) {
                return {
                    type: row[0] || 'UMUM',
                    title: row[1] || 'Judul Pengumuman',
                    content: row[2] || 'Isi pengumuman tidak tersedia.',
                    date: row[3] || ''
                };
            });
        })
        .catch(function(error) {
            if (loadingSpinner) loadingSpinner.classList.remove('show');
            console.error('Error loading announcements:', error);
            return [];
        });
}

function formatAnnouncementDate(isoDate) {
    if (!isoDate) return 'Tanggal tidak diketahui';
    try {
        var options = { year: 'numeric', month: 'long', day: 'numeric' };
        var dateParts = isoDate.split('-');
        if (dateParts.length === 3) {
            return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString('id-ID', options);
        }
        return new Date(isoDate).toLocaleDateString('id-ID', options);
    } catch (e) {
        return isoDate;
    }
}

function displayAnnouncements() {
    var listContainer = document.getElementById('announcementsList');
    var board = document.getElementById('announcementBoard');
    
    return loadAnnouncements().then(function(announcements) {
        if (listContainer) listContainer.innerHTML = '';

        if (board) board.style.display = 'block';

        var isAdminAuthenticated = accessToken !== null && currentUserRole && currentUserRole.toLowerCase() === 'admin';
        
        if (announcements.length === 0) {
            var emptyDiv = document.createElement('div');
            emptyDiv.className = 'no-announcements';
            emptyDiv.innerHTML = '<div class="icon">📭</div><p>Tidak ada pengumuman baru</p>';
            if (listContainer) listContainer.appendChild(emptyDiv);
            return;
        }

        announcements.forEach(function(item, index) {
            var rowIndex = index + 2;

            var itemDiv = document.createElement('div');
            itemDiv.className = 'announcement-item';
            
            var itemHTML = '<div class="announcement-content">' +
                '<span class="announcement-type">' + item.type + '</span>' +
                '<div class="announcement-title-text">' + item.title + '</div>' +
                '<p style="white-space: pre-wrap;">' + item.content + '</p>' +
                '<span class="announcement-date">Publikasi: ' + formatAnnouncementDate(item.date) + '</span>' +
                '</div>';
            
            if (isAdminAuthenticated) {
                itemHTML += '<div class="announcement-actions show">' +
                    '<button class="btn-edit" onclick="openAnnouncementModal(\'edit\', ' + rowIndex + ')">✏️ Edit</button>' +
                    '<button class="btn-delete" onclick="deleteRow(' + rowIndex + ')">🗑️ Hapus</but
