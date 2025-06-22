const socket = io();

/**
 * Hàm này dùng để chuyển đổi qua lại giữa tab Đăng nhập và Đăng ký
 * @param {string} tabName - Tên của tab để hiển thị ('login' hoặc 'register')
 */
function showTab(tabName) {
    // Ẩn tất cả các nội dung tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Bỏ trạng thái 'active' của tất cả các nút tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Hiển thị tab và kích hoạt nút tương ứng
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
}

/**
 * Xử lý sự kiện khi người dùng gửi form đăng nhập
 * @param {Event} event - Sự kiện của form
 */
function handleLogin(event) {
    event.preventDefault(); // Ngăn form gửi đi theo cách truyền thống
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    // Gửi sự kiện 'login' lên server với dữ liệu
    socket.emit('login', { username, password });
}

/**
 * Xử lý sự kiện khi người dùng gửi form đăng ký
 * @param {Event} event - Sự kiện của form
 */
function handleRegister(event) {
    event.preventDefault(); // Ngăn form gửi đi
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Kiểm tra mật khẩu xác nhận
    if (password !== confirmPassword) {
        alert('Mật khẩu xác nhận không khớp!');
        return; // Dừng lại nếu không khớp
    }
    // Gửi sự kiện 'register' lên server với dữ liệu
    socket.emit('register', { username, password });
}


// --- FIX: LẮNG NGHE ĐÚNG TÊN SỰ KIỆN TỪ SERVER ---

/**
 * Xử lý khi xác thực (đăng nhập/đăng ký) thành công.
 */
socket.on('authSuccess', (data) => {
    // Lưu thông tin người dùng vào bộ nhớ trình duyệt
    localStorage.setItem('user', JSON.stringify(data));
    // Chuyển hướng đến trang chủ
    window.location.href = '/home.html';
});

/**
 * Xử lý khi có lỗi xác thực từ server.
 */
socket.on('authError', (message) => {
    // Hiển thị thông báo lỗi cho người dùng
    alert(message);
});