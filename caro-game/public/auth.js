// Chuyển đổi giữa các tab
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
}

// Xử lý đăng nhập
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            window.location.href = '/index.html';
        } else {
            const oldError = document.querySelector('.error-message');
            if (oldError) oldError.remove();
            errorDiv.textContent = data.message;
            document.getElementById('loginForm').appendChild(errorDiv);
        }
    } catch (error) {
        errorDiv.textContent = 'Lỗi kết nối server!';
        document.getElementById('loginForm').appendChild(errorDiv);
    }
}

// Xử lý đăng ký
async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Mật khẩu xác nhận không khớp!';
        document.getElementById('registerForm').appendChild(errorDiv);
        return false;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
            showTab('login');
        } else {
            const oldError = document.querySelector('.error-message');
            if (oldError) oldError.remove();
            errorDiv.textContent = data.message;
            document.getElementById('registerForm').appendChild(errorDiv);
        }
    } catch (error) {
        errorDiv.textContent = 'Lỗi kết nối server!';
        document.getElementById('registerForm').appendChild(errorDiv);
    }
}

// Kiểm tra trạng thái đăng nhập khi tải trang
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        if (data.success) {
            window.location.href = '/index.html';
        }
    } catch (error) {
        // Không làm gì nếu chưa đăng nhập
    }
}
checkAuthStatus(); 