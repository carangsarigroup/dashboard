// ============ CONFIG ============
const CONFIG = {
    API_KEY: 'AIzaSyCMpk-2HdASd6oX-MBRqehgXX-kTfzpFw0',
    SPREADSHEET_ID: '1bcKwjW2Yq70Au9vV6Ql4k76qarny8q-5c_itxtBgzu0',
    SHEET_NAME: 'Users'
};

// ============ COOKIE MANAGEMENT ============
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
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
    } else {
        loginBtn.disabled = false;
        btnText.textContent = '🚀 Masuk ke Dashboard';
        loadingOverlay.classList.remove('active');
    }
}

// ============ LOGIN HANDLER ============
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
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
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Gagal terhubung ke server. Cek koneksi internet Anda.');
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error('Gagal mengakses database. Periksa konfigurasi API.');
        }
        
        if (!data.values || data.values.length === 0) {
            throw new Error('Database user kosong atau tidak ditemukan.');
        }
        
        // Skip header row
        const users = data.values.slice(1);
        
        // Find matching user
        const validUser = users.find(user => 
            user[0] && user[0].trim().toLowerCase() === username.toLowerCase() && 
            user[1] && user[1].trim() === password
        );
        
        if (validUser) {
            // Login successful
            const authData = {
                username: username,
                fullName: validUser[2] || username,
                role: validUser[3] || 'user', 
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            
            const encoded = btoa(JSON.stringify(authData));
            setCookie('userAuth', encoded, 1);
            
            // Get redirect URL
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirect') || 'index.html';
            
            showMessage('✅ Login berhasil! Mengalihkan ke dashboard...', 'success');
            
            // Redirect with delay
            setTimeout(() => {
                window.location.href = redirectTo;
            }, 1500);
            
        } else {
            // Login failed
            setLoading(false);
            showMessage('❌ Username atau password salah!', 'error');
            
            // Clear password field
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
        
    } catch (error) {
        console.error('Login error:', error);
        setLoading(false);
        showMessage('❌ ' + error.message, 'error');
    }
}

// ============ INITIALIZATION ============
window.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const authCookie = getCookie('userAuth');
    if (authCookie) {
        try {
            const authData = JSON.parse(atob(authCookie));
            if (new Date(authData.expiresAt) > new Date()) {
                // Still valid, redirect to index
                const urlParams = new URLSearchParams(window.location.search);
                const redirectTo = urlParams.get('redirect') || 'index.html';
                window.location.href = redirectTo;
                return;
            }
        } catch (e) {
            // Invalid cookie, continue to login
        }
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
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('togglePasswordBtn').addEventListener('click', togglePassword);

    // Add Enter key handler for password field
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin(e);
        }
    });
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus username
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('username').focus();
    }
});
```

## Summary

You now have:

1. **`login.html`** - Clean HTML structure with no inline CSS or JavaScript
2. **`css/login.css`** - All styling separated into its own file
3. **`js/login.js`** - All JavaScript logic in its own file

### Benefits:
- ✅ **Better organization** - Easy to find and edit specific parts
- ✅ **Maintainability** - Changes to CSS/JS don't require editing HTML
- ✅ **Reusability** - CSS/JS can be reused across multiple pages
- ✅ **Performance** - Browsers can cache CSS/JS files separately
- ✅ **Collaboration** - Different team members can work on different files
- ✅ **Debugging** - Easier to debug when code is separated

Make sure your folder structure looks like this:
```
your-folder/
├── login.html
├── index.html (your dashboard)
├── css/
│   └── login.css
└── js/
    └── login.js
