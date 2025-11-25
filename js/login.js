// ============ CONFIG ============
const CONFIG = {
    API_KEY: 'AIzaSyCMpk-2HdASd6oX-MBRqehgXX-kTfzpFw0',
    SPREADSHEET_ID: '1bcKwjW2Yq70Au9vV6Ql4k76qarny8q-5c_itxtBgzu0',
    SHEET_NAME: 'Users'
};

console.log('🚀 Login.js loaded successfully');

// ============ COOKIE MANAGEMENT ============
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
    console.log('✅ Cookie set:', name);
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
}

// ============ UI FUNCTIONS ============
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
        toggleBtn.title = 'Sembunyikan Password';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Tampilkan Password';
    }
}

function showMessage(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = 'message ' + type + ' show';
    console.log('📢 Message:', message, '| Type:', type);
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
    }, 5000);
}

function setLoading(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (isLoading) {
        loginBtn.disabled = true;
        btnText.innerHTML = 'Memverifikasi<span class="loading-spinner"></span>';
        loadingOverlay.classList.add('active');
        console.log('⏳ Loading started');
    } else {
        loginBtn.disabled = false;
        btnText.textContent = '🚀 Masuk ke SIMTOCS';
        loadingOverlay.classList.remove('active');
        console.log('✓ Loading stopped');
    }
}

// ============ LOGIN HANDLER ============
async function handleLogin(event) {
    event.preventDefault();
    console.log('🔐 Login attempt started');
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    console.log('👤 Username:', username);
    console.log('🔑 Password length:', password.length);
    
    // Validation
    if (!username || !password) {
        showMessage('❌ Username dan password harus diisi!', 'error');
        return;
    }

    if (username.length < 3) {
        showMessage('❌ Username minimal 3 karakter!', 'error');
        return;
    }

    if (password.length < 4) {
        showMessage('❌ Password minimal 4 karakter!', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.SHEET_NAME}?key=${CONFIG.API_KEY}`;
        console.log('📡 Fetching from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Gagal terhubung ke server. Cek koneksi internet Anda.');
        }
        
        const data = await response.json();
        console.log('📊 Data received, rows:', data.values?.length);
        
        if (data.error) {
            throw new Error('Gagal mengakses database. Periksa konfigurasi API.');
        }
        
        if (!data.values || data.values.length === 0) {
            throw new Error('Database user kosong atau tidak ditemukan.');
        }
        
        // Skip header row
        const users = data.values.slice(1);
        console.log('👥 Total users in database:', users.length);
        
        // Find matching user
        const validUser = users.find(user => 
            user[0] && user[0].trim().toLowerCase() === username.toLowerCase() && 
            user[1] && user[1].trim() === password
        );
        
        if (validUser) {
            console.log('✅ Valid user found!');
            // Login successful
            const authData = {
                username: username,
                fullName: validUser[2] || username,
                role: validUser[3] || 'user', 
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            
            console.log('📝 Auth data:', authData);
            
            const encoded = btoa(JSON.stringify(authData));
            setCookie('userAuth', encoded, 1);
            
            // Get redirect URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirectParam = urlParams.get('redirect');
            
            // Determine redirect path based on current location
            let redirectTo;
            if (redirectParam) {
                redirectTo = redirectParam;
            } else if (window.location.hostname === 'simtocs.github.io') {
                // GitHub Pages
                redirectTo = '/dashboard/index.html';
            } else {
                // Local or other hosting
                redirectTo = 'index.html';
            }
            
            console.log('🎯 Redirecting to:', redirectTo);
            
            showMessage('✅ Login berhasil! Mengalihkan ke dashboard...', 'success');
            
            // Redirect with delay
            setTimeout(() => {
                console.log('🚀 Executing redirect now...');
                window.location.href = redirectTo;
            }, 1500);
            
        } else {
            // Login failed
            console.log('❌ Invalid credentials');
            setLoading(false);
            showMessage('❌ Username atau password salah!', 'error');
            
            // Clear password field
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
        
    } catch (error) {
        console.error('❌ Login error:', error);
        setLoading(false);
        showMessage('❌ ' + error.message, 'error');
    }
}

// ============ INITIALIZATION ============
window.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM Content Loaded');
    console.log('📍 Current URL:', window.location.href);
    console.log('🏠 Hostname:', window.location.hostname);
    
    // Check if already logged in
    const authCookie = getCookie('userAuth');
    if (authCookie) {
        console.log('🔍 Found existing auth cookie');
        try {
            const authData = JSON.parse(atob(authCookie));
            console.log('👤 Logged in as:', authData.username);
            if (new Date(authData.expiresAt) > new Date()) {
                console.log('✅ Session still valid, redirecting...');
                // Still valid, redirect to index
                const urlParams = new URLSearchParams(window.location.search);
                const redirectParam = urlParams.get('redirect');
                
                let redirectTo;
                if (redirectParam) {
                    redirectTo = redirectParam;
                } else if (window.location.hostname === 'simtocs.github.io') {
                    redirectTo = '/dashboard/index.html';
                } else {
                    redirectTo = 'index.html';
                }
                
                console.log('🎯 Redirecting to:', redirectTo);
                window.location.href = redirectTo;
                return;
            } else {
                console.log('⏰ Session expired');
            }
        } catch (e) {
            console.error('❌ Error parsing auth cookie:', e);
        }
    } else {
        console.log('🔓 No auth cookie found');
    }

    // Display message from URL
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    
    if (message) {
        showMessage(decodeURIComponent(message), 'error');
    }

    // Focus on username field
    document.getElementById('username').focus();

    // Add event listeners
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('✅ Login form found, attaching event listener');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error('❌ Login form not found!');
    }

    const toggleBtn = document.getElementById('togglePasswordBtn');
    if (toggleBtn) {
        console.log('✅ Toggle password button found');
        toggleBtn.addEventListener('click', togglePassword);
    } else {
        console.error('❌ Toggle password button not found!');
    }

    // Add Enter key handler for password field
    const passwordField = document.getElementById('password');
    if (passwordField) {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLogin(e);
            }
        });
    }
    
    console.log('✅ Initialization complete');
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus username
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('username').focus();
    }
});
