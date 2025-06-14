// Chuyển đổi giữa các tab
function showTab(tabName) {
    // Ẩn tất cả các tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Bỏ active tất cả các nút
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Hiện tab được chọn
    document.getElementById(tabName).classList.add('active');
    
    // Active nút được chọn
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/index.html';
        } else {
            // Xóa thông báo lỗi cũ nếu có
            const oldError = document.querySelector('.error-message');
            if (oldError) oldError.remove();
            
            errorDiv.textContent = data.message;
            document.getElementById('loginForm').appendChild(errorDiv);
        }
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (data.success) {
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
            showTab('login');
        } else {
            // Xóa thông báo lỗi cũ nếu có
            const oldError = document.querySelector('.error-message');
            if (oldError) oldError.remove();
            
            errorDiv.textContent = data.message;
            document.getElementById('registerForm').appendChild(errorDiv);
        }
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
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
        console.error('Lỗi kiểm tra trạng thái đăng nhập:', error);
    }
}

// Gọi hàm kiểm tra khi tải trang
checkAuthStatus(); 