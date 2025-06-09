// Lưu users trên localStorage dưới dạng:
// [{username, password, role}, ...]
// role = 'admin' hoặc 'user'

const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const adminSection = document.getElementById('admin-section');
const gameSection = document.getElementById('game-section');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');

const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const registerButton = document.getElementById('register-button');
const registerMessage = document.getElementById('register-message');

const showRegisterBtn = document.getElementById('show-register-btn');
const cancelRegisterBtn = document.getElementById('cancel-register');

const logoutAdminBtn = document.getElementById('logout-admin');
const logoutGameBtn = document.getElementById('logout-game');

const userListTbody = document.querySelector('#user-list tbody');

let currentUser = null;

// Khởi tạo dữ liệu user mặc định (chỉ chạy 1 lần)
function initializeUsers() {
    let users = JSON.parse(localStorage.getItem('users')) || [];
    // Nếu chưa có admin thì tạo
    if (!users.some(u => u.role === 'admin')) {
        users.push({ username: 'admin', password: 'admin123', role: 'admin' });
        localStorage.setItem('users', JSON.stringify(users));
    }
}

function getUsers() {
    return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function showSection(section) {
    // Ẩn tất cả
    loginSection.classList.add('hidden');
    registerSection.classList.add('hidden');
    adminSection.classList.add('hidden');
    gameSection.classList.add('hidden');

    section.classList.remove('hidden');
}

function renderUserList() {
    const users = getUsers();
    userListTbody.innerHTML = '';
    users.forEach((user, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${user.role === 'admin' ? '' : `<button data-index="${index}" class="delete-user-btn">Xóa</button>`}</td>
        `;
        userListTbody.appendChild(tr);
    });

    // Thêm sự kiện xóa user
    const deleteBtns = userListTbody.querySelectorAll('.delete-user-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const index = +btn.dataset.index;
            deleteUser(index);
        });
    });
}

function deleteUser(index) {
    let users = getUsers();
    if (index >= 0 && index < users.length) {
        users.splice(index, 1);
        saveUsers(users);
        renderUserList();
    }
}

function login(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        loginMessage.textContent = '';
        return true;
    } else {
        loginMessage.textContent = 'Sai tên đăng nhập hoặc mật khẩu.';
        return false;
    }
}

function logout() {
    currentUser = null;
    showSection(loginSection);
}

function register(username, password) {
    if (!username || !password) {
        registerMessage.textContent = 'Vui lòng nhập đầy đủ thông tin.';
        return false;
    }
    let users = getUsers();
    if (users.some(u => u.username === username)) {
        registerMessage.textContent = 'Tên đăng nhập đã tồn tại.';
        return false;
    }
    users.push({ username, password, role: 'user' });
    saveUsers(users);
    registerMessage.style.color = 'green';
    registerMessage.textContent = 'Đăng ký thành công. Vui lòng đăng nhập.';
    return true;
}

function afterLogin() {
    if (!currentUser) {
        showSection(loginSection);
        return;
    }
    if (currentUser.role === 'admin') {
        renderUserList();
        showSection(adminSection);
    } else {
        showSection(gameSection);
        // Khởi động game (nếu cần)
        initializeBoard();
    }
}

// Xử lý sự kiện login
loginButton.addEventListener('click', () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    if (login(username, password)) {
        afterLogin();
        loginUsername.value = '';
        loginPassword.value = '';
        loginMessage.textContent = '';
    }
});

// Hiển thị form đăng ký
showRegisterBtn.addEventListener('click', () => {
    registerMessage.textContent = '';
    registerUsername.value = '';
    registerPassword.value = '';
    showSection(registerSection);
});

// Hủy đăng ký
cancelRegisterBtn.addEventListener('click', () => {
    showSection(loginSection);
});

// Xử lý đăng ký
registerButton.addEventListener('click', () => {
    const username = registerUsername.value.trim();
    const password = registerPassword.value;
    if (register(username, password)) {
        // Đăng ký thành công, quay lại login
        setTimeout(() => {
            showSection(loginSection);
            registerMessage.textContent = '';
        }, 1500);
    }
});

// Đăng xuất admin
logoutAdminBtn.addEventListener('click', () => {
    logout();
});

// Đăng xuất user chơi game
logoutGameBtn.addEventListener('click', () => {
    logout();
});

initializeUsers();
showSection(loginSection);
