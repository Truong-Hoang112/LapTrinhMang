const socket = io();

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
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    socket.emit('login', { username, password });
}

// Xử lý đăng ký
function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        alert('Mật khẩu xác nhận không khớp!');
        return false;
    }
    
    socket.emit('register', { username, password });
}

// Xử lý phản hồi từ server
socket.on('loginResponse', (response) => {
    if (response.success) {
        // Lưu thông tin người dùng
        localStorage.setItem('user', JSON.stringify(response.user));
        // Chuyển hướng đến trang game
        window.location.href = '/index.html';
    } else {
        alert(response.message);
    }
});

socket.on('registerResponse', (response) => {
    if (response.success) {
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
        showTab('login');
    } else {
        alert(response.message);
    }
}); 